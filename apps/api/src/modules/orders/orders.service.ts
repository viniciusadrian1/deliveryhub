import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';
import type { RemoteOrder } from '@deliveryhub/ifood';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CustomersService } from './customers.service.js';
import type { ListOrdersQuery } from './dto/orders.dto.js';
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
  ) {}

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

  // ============== Listagem & detalhe ==============

  async list(auth: AuthContext, query: ListOrdersQuery) {
    return this.prisma.order.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        status: query.status ?? undefined,
        placedAt: query.since ? { gte: query.since } : undefined,
      },
      orderBy: { placedAt: 'desc' },
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      include: {
        platform: { select: { code: true, name: true, colorHex: true } },
        customer: { select: { id: true, name: true } },
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
    return this.userTransition(auth, id, 'delivered');
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
          ...stampStatusTimestamp(newStatus),
        },
      });
      if (newStatus !== existing.status) {
        await this.recordStatusEvent(order.id, newStatus, 'platform', { eventType });
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
            await sideEffect(adapter, tokens, connection.externalMerchantId, order.externalId);
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
