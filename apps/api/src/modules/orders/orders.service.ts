import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DidifoodAdapter, type DidifoodDeliveryStatus } from '@deliveryhub/didifood';
import type { PlatformCode } from '@deliveryhub/shared';
import { ifoodEventStatus, type RemoteOrder, type StoredTokens } from '@deliveryhub/ifood';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
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
    private readonly crypto: CryptoService,
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
    eventMetadata?: Record<string, unknown>,
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

    // iFood: o status é dirigido por EVENTO (o detalhe do pedido não tem
    // campo status). Aplica o status do eventType; eventos que não mexem no
    // status (grupo DELIVERY) retornam null e não alteram o pedido.
    if (platformCode === 'ifood') {
      const evStatus = ifoodEventStatus(eventType);
      if (evStatus) remote.status = evStatus;
    }

    await this.upsertOrder(ctx, remote, eventType);

    // Eventos DELIVERY do iFood (ASSIGN_DRIVER) trazem o entregador no
    // metadata — o pedido em si não muda, só anotamos quem está entregando.
    // Falha aqui PROPAGA de propósito: o poller não dá ack e o iFood
    // reentrega o evento (upsert acima é idempotente) — engolir o erro
    // perderia o entregador pra sempre.
    const courierName =
      typeof eventMetadata?.workerName === 'string' ? eventMetadata.workerName : undefined;
    if (courierName) {
      const updated = await this.prisma.order.update({
        where: {
          platformId_externalId: {
            platformId: ctx.platformId,
            externalId: remote.externalId,
          },
        },
        data: { courierName },
      });
      this.emit(
        'order.updated',
        { organizationId: ctx.organizationId, storeId: ctx.storeId, platformCode },
        updated,
      );
    }
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

  // ============== Simulação de pedidos para teste/sandbox ==============

  async simulateOrder(
    auth: AuthContext,
    platformCodeInput?: string,
    storeIdInput?: string,
  ) {
    const store = storeIdInput
      ? await this.prisma.store.findFirst({ where: { id: storeIdInput, organizationId: auth.orgId } })
      : await this.prisma.store.findFirst({ where: { organizationId: auth.orgId } });
    if (!store) throw new NotFoundException('store_not_found');

    // Determina qual plataforma simular
    let chosenPlatformCode: PlatformCode;
    if (platformCodeInput && platformCodeInput !== 'auto') {
      chosenPlatformCode = platformCodeInput as PlatformCode;
    } else {
      // Busca todas as conexões configuradas para a loja
      const connections = await this.prisma.platformConnection.findMany({
        where: { organizationId: auth.orgId, storeId: store.id },
        include: { platform: true },
      });

      let candidateCodes = connections
        .filter((c) => c.status === 'active')
        .map((c) => c.platform.code as PlatformCode);

      if (candidateCodes.length === 0 && connections.length > 0) {
        candidateCodes = connections.map((c) => c.platform.code as PlatformCode);
      }

      if (candidateCodes.length === 0) {
        const allPlatforms = await this.prisma.platform.findMany({ where: { active: true } });
        candidateCodes = allPlatforms.map((p) => p.code as PlatformCode);
      }

      // Alterna inteligentemente evitando repetir a mesma plataforma do último pedido simulado
      const lastSimulated = await this.prisma.order.findFirst({
        where: { storeId: store.id, externalId: { startsWith: 'sim-' } },
        orderBy: { placedAt: 'desc' },
        include: { platform: true },
      });

      const alternatives = candidateCodes.filter(
        (code) => candidateCodes.length <= 1 || code !== lastSimulated?.platform?.code,
      );
      chosenPlatformCode = alternatives[Math.floor(Math.random() * alternatives.length)] ?? candidateCodes[0]!;
    }

    const platform = await this.prisma.platform.findUnique({
      where: { code: chosenPlatformCode },
    });
    if (!platform) throw new NotFoundException('platform_not_found');

    let connection = await this.prisma.platformConnection.findFirst({
      where: { organizationId: auth.orgId, storeId: store.id, platformId: platform.id },
    });

    if (!connection || connection.status !== 'active' || connection.lastErrorMessage) {
      connection = await this.prisma.platformConnection.upsert({
        where: { storeId_platformId: { storeId: store.id, platformId: platform.id } },
        update: {
          status: 'active',
          externalMerchantId: connection?.externalMerchantId ?? `sim-merchant-${chosenPlatformCode}`,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
        create: {
          organizationId: auth.orgId,
          storeId: store.id,
          platformId: platform.id,
          status: 'active',
          externalMerchantId: `sim-merchant-${chosenPlatformCode}`,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
    }

    const ctx = {
      platformId: platform.id,
      platformCode: chosenPlatformCode,
      storeId: store.id,
      organizationId: auth.orgId,
      externalMerchantId: connection.externalMerchantId ?? `sim-merchant-${chosenPlatformCode}`,
      connectionId: connection.id,
    };

    const customerPool = [
      'Gabriel Souza',
      'Ana Oliveira',
      'Carlos Silva',
      'Lucas Santos',
      'Mariana Costa',
      'Camila Rocha',
      'Felipe Almeida',
      'Beatriz Lima',
      'Juliana Mendes',
      'Rodrigo Nogueira',
      'Fernanda Ribeiro',
      'Diego Martins',
      'Larissa Carvalho',
      'Thiago Barbosa',
      'Aline Ferreira',
      'Matheus Duarte',
      'Priscila Gomes',
      'Bruno Castro',
      'Renata Guimarães',
      'Vinicius Ramos',
    ];
    const customerName = customerPool[Math.floor(Math.random() * customerPool.length)]!;

    // Vários cardápios temáticos realistas para simulação rica e autêntica
    const simulatedMenus = [
      // 1. Hamburgueria
      [
        { name: 'Smash Burger Duplo c/ Cheddar e Bacon', priceCents: 3690 },
        { name: 'Batata Rústica c/ Alecrim e Parmesão', priceCents: 1800 },
        { name: 'Maionese Especial Defumada (50g)', priceCents: 500 },
        { name: 'Refrigerante Coca-Cola Lata 350ml', priceCents: 790 },
      ],
      // 2. Pizzaria
      [
        { name: 'Pizza Média Calabresa Especial com Catupiry', priceCents: 5890 },
        { name: 'Borda Recheada de Queijo Cheddar', priceCents: 1200 },
        { name: 'Guaraná Antarctica 2L Gelado', priceCents: 1400 },
      ],
      // 3. Churros & Sobremesas (especial ChurrosDaSofia!)
      [
        { name: 'Churros Gourmet Doce de Leite c/ Morangos Frescos', priceCents: 1750 },
        { name: 'Churros Tradicional Canela e Açúcar (3 Unidades)', priceCents: 2100 },
        { name: 'Mini Churros com Nutella (Caixa com 6)', priceCents: 2600 },
        { name: 'Café Espresso Gourmet 100ml', priceCents: 850 },
      ],
      // 4. Comida Japonesa & Poke
      [
        { name: 'Poke Salmão Fresh Completo c/ Cream Cheese e Gergelim', priceCents: 5490 },
        { name: 'Hot Roll de Salmão c/ Tarê e Cebolinha (8 Unidades)', priceCents: 2900 },
        { name: 'Chá Gelado Natural de Pêssego 450ml', priceCents: 950 },
      ],
      // 5. Açaí & Saudável
      [
        { name: 'Açaí Puro Artesanal 500ml (Granola, Banana, Leite Ninho)', priceCents: 2890 },
        { name: 'Creme de Frutas Vermelhas 300ml', priceCents: 1900 },
        { name: 'Água Mineral sem Gás 500ml', priceCents: 500 },
      ],
      // 6. Almoço & Pratos Executivos
      [
        { name: 'Prato Executivo Picanha Fatiada c/ Arroz, Feijão e Fritas', priceCents: 4790 },
        { name: 'Porção Extra de Farofa Crocante', priceCents: 650 },
        { name: 'Suco Natural de Laranja 500ml', priceCents: 1100 },
      ],
    ];

    const menuItems = await this.prisma.menuItem.findMany({
      where: { storeId: store.id },
      take: 6,
    });

    let items: Array<{
      externalId: string;
      name: string;
      qty: number;
      unitPriceCents: number;
      totalCents: number;
    }>;

    if (menuItems.length >= 2) {
      // Embaralha itens reais da loja e escolhe de 1 a 3 itens
      const shuffled = [...menuItems].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
      items = selected.map((m, idx) => {
        const qty = idx === 0 && Math.random() > 0.6 ? 2 : 1;
        const unitPrice = m.costCents ? Math.round(m.costCents * 2.4) : 2800;
        return {
          externalId: `sim-item-${m.id}`,
          name: m.name,
          qty,
          unitPriceCents: unitPrice,
          totalCents: qty * unitPrice,
        };
      });
    } else {
      // Sorteia um dos cardápios temáticos (ou usa o tema da loja se o nome indicar)
      let chosenMenu = simulatedMenus[Math.floor(Math.random() * simulatedMenus.length)]!;
      if (store.name.toLowerCase().includes('churros')) {
        chosenMenu = simulatedMenus[2]!;
      } else if (store.name.toLowerCase().includes('pizza')) {
        chosenMenu = simulatedMenus[1]!;
      } else if (store.name.toLowerCase().includes('burger')) {
        chosenMenu = simulatedMenus[0]!;
      }
      const count = Math.min(chosenMenu.length, Math.floor(Math.random() * 2) + 2); // 2 ou 3 itens
      const selected = [...chosenMenu].sort(() => 0.5 - Math.random()).slice(0, count);
      items = selected.map((it, idx) => {
        const qty = idx === 0 && Math.random() > 0.65 ? 2 : 1;
        return {
          externalId: `sim-item-${Date.now()}-${idx}`,
          name: it.name,
          qty,
          unitPriceCents: it.priceCents,
          totalCents: qty * it.priceCents,
        };
      });
    }

    const subtotalCents = items.reduce((acc, it) => acc + it.totalCents, 0);

    const deliveryFees = [0, 590, 790, 890, 1190];
    const deliveryFeeCents = deliveryFees[Math.floor(Math.random() * deliveryFees.length)]!;
    const totalCents = subtotalCents + deliveryFeeCents;

    const realisticNotes = [
      'Favor não colocar cebola nem picles.',
      'Ponto da carne: ao ponto para bem passada.',
      'Entregar na portaria com o porteiro Silva.',
      'Enviar sachês extras de maionese verde e ketchup.',
      'Campainha quebrada, favor interfonar no ap 402.',
      'Caprichar no recheio por favor!',
      'Massa bem assada e crocante, por favor.',
      null,
      null,
      null,
    ];
    const notes = realisticNotes[Math.floor(Math.random() * realisticNotes.length)];

    const paymentMethods = ['online', 'online', 'online', 'cash'];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)]!;

    // Gera número único de ticket realista de 5 dígitos (ex: 41829)
    const randomTicket = Math.floor(10000 + Math.random() * 90000);

    const feeRates: Record<string, { platform: number; processing: number }> = {
      ifood: { platform: 0.12, processing: 0.03 },
      keeta: { platform: 0.10, processing: 0.025 },
      '99food': { platform: 0.12, processing: 0.03 },
      rappi: { platform: 0.14, processing: 0.032 },
      aiqfome: { platform: 0.12, processing: 0.028 },
    };
    const rate = feeRates[chosenPlatformCode] ?? { platform: 0.12, processing: 0.03 };

    const remote: RemoteOrder = {
      externalId: `sim-${chosenPlatformCode}-${randomTicket}`,
      externalMerchantId: ctx.externalMerchantId,
      status: 'placed',
      customer: {
        name: customerName,
        phone: '+55119' + Math.floor(10000000 + Math.random() * 90000000),
        document: String(Math.floor(10000000000 + Math.random() * 90000000000)),
      },
      items,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      platformFeeCents: Math.round(totalCents * rate.platform),
      processingFeeCents: Math.round(totalCents * rate.processing),
      flatFeeCents: 0,
      notes: notes ?? undefined,
      placedAt: new Date(),
      paymentMethod: paymentMethod as 'online' | 'cash',
      deliveryBy: 'platform',
      orderTiming: 'immediate',
      orderType: 'delivery',
    };

    await this.upsertOrder(ctx, remote, 'order.simulate');
    return {
      success: true,
      externalOrderId: remote.externalId,
      platformCode: chosenPlatformCode,
      platformName: platform.name,
      totalCents,
      customerName,
    };
  }

  /** Simula 1 pedido para cada uma das plataformas integradas da loja em lote. */
  async simulateAllIntegrated(auth: AuthContext, storeIdInput?: string) {
    const store = storeIdInput
      ? await this.prisma.store.findFirst({ where: { id: storeIdInput, organizationId: auth.orgId } })
      : await this.prisma.store.findFirst({ where: { organizationId: auth.orgId } });
    if (!store) throw new NotFoundException('store_not_found');

    const connections = await this.prisma.platformConnection.findMany({
      where: { organizationId: auth.orgId, storeId: store.id },
      include: { platform: true },
    });

    let platforms = connections.map((c) => c.platform.code);
    if (platforms.length === 0) {
      const all = await this.prisma.platform.findMany({ where: { active: true } });
      platforms = all.map((p) => p.code);
    }

    const results = [];
    for (const code of platforms) {
      const res = await this.simulateOrder(auth, code, store.id);
      results.push(res);
    }
    return { success: true, count: results.length, orders: results };
  }

  /** Remove todos os pedidos simulados (de teste) da organização. */
  async clearSimulatedOrders(auth: AuthContext) {
    const result = await this.prisma.order.deleteMany({
      where: {
        organizationId: auth.orgId,
        externalId: { startsWith: 'sim-' },
      },
    });
    return { count: result.count };
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
        hiddenAt: null,
      },
      orderBy: { placedAt: 'desc' },
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      include: {
        platform: { select: { code: true, name: true, colorHex: true } },
        customer: { select: { id: true, name: true } },
        items: query.withItems !== false
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

  async hide(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('order_not_found');
    return this.prisma.order.update({ where: { id }, data: { hiddenAt: new Date() } });
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

    if (order.customer?.phone && this.crypto.isCiphertext(order.customer.phone)) {
      try {
        order.customer.phone = this.crypto.decrypt(order.customer.phone);
      } catch {
        // Se a chave não puder decifrar, oculta o cipher para evitar vazamento visual
        order.customer.phone = null;
      }
    }

    return order;
  }

  // ============== Ações do operador ==============

  async accept(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'accepted', async (adapter, tokens, merchantId, ext) => {
      await adapter.acceptOrder(tokens, merchantId, ext);
    });
  }

  async startPreparing(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'preparing', async (adapter, tokens, merchantId, ext) => {
      // iFood exige a transição startPreparation pra homologação Order.
      // Outros adapters não têm o conceito — ignora se o método não existe.
      if (adapter.startPreparation) {
        await adapter.startPreparation(tokens, merchantId, ext);
      }
    });
  }

  async markReady(auth: AuthContext, id: string) {
    return this.userTransition(auth, id, 'ready', async (adapter, tokens, merchantId, ext) => {
      // iFood exige readyToPickup quando a entrega é do próprio iFood.
      // Outros adapters ignoram (rastro só local).
      if (adapter.readyToPickup) {
        await adapter.readyToPickup(tokens, merchantId, ext);
      }
    });
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
   * Posição do entregador da plataforma (quando ela expõe rastreio — hoje
   * só o iFood, via GET /orders/{id}/tracking). Devolve o entregador salvo
   * no pedido + lat/lng ao vivo (`tracking: null` = sem rastreio ativo).
   */
  async getTracking(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!order) throw new NotFoundException('order_not_found');

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      order.storeId,
      order.platformId,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(order.platform.code as PlatformCode);
    if (!adapter.fetchOrderTracking) {
      throw new BadRequestException('tracking_unsupported');
    }

    const tracking = await adapter.fetchOrderTracking(
      conn.tokens,
      conn.externalMerchantId,
      order.externalId,
    );

    return {
      orderId: order.id,
      courierName: order.courierName,
      courierPhone: order.courierPhone,
      tracking,
    };
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

  /**
   * Piloto automático do iFood (SÓ homologação, gated por env no poller):
   * reage aos pedidos sem humano — placed → confirm; depois dispatch (entrega
   * da loja) ou readyToPickup (retirada / logística iFood), SEGURANDO pedido
   * agendado até a janela de entrega. Avança UMA transição por ciclo (30s),
   * o que separa confirm de dispatch e dá tempo pra um cancelamento do iFood
   * chegar antes do despacho.
   */
  async runIfoodAutopilot(
    externalMerchantId: string,
    adapter: ReturnType<AdapterRegistry['get']>,
    tokens: StoredTokens,
  ): Promise<void> {
    const ctx = await this.resolveContext('ifood', externalMerchantId);
    if (!ctx) return;

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: ctx.storeId,
        platformId: ctx.platformId,
        status: { in: ['placed', 'accepted', 'preparing', 'ready'] },
      },
      select: {
        id: true,
        externalId: true,
        status: true,
        orderTiming: true,
        orderType: true,
        deliveryBy: true,
        scheduledDeliveryAt: true,
      },
    });

    const now = Date.now();
    for (const o of orders) {
      try {
        if (o.status === 'placed') {
          await adapter.acceptOrder(tokens, externalMerchantId, o.externalId);
          await this.applyAutopilotStatus(ctx, o.id, 'accepted');
          continue;
        }
        // Agendado: segura tudo até a janela de entrega.
        if (
          o.orderTiming === 'scheduled' &&
          o.scheduledDeliveryAt &&
          now < o.scheduledDeliveryAt.getTime()
        ) {
          continue;
        }
        const merchantDelivery = o.deliveryBy === 'store';
        const isDelivery = (o.orderType ?? 'delivery') === 'delivery';
        if (isDelivery && merchantDelivery) {
          // Entrega própria: despacha (POST /dispatch).
          await adapter.dispatchOrder(tokens, externalMerchantId, o.externalId);
          await this.applyAutopilotStatus(ctx, o.id, 'dispatched');
        } else if (adapter.readyToPickup && o.status !== 'ready') {
          // Retirada ou logística iFood: marca pronto pra coleta.
          await adapter.readyToPickup(tokens, externalMerchantId, o.externalId);
          await this.applyAutopilotStatus(ctx, o.id, 'ready');
        }
      } catch (err) {
        this.logger.warn({ err, orderId: o.id }, 'ifood_autopilot_action_failed');
      }
    }
  }

  private async applyAutopilotStatus(
    ctx: { organizationId: string; storeId: string },
    orderId: string,
    status: OrderStatus,
  ): Promise<void> {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status, ...stampStatusTimestamp(status) },
    });
    await this.recordStatusEvent(orderId, status, 'system', { eventType: 'autopilot' });
    this.emit(
      'order.updated',
      { organizationId: ctx.organizationId, storeId: ctx.storeId, platformCode: 'ifood' },
      order,
    );
  }

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
          orderTiming: remote.orderTiming ?? undefined,
          orderType: remote.orderType ?? undefined,
          scheduledDeliveryAt: remote.schedule?.deliveryStart ?? undefined,
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
          orderTiming: remote.orderTiming ?? null,
          orderType: remote.orderType ?? null,
          scheduledDeliveryAt: remote.schedule?.deliveryStart ?? null,
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
          select: { id: true, costCents: true },
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
            costCentsSnapshot: matched?.costCents ?? null,
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
        linkUrl: `/hub?order=${created.id}`,
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
            // Cancelamento e fail-closed: se a plataforma recusou/falhou o pedido de
            // cancelamento, NAO grava 'cancelled' local (evitaria dessincronia com a
            // plataforma). As demais transicoes seguem local-first (o sino acende um
            // aviso de erro de plataforma).
            if (next === 'cancelled') {
              throw new BadRequestException('platform_cancellation_failed');
            }
          }
        }
      }
    }

    // Compare-and-swap sobre o status lido ANTES do side-effect: se um evento da
    // plataforma mudou o pedido durante o side-effect, nao sobrescreve (last-writer-wins)
    // — devolve 409 e o operador reavalia. (order-status.ts ja bloqueia retrocessos.)
    const swap = await this.prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: nextStatus,
        cancellationReason: nextStatus === 'cancelled' ? (reason ?? null) : undefined,
        ...stampStatusTimestamp(nextStatus),
      },
    });
    if (swap.count === 0) {
      throw new ConflictException('order_status_changed');
    }
    const updated = await this.prisma.order.findFirstOrThrow({
      where: { id: order.id },
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
