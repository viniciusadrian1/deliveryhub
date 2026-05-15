import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DidifoodAdapter, type DidifoodDeliveryStatus } from '@deliveryhub/didifood';
import type { PlatformCode } from '@deliveryhub/shared';
import type { RemoteOrder } from '@deliveryhub/ifood';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { StockConsumptionService } from '../inventory/stock-consumption.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CustomersService } from './customers.service.js';
import type { DispatchSelfDeliveryInput, ListOrdersQuery } from './dto/orders.dto.js';
import {
  InvalidTransitionError,
  type OrderStatus,
  reconcileFromPlatform,
  transition,
} from './order-status.js';
import { OrdersEmitter, type OrderEventPayload } from './orders.emitter.js';

interface IngestionContext {
  platformId: string;
  platformCode: PlatformCode;
  storeId: string;
  organizationId: string;
  externalMerchantId: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly registry: AdapterRegistry,
    private readonly integrations: IntegrationsService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly emitter: OrdersEmitter,
    private readonly stockConsumption: StockConsumptionService,
  ) {}

  /**
   * Dispara baixa de estoque para um pedido recém-entregue.
   * Não lança — falhas são silenciosas (logadas dentro do service).
   * NÃO bloqueia a transição do pedido em nenhuma circunstância.
   */
  private async consumeStockSafely(orderId: string): Promise<void> {
    try {
      const result = await this.stockConsumption.consumeForOrder(orderId);
      if (result.warnings.length > 0) {
        this.logger.warn(
          { orderId, warnings: result.warnings, movements: result.movementsCreated },
          'stock_consume_completed_with_warnings',
        );
      }
    } catch (err) {
      this.logger.error({ err, orderId }, 'stock_consume_outer_failure');
    }
  }

  // ============== Ingestão via webhook ==============

  async ingestFromWebhook(
    platformCode: PlatformCode,
    externalOrderId: string,
    externalMerchantId: string,
    eventType: string,
  ): Promise<void> {
    const ctx = await this.resolveContext(platformCode, externalMerchantId);
    if (!ctx) {
      this.logger.warn({ platformCode, externalMerchantId }, 'webhook_no_matching_connection');
      return;
    }

    const adapter = this.registry.get(platformCode);
    const tokens = await this.integrations.getTokens(ctx.connectionId);
    if (!tokens) {
      this.logger.warn({ connectionId: ctx.connectionId }, 'webhook_no_tokens');
      return;
    }

    const remote = await adapter.fetchOrder(tokens, ctx.externalMerchantId, externalOrderId);
    await this.upsertOrder(ctx, remote, eventType);
  }

  /**
   * Ingestão do webhook `deliveryStatus` (Logistics 99Food) — progresso do
   * entregador. Atualiza o entregador no pedido e, em 140 (coletou) /
   * 160 (entregue), avança o status.
   */
  async ingestDeliveryStatus(
    platformCode: PlatformCode,
    delivery: DidifoodDeliveryStatus,
  ): Promise<void> {
    const ctx = await this.resolveContext(platformCode, delivery.externalMerchantId);
    if (!ctx) {
      this.logger.warn({ platformCode }, 'delivery_status_no_connection');
      return;
    }
    const order = await this.prisma.order.findUnique({
      where: {
        platformId_externalId: {
          platformId: ctx.platformId,
          externalId: delivery.externalOrderId,
        },
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        totalCents: true,
        netCents: true,
        placedAt: true,
      },
    });
    if (!order) {
      this.logger.warn(
        { platformCode, externalOrderId: delivery.externalOrderId },
        'delivery_status_no_order',
      );
      return;
    }

    // 140 TAKEN → despachado · 160 FINISH → entregue. Demais códigos só
    // atualizam o entregador, sem mexer no status.
    const mapped: OrderStatus | null =
      delivery.deliveryStatus === 140
        ? 'dispatched'
        : delivery.deliveryStatus === 160
          ? 'delivered'
          : null;
    const nextStatus = mapped
      ? reconcileFromPlatform(order.status, mapped)
      : order.status;

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        courierName: delivery.courierName ?? undefined,
        courierPhone: delivery.courierPhone ?? undefined,
        status: nextStatus,
        ...(nextStatus !== order.status ? stampStatusTimestamp(nextStatus) : {}),
      },
    });

    if (nextStatus !== order.status) {
      await this.recordStatusEvent(order.id, nextStatus, 'platform', {
        eventType: `deliveryStatus:${delivery.deliveryStatus}`,
      });
      if (nextStatus === 'delivered' && order.status !== 'delivered') {
        await this.consumeStockSafely(order.id);
      }
    }

    this.emit(
      'order.updated',
      { organizationId: ctx.organizationId, storeId: ctx.storeId, platformCode },
      updated,
    );
  }

  // ============== Listagem & detalhe ==============

  async list(auth: AuthContext, query: ListOrdersQuery) {
    return this.prisma.order.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        status: query.statusIn?.length
          ? { in: query.statusIn }
          : (query.status ?? undefined),
        placedAt: query.since ? { gte: query.since } : undefined,
      },
      orderBy: { placedAt: 'desc' },
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      include: {
        platform: { select: { code: true, name: true, colorHex: true } },
        customer: { select: { id: true, name: true } },
        items: query.withItems
          ? {
              orderBy: { id: 'asc' },
              include: { modifiers: true },
            }
          : false,
        // Indicador leve p/ o card do Hub destacar pedidos com
        // cancelamento/reembolso aguardando resposta da loja.
        actionRequests: {
          where: { status: 'pending' },
          select: { id: true, kind: true },
        },
      },
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      include: {
        platform: { select: { code: true, name: true, colorHex: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: { modifiers: true },
          orderBy: { unitPriceCents: 'desc' },
        },
        statusEvents: { orderBy: { at: 'desc' } },
        actionRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('order_not_found');
    return order;
  }

  // ============== Ações do operador ==============

  async accept(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'accepted', async (adapter, tokens, merchantId, ext) => {
      await adapter.acceptOrder(tokens, merchantId, ext);
    });
  }

  async startPreparing(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'preparing');
  }

  async markReady(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'ready');
  }

  async dispatch(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'dispatched', async (adapter, tokens, merchantId, ext) => {
      await adapter.dispatchOrder(tokens, merchantId, ext);
    });
  }

  async markDelivered(auth: AuthContext, id: string) {
    return this.userTransition(
      auth,
      id,
      'delivered',
      async (adapter, tokens, _merchantId, ext, order) => {
        // Entrega própria no 99Food: avisa a plataforma da conclusão.
        if (adapter instanceof DidifoodAdapter && order.deliveryBy === 'store') {
          await adapter.selfDeliveryDelivered(tokens, ext);
        }
      },
    );
  }

  async reject(auth: AuthContext, id: string, reason: string) {
    return this.userTransition(
      auth,
      id,
      'cancelled',
      async (adapter, tokens, merchantId, ext) => {
        await adapter.rejectOrder(tokens, merchantId, ext, reason);
      },
      reason,
    );
  }

  /**
   * Confirma o recebimento em dinheiro de um pedido 99Food entregue por
   * entregador da plataforma (Order API — Confirm Cash Payment). Não muda
   * o status do pedido; só marca `cashPaymentConfirmedAt`.
   */
  async confirmCashPayment(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!order) throw new NotFoundException('order_not_found');
    if (order.cashPaymentConfirmedAt) return this.findOne(auth, id);
    if (order.paymentMethod !== 'cash') {
      throw new BadRequestException('order_not_cash');
    }

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      order.storeId,
      order.platformId,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(order.platform.code as PlatformCode);
    if (!(adapter instanceof DidifoodAdapter)) {
      throw new BadRequestException('cash_confirmation_unsupported');
    }

    try {
      await adapter.confirmCashPayment(conn.tokens, order.externalId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'cash_confirmation_failed';
      this.logger.error({ err, orderId: order.id }, 'cash_confirmation_failed');
      throw new BadRequestException(message.slice(0, 200));
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { cashPaymentConfirmedAt: new Date() },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'order',
      entityId: order.id,
      action: 'update',
      diff: { cashPaymentConfirmed: true },
    });
    return this.findOne(auth, id);
  }

  /**
   * Despacha um pedido de ENTREGA PRÓPRIA do 99Food: registra o entregador,
   * avisa a plataforma (Self Delivery) e transiciona o pedido pra
   * "despachado". O `markDelivered` posterior chama selfDeliveryDelivered.
   */
  async dispatchSelfDelivery(
    auth: AuthContext,
    id: string,
    input: DispatchSelfDeliveryInput,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!order) throw new NotFoundException('order_not_found');
    if (order.platform.code !== '99food' || order.deliveryBy !== 'store') {
      throw new BadRequestException('not_a_self_delivery_order');
    }

    let nextStatus: OrderStatus;
    try {
      nextStatus = transition(order.status, 'dispatched');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      order.storeId,
      order.platformId,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get('99food');
    if (!(adapter instanceof DidifoodAdapter)) {
      throw new BadRequestException('self_delivery_unsupported');
    }

    const [firstName, ...rest] = input.courierName.trim().split(/\s+/);
    const nowSec = Math.floor(Date.now() / 1000);
    try {
      await adapter.selfDeliveryDispatch(conn.tokens, order.externalId, {
        courier: {
          name: input.courierName,
          firstName: firstName ?? input.courierName,
          lastName: rest.join(' ') || (firstName ?? input.courierName),
          phoneCode: input.courierPhoneCode,
          phone: input.courierPhone,
          vehicleType: input.vehicleType,
        },
        pickupTime: nowSec,
        deliveryTime: nowSec + input.etaMinutes * 60,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'self_delivery_dispatch_failed';
      this.logger.error({ err, orderId: order.id }, 'self_delivery_dispatch_failed');
      throw new BadRequestException(message.slice(0, 200));
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        courierName: input.courierName,
        courierPhone: `${input.courierPhoneCode} ${input.courierPhone}`,
        ...stampStatusTimestamp(nextStatus),
      },
    });
    await this.recordStatusEvent(order.id, nextStatus, 'user', {
      actorUserId: auth.userId,
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'order',
      entityId: order.id,
      action: 'update',
      diff: { from: order.status, to: nextStatus, selfDelivery: true },
    });
    this.emit(
      'order.updated',
      {
        platformCode: order.platform.code as PlatformCode,
        storeId: order.storeId,
        organizationId: order.organizationId,
      },
      updated,
    );
    return this.findOne(auth, id);
  }

  // ============== Helpers ==============

  private async resolveContext(platformCode: PlatformCode, externalMerchantId: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { code: platformCode },
    });
    if (!platform) return null;

    const connection = await this.prisma.platformConnection.findFirst({
      where: { platformId: platform.id, externalMerchantId, status: 'active' },
    });
    if (!connection) return null;

    return {
      platformId: platform.id,
      platformCode,
      storeId: connection.storeId,
      organizationId: connection.organizationId,
      externalMerchantId,
      connectionId: connection.id,
    };
  }

  private async upsertOrder(
    ctx: IngestionContext & { connectionId: string },
    remote: RemoteOrder,
    eventType: string,
  ): Promise<void> {
    const customer = await this.customers.upsert({
      organizationId: ctx.organizationId,
      name: remote.customer.name,
      phone: remote.customer.phone,
      document: remote.customer.document,
    });

    const existing = await this.prisma.order.findUnique({
      where: { platformId_externalId: { platformId: ctx.platformId, externalId: remote.externalId } },
      select: { id: true, status: true },
    });

    const subtotalCents = remote.subtotalCents || remote.totalCents - remote.deliveryFeeCents;
    const fees =
      remote.platformFeeCents + remote.processingFeeCents + remote.flatFeeCents;
    const netCents = remote.totalCents - fees;

    if (existing) {
      const newStatus = reconcileFromPlatform(existing.status, remote.status);
      const order = await this.prisma.order.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          totalCents: remote.totalCents,
          subtotalCents,
          deliveryFeeCents: remote.deliveryFeeCents,
          platformFeeCents: remote.platformFeeCents,
          processingFeeCents: remote.processingFeeCents,
          flatFeeCents: remote.flatFeeCents,
          netCents,
          customerId: customer.id,
          paymentMethod: remote.paymentMethod ?? undefined,
          deliveryBy: remote.deliveryBy ?? undefined,
          ...stampStatusTimestamp(newStatus),
        },
      });
      if (newStatus !== existing.status) {
        await this.recordStatusEvent(order.id, newStatus, 'platform', { eventType });
        // Pedido transicionou via plataforma — se virou delivered, baixa estoque.
        if (newStatus === 'delivered' && existing.status !== 'delivered') {
          await this.consumeStockSafely(order.id);
        }
        this.emit('order.updated', ctx, order);
      }
      return;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          organizationId: ctx.organizationId,
          storeId: ctx.storeId,
          platformId: ctx.platformId,
          externalId: remote.externalId,
          customerId: customer.id,
          status: remote.status,
          subtotalCents,
          deliveryFeeCents: remote.deliveryFeeCents,
          totalCents: remote.totalCents,
          platformFeeCents: remote.platformFeeCents,
          processingFeeCents: remote.processingFeeCents,
          flatFeeCents: remote.flatFeeCents,
          netCents,
          notes: remote.notes ?? null,
          placedAt: remote.placedAt,
          paymentMethod: remote.paymentMethod ?? null,
          deliveryBy: remote.deliveryBy ?? null,
          ...stampStatusTimestamp(remote.status),
        },
      });

      for (const it of remote.items) {
        const matched = await tx.menuItem.findFirst({
          where: {
            organizationId: ctx.organizationId,
            storeId: ctx.storeId,
            platformConfigs: { some: { platformId: ctx.platformId, externalId: it.externalId } },
          },
          select: { id: true },
        });

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: matched?.id ?? null,
            externalId: it.externalId,
            nameSnapshot: it.name,
            qty: it.qty,
            unitPriceCents: it.unitPriceCents,
            totalCents: it.totalCents,
            notes: it.notes ?? null,
          },
        });

        if (it.modifiers) {
          for (const m of it.modifiers) {
            await tx.orderItemModifier.create({
              data: {
                orderItemId: orderItem.id,
                modifierId: null,
                externalId: m.externalId,
                nameSnapshot: m.name,
                qty: m.qty,
                unitPriceCents: m.unitPriceCents,
              },
            });
          }
        }
      }

      await tx.orderStatusEvent.create({
        data: { orderId: order.id, status: remote.status, source: 'platform', metadata: { eventType } },
      });

      return order;
    });

    this.emit('order.created', ctx, created);

    // Catch-up: webhook trouxe o pedido já com status delivered. Baixa estoque.
    if (created.status === 'delivered') {
      await this.consumeStockSafely(created.id);
    }

    // Notifica owners e managers da org sobre o novo pedido.
    const targets = await this.prisma.membership.findMany({
      where: { organizationId: ctx.organizationId, role: { in: ['owner', 'manager'] } },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const t of targets) {
      await this.notifications.create({
        userId: t.userId,
        organizationId: ctx.organizationId,
        kind: 'new_order',
        title: `Novo pedido — ${ctx.platformCode}`,
        body: `R$ ${(created.totalCents / 100).toFixed(2)} • ${remote.customer.name}`,
        linkUrl: `/hub/orders/${created.id}`,
      });
    }
  }

  private async userTransition(
    auth: AuthContext,
    id: string,
    next: OrderStatus,
    sideEffect?: (
      adapter: ReturnType<AdapterRegistry['get']>,
      tokens: NonNullable<Awaited<ReturnType<IntegrationsService['getTokens']>>>,
      externalMerchantId: string,
      externalOrderId: string,
      order: { deliveryBy: string | null },
    ) => Promise<void>,
    reason?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!order) throw new NotFoundException('order_not_found');

    let nextStatus: OrderStatus;
    try {
      nextStatus = transition(order.status, next);
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    if (sideEffect) {
      const connection = await this.prisma.platformConnection.findFirst({
        where: {
          organizationId: auth.orgId,
          storeId: order.storeId,
          platformId: order.platformId,
          status: 'active',
        },
      });
      if (connection?.externalMerchantId) {
        const tokens = await this.integrations.getTokens(connection.id);
        if (tokens) {
          const adapter = this.registry.get(order.platform.code as PlatformCode);
          try {
            await sideEffect(
              adapter,
              tokens,
              connection.externalMerchantId,
              order.externalId,
              order,
            );
          } catch (err) {
            this.logger.error(
              { err, orderId: order.id, next },
              'order_transition_side_effect_failed',
            );
            // Não bloqueia a transição local — operador vê estado local atualizado
            // e o sino acende um aviso de erro de plataforma.
          }
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        cancellationReason: nextStatus === 'cancelled' ? (reason ?? null) : undefined,
        ...stampStatusTimestamp(nextStatus),
      },
      include: { platform: true },
    });

    await this.recordStatusEvent(order.id, nextStatus, 'user', {
      actorUserId: auth.userId,
      reason,
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'order',
      entityId: order.id,
      action: 'update',
      diff: { from: order.status, to: nextStatus, reason },
    });

    // Baixa de estoque idempotente quando o pedido vira "delivered".
    if (nextStatus === 'delivered' && order.status !== 'delivered') {
      await this.consumeStockSafely(order.id);
    }

    this.emit(
      'order.updated',
      {
        platformCode: order.platform.code as PlatformCode,
        storeId: order.storeId,
        organizationId: order.organizationId,
      },
      updated,
    );

    return updated;
  }

  private async recordStatusEvent(
    orderId: string,
    status: OrderStatus,
    source: 'platform' | 'user' | 'system',
    metadata?: { eventType?: string; actorUserId?: string; reason?: string },
  ) {
    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        status,
        source,
        actorUserId: metadata?.actorUserId ?? null,
        metadata: metadata as never,
      },
    });
  }

  private emit(
    event: 'order.created' | 'order.updated',
    ctx: { organizationId: string; storeId: string; platformCode: PlatformCode },
    order: {
      id: string;
      status: OrderStatus;
      externalId: string;
      totalCents: number;
      netCents: number;
      placedAt: Date;
    },
  ) {
    const payload: OrderEventPayload = {
      event,
      organizationId: ctx.organizationId,
      storeId: ctx.storeId,
      orderId: order.id,
      status: order.status,
      externalId: order.externalId,
      platformCode: ctx.platformCode,
      totalCents: order.totalCents,
      netCents: order.netCents,
      placedAt: order.placedAt,
    };
    this.emitter.emit(payload);
  }
}

function stampStatusTimestamp(status: OrderStatus): Record<string, Date | null> {
  const now = new Date();
  switch (status) {
    case 'accepted':
      return { acceptedAt: now };
    case 'dispatched':
      return { dispatchedAt: now };
    case 'delivered':
      return { deliveredAt: now };
    case 'cancelled':
      return { cancelledAt: now };
    default:
      return {};
  }
}
