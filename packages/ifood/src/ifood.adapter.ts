import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  AdapterApiError,
  ConnectionPendingError,
  type CreatePromotionInput,
  type CreatePromotionResult,
  type FinalizeConnectionResult,
  type PlatformAdapter,
  type PolledEvent,
  type PushCategoryInput,
  type PushCategoryResult,
  type PushItemInput,
  type PushItemResult,
  type RemoteCatalog,
  type RemoteInterruption,
  type RemoteMerchantStatus,
  type RemoteOrderTracking,
  type RemotePromotionItem,
  type RemoteSettlement,
  type StartConnectionResult,
  type StoredTokens,
} from './adapter.interface.js';

/**
 * Configuração do IFoodAdapter — injetada pela camada de aplicação a partir do env.
 * Os endpoints seguem o iFood Merchant API v1 (developer.ifood.com.br).
 *
 * Quando a Anthropic AppSec aprovar a conta parceiro, validar:
 * - clientId/clientSecret reais
 * - endpoint base (merchant-api.ifood.com.br em produção,
 *   merchant-api-sandbox.ifood.com.br em sandbox)
 * - webhookSecret para HMAC nos webhooks
 */
export interface IFoodAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

interface PendingHandlePayload {
  authorizationCodeVerifier: string;
}

interface UserCodeResponse {
  userCode: string;
  authorizationCodeVerifier: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Hook opcional pra logar requests (injetado pela camada de aplicação).
 * Não logamos `body` por padrão pra evitar vazar dados pessoais.
 */
export interface IFoodRequestLogger {
  (info: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ok: boolean;
  }): void;
}

export class IFoodAdapter implements PlatformAdapter {
  readonly code = 'ifood' as const;
  private readonly log?: IFoodRequestLogger;

  constructor(
    private readonly config: IFoodAdapterConfig,
    options: { log?: IFoodRequestLogger } = {},
  ) {
    this.log = options.log;
  }

  async startConnection(): Promise<StartConnectionResult> {
    const body = new URLSearchParams({ clientId: this.config.clientId });
    const data = await this.postForm<UserCodeResponse>('/authentication/v1.0/oauth/userCode', body);

    const handle = encodeHandle({ authorizationCodeVerifier: data.authorizationCodeVerifier });
    const expiresAt = new Date(Date.now() + data.expiresIn * 1000);

    return {
      userCode: data.userCode,
      verificationUrl: data.verificationUrl,
      verificationUrlComplete: data.verificationUrlComplete,
      expiresAt,
      pendingHandle: handle,
    };
  }

  async finalizeConnection(
    pendingHandle: string,
    authorizationCode?: string,
  ): Promise<FinalizeConnectionResult> {
    if (!authorizationCode) {
      // Device flow do iFood: o usuário recebe um authorizationCode ao
      // autorizar no portal. Sem ele, o /oauth/token não emite os tokens.
      throw new AdapterApiError('ifood_authorization_code_required', 400);
    }
    const { authorizationCodeVerifier } = decodeHandle(pendingHandle);
    const body = new URLSearchParams({
      grantType: 'authorization_code',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      authorizationCode,
      authorizationCodeVerifier,
    });

    let tokens: TokenResponse;
    try {
      tokens = await this.postForm<TokenResponse>('/authentication/v1.0/oauth/token', body);
    } catch (err) {
      if (err instanceof AdapterApiError && err.status === 400) {
        // iFood retorna 400 enquanto o user-code ainda não foi confirmado pelo usuário.
        throw new ConnectionPendingError();
      }
      throw err;
    }

    const stored: StoredTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };

    const merchantId = await this.fetchFirstMerchantId(stored);

    return { tokens: stored, externalMerchantId: merchantId };
  }

  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    const body = new URLSearchParams({
      grantType: 'refresh_token',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken,
    });
    const data = await this.postForm<TokenResponse>('/authentication/v1.0/oauth/token', body);
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date(Date.now() + data.expiresIn * 1000),
    };
  }

  async fetchMenu(tokens: StoredTokens, merchantId: string) {
    interface RawCategory {
      id: string;
      name: string;
      sortOrder?: number;
      items?: RawItem[];
    }
    interface RawItem {
      id: string;
      categoryId?: string;
      name: string;
      description?: string;
      priceCents?: number;
      price?: { value: number };
      status?: 'AVAILABLE' | 'UNAVAILABLE';
      isPublished?: boolean;
      imageUrl?: string;
      externalCode?: string;
    }

    const data = await this.get<{ categories: RawCategory[] }>(
      `/catalog/v2.0/merchants/${merchantId}/catalog`,
      tokens,
    );

    const categories = data.categories.map((c) => ({
      externalId: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    }));

    const items = data.categories.flatMap((c) =>
      (c.items ?? []).map((it) => ({
        externalId: it.id,
        externalCode: it.externalCode,
        externalCategoryId: it.categoryId ?? c.id,
        name: it.name,
        description: it.description,
        sellingPriceCents:
          typeof it.priceCents === 'number' && Number.isFinite(it.priceCents)
            ? it.priceCents
            : cents(it.price),
        isAvailable: (it.status ?? 'AVAILABLE') === 'AVAILABLE',
        isPublished: it.isPublished ?? true,
        imageUrl: it.imageUrl,
      })),
    );

    return { categories, items };
  }

  async fetchOrder(tokens: StoredTokens, merchantId: string, externalOrderId: string) {
    interface RawCustomer {
      name?: unknown;
      // iFood às vezes manda telefone/doc como objeto ({number}) ou número —
      // por isso `unknown` + coerção (coerceStr) em vez de string direta.
      phone?: unknown;
      taxPayerIdentificationNumber?: unknown;
      documentNumber?: unknown;
    }
    interface RawOrderItem {
      id: string;
      externalCode?: string;
      categoryId?: string;
      name: string;
      quantity: number;
      unitPrice?: { value: number };
      totalPrice?: { value: number };
      observations?: string;
      options?: Array<{
        id: string;
        name: string;
        quantity: number;
        price?: { value: number };
      }>;
    }
    interface RawOrder {
      id: string;
      merchantId?: string;
      status: string;
      customer?: RawCustomer;
      items: RawOrderItem[];
      total?: {
        subTotal?: { value: number };
        deliveryFee?: { value: number };
        orderAmount?: { value: number };
      };
      payments?: {
        prepaid?: { value: number };
      };
      benefits?: Array<{ value?: { value: number } }>;
      observations?: string;
      createdAt?: string;
      placedAt?: string;
      // Agendamento / modalidade / logística.
      orderTiming?: string; // IMMEDIATE | SCHEDULED
      orderType?: string; // DELIVERY | TAKEOUT | INDOOR | DINE_IN
      preparationStartDateTime?: string;
      schedule?: {
        deliveryDateTimeStart?: string;
        deliveryDateTimeEnd?: string;
      };
      delivery?: { deliveredBy?: string }; // MERCHANT | IFOOD
    }

    const data = await this.get<RawOrder>(
      `/order/v1.0/orders/${externalOrderId}`,
      tokens,
    );

    return {
      externalId: data.id,
      externalMerchantId: data.merchantId ?? merchantId,
      status: mapIFoodStatus(data.status),
      customer: {
        name: coerceStr(data.customer?.name) ?? 'Cliente',
        phone: coerceStr(data.customer?.phone),
        document:
          coerceStr(data.customer?.documentNumber) ??
          coerceStr(data.customer?.taxPayerIdentificationNumber),
      },
      items: (data.items ?? []).map((it) => ({
        externalId: it.id,
        externalCategoryId: it.categoryId,
        name: it.name,
        qty: it.quantity ?? 1,
        unitPriceCents: cents(it.unitPrice),
        totalCents: cents(it.totalPrice),
        notes: it.observations,
        modifiers: it.options?.map((o) => ({
          externalId: o.id,
          name: o.name,
          qty: o.quantity ?? 1,
          unitPriceCents: cents(o.price),
        })),
      })),
      subtotalCents: cents(data.total?.subTotal),
      deliveryFeeCents: cents(data.total?.deliveryFee),
      totalCents: cents(data.total?.orderAmount),
      platformFeeCents: 0, // iFood não devolve breakdown — calculamos pelo fee profile
      processingFeeCents: 0,
      flatFeeCents: 0,
      notes: data.observations,
      placedAt: new Date(data.placedAt ?? data.createdAt ?? Date.now()),
      orderTiming: (data.orderTiming?.toUpperCase() === 'SCHEDULED'
        ? 'scheduled'
        : 'immediate') as 'scheduled' | 'immediate',
      orderType: mapIFoodOrderType(data.orderType),
      // deliveredBy MERCHANT = entrega da loja; senão logística iFood.
      deliveryBy: (data.delivery?.deliveredBy?.toUpperCase() === 'MERCHANT'
        ? 'store'
        : 'platform') as 'store' | 'platform',
      schedule: data.schedule?.deliveryDateTimeStart
        ? {
            deliveryStart: new Date(data.schedule.deliveryDateTimeStart),
            deliveryEnd: data.schedule.deliveryDateTimeEnd
              ? new Date(data.schedule.deliveryDateTimeEnd)
              : undefined,
          }
        : undefined,
    };
  }

  parseWebhook(payload: unknown) {
    interface RawWebhook {
      id?: string;
      code?: string;
      fullCode?: string;
      orderId?: string;
      merchantId?: string;
      createdAt?: string;
    }
    const p = payload as RawWebhook;
    if (!p.id || !p.orderId || !p.merchantId) {
      throw new AdapterApiError('invalid_webhook_payload', 400, payload);
    }
    return {
      eventId: p.id,
      eventType: p.fullCode ?? p.code ?? 'UNKNOWN',
      externalOrderId: p.orderId,
      externalMerchantId: p.merchantId,
      occurredAt: new Date(p.createdAt ?? Date.now()),
    };
  }

  /**
   * Lista eventos pendentes para esta credencial. iFood usa o conceito de
   * "grupos" pra filtrar (ORDER_STATUS, KEEP_ALIVE, etc.) — pedimos
   * apenas ORDER_STATUS pra economizar processamento. Resposta:
   *
   *   [
   *     { id: "evt-...", code: "PLC", fullCode: "PLACED",
   *       orderId: "...", merchantId: "...", createdAt: "ISO" },
   *     ...
   *   ]
   *
   * Array vazio é resposta válida (sem eventos novos).
   */
  async pollEvents(tokens: StoredTokens, _merchantId: string): Promise<PolledEvent[]> {
    interface RawEvent {
      id?: string;
      code?: string;
      fullCode?: string;
      orderId?: string;
      merchantId?: string;
      createdAt?: string;
      metadata?: Record<string, unknown>;
    }
    // DELIVERY junto do ORDER_STATUS: eventos do entregador iFood
    // (ASSIGN_DRIVER, GOING_TO_ORIGIN, ARRIVED_AT_ORIGIN, ...) chegam no
    // mesmo array; o metadata de ASSIGN_DRIVER traz workerName/vehicleType.
    const data = await this.get<RawEvent[]>(
      '/order/v1.0/events:polling?groups=ORDER_STATUS,DELIVERY',
      tokens,
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is RawEvent & { id: string; orderId: string; merchantId: string } =>
        Boolean(e.id && e.orderId && e.merchantId),
      )
      .map((e) => ({
        eventId: e.id,
        eventType: e.fullCode ?? e.code ?? 'UNKNOWN',
        externalOrderId: e.orderId,
        externalMerchantId: e.merchantId,
        occurredAt: new Date(e.createdAt ?? Date.now()),
        metadata: e.metadata,
      }));
  }

  /**
   * Confirma processamento de eventos. iFood reentrega o mesmo evento em
   * polls subsequentes até o ack chegar — esse passo é obrigatório.
   * Body esperado: array `[{id: "evt-..."}]`.
   */
  async acknowledgeEvents(tokens: StoredTokens, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.post(
      '/order/v1.0/events/acknowledgment',
      tokens,
      eventIds.map((id) => ({ id })),
    );
  }

  async pushItemPrice(
    tokens: StoredTokens,
    merchantId: string,
    externalId: string,
    sellingPriceCents: number,
  ): Promise<void> {
    // Catalog v2: PATCH /items/price com itemId no body (o formato antigo
    // PUT /items/{id}/price era v1 e reprova a homologação).
    await this.patch(`/catalog/v2.0/merchants/${merchantId}/items/price`, tokens, {
      itemId: externalId,
      price: { value: sellingPriceCents / 100 },
    });
  }

  async pushItemAvailability(
    tokens: StoredTokens,
    merchantId: string,
    externalId: string,
    available: boolean,
  ): Promise<void> {
    await this.patch(`/catalog/v2.0/merchants/${merchantId}/items/status`, tokens, {
      itemId: externalId,
      status: available ? 'AVAILABLE' : 'UNAVAILABLE',
    });
  }

  async pushOptionPrice(
    tokens: StoredTokens,
    merchantId: string,
    optionExternalId: string,
    priceCents: number,
  ): Promise<void> {
    await this.patch(`/catalog/v2.0/merchants/${merchantId}/options/price`, tokens, {
      optionId: optionExternalId,
      price: { value: priceCents / 100 },
    });
  }

  async pushOptionAvailability(
    tokens: StoredTokens,
    merchantId: string,
    optionExternalId: string,
    available: boolean,
  ): Promise<void> {
    await this.patch(`/catalog/v2.0/merchants/${merchantId}/options/status`, tokens, {
      optionId: optionExternalId,
      status: available ? 'AVAILABLE' : 'UNAVAILABLE',
    });
  }

  // ================= Catalog (publicação) =================

  async fetchCatalogs(tokens: StoredTokens, merchantId: string): Promise<RemoteCatalog[]> {
    interface RawCatalog {
      catalogId?: string;
      id?: string;
      context?: string[];
      status?: string;
    }
    const data = await this.get<RawCatalog[]>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs`,
      tokens,
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((c) => c.catalogId ?? c.id)
      .map((c) => ({
        catalogId: (c.catalogId ?? c.id)!,
        context: Array.isArray(c.context) ? c.context : [],
        status: c.status,
      }));
  }

  async pushCategory(
    tokens: StoredTokens,
    merchantId: string,
    catalogId: string,
    input: PushCategoryInput,
  ): Promise<PushCategoryResult> {
    // v2 não documenta PATCH de categoria — se já existe na plataforma,
    // devolvemos o id e não mexemos (rename de categoria é caso raro).
    if (input.externalId) return { externalId: input.externalId };

    const data = await this.post<{ id?: string }>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      tokens,
      {
        name: input.name,
        status: 'AVAILABLE',
        template: 'DEFAULT',
        sequence: input.sortOrder ?? 0,
      },
    );
    if (!data?.id) {
      throw new AdapterApiError('ifood_category_create_no_id', 502, data);
    }
    return { externalId: data.id };
  }

  /**
   * Upsert completo do item via `PUT /catalog/v2.0/merchants/{id}/items`.
   *
   * iFood aceita UUIDs gerados pelo cliente; derivamos ids DETERMINÍSTICOS
   * (uuid-v5-like de merchantId + chave local) pra que republicar o mesmo
   * item atualize as mesmas entidades em vez de duplicar produto/opções.
   */
  async pushItem(
    tokens: StoredTokens,
    merchantId: string,
    _catalogId: string,
    input: PushItemInput,
  ): Promise<PushItemResult> {
    const localKey = input.externalCode ?? input.name;
    const itemId = input.externalId ?? deterministicUuid(merchantId, `item:${localKey}`);
    const productId = deterministicUuid(merchantId, `product:${localKey}`);

    interface IFoodProduct {
      id: string;
      name: string;
      description?: string;
      imagePath?: string;
      externalCode?: string;
      optionGroups?: Array<{ id: string; min: number; max: number }>;
    }

    const mainProduct: IFoodProduct = {
      id: productId,
      name: input.name,
      description: input.description,
      imagePath: input.imagePath,
      externalCode: input.externalCode ? `p-${input.externalCode}` : undefined,
      optionGroups: undefined,
    };
    const products: IFoodProduct[] = [mainProduct];
    const optionGroups: Array<{
      id: string;
      name: string;
      status: string;
      index: number;
      optionGroupType: string;
      optionIds: string[];
    }> = [];
    const options: Array<{
      id: string;
      status: string;
      index: number;
      productId: string;
      price: { value: number };
    }> = [];
    const productGroupLinks: Array<{ id: string; min: number; max: number }> = [];

    for (const [gi, group] of (input.modifierGroups ?? []).entries()) {
      const groupKey = `${localKey}:og:${group.externalId ?? group.name}`;
      const ogId = deterministicUuid(merchantId, groupKey);
      const optionIds: string[] = [];

      for (const [oi, opt] of group.options.entries()) {
        const optKey = `${groupKey}:opt:${opt.externalId ?? opt.name}`;
        const optId = deterministicUuid(merchantId, optKey);
        const optProductId = deterministicUuid(merchantId, `${optKey}:prod`);
        optionIds.push(optId);
        // Toda opção no v2 é lastreada por um produto próprio.
        products.push({
          id: optProductId,
          name: opt.name,
          externalCode: opt.externalId ? `po-${opt.externalId}` : undefined,
        });
        options.push({
          id: optId,
          status: opt.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
          index: opt.sortOrder ?? oi,
          productId: optProductId,
          price: { value: opt.priceCents / 100 },
        });
      }

      optionGroups.push({
        id: ogId,
        name: group.name,
        status: 'AVAILABLE',
        index: group.sortOrder ?? gi,
        optionGroupType: 'DEFAULT',
        optionIds,
      });
      productGroupLinks.push({ id: ogId, min: group.minSelect, max: group.maxSelect });
    }

    if (productGroupLinks.length > 0) {
      mainProduct.optionGroups = productGroupLinks;
    }

    await this.put(`/catalog/v2.0/merchants/${merchantId}/items`, tokens, {
      item: {
        id: itemId,
        type: 'DEFAULT',
        categoryId: input.externalCategoryId,
        status: input.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
        price: { value: input.sellingPriceCents / 100 },
        externalCode: input.externalCode,
        index: input.sortOrder ?? 0,
        productId,
      },
      products,
      // Sempre presentes (mesmo vazios): o PUT /items é full-replace — array
      // vazio remove complementos deletados localmente; omitir seria ambíguo.
      optionGroups,
      options,
    });

    return { externalId: itemId, externalCategoryId: input.externalCategoryId };
  }

  async uploadImage(
    tokens: StoredTokens,
    merchantId: string,
    imageDataUri: string,
  ): Promise<string> {
    const data = await this.post<{ path?: string; imagePath?: string } | string>(
      `/catalog/v2.0/merchants/${merchantId}/image/upload`,
      tokens,
      { image: imageDataUri },
    );
    const path = typeof data === 'string' ? data : (data?.path ?? data?.imagePath);
    if (!path) throw new AdapterApiError('ifood_image_upload_no_path', 502, data);
    return path;
  }

  // ================= Financial (repasses oficiais) =================

  /**
   * Settlements = repasses oficiais (Financial v3 — o v2 foi descontinuado
   * em 2025). Filtramos por data de PAGAMENTO e achatamos closingItems.
   * Só tipos REPASSE* interessam pra conciliação bancária (BOLETO etc. são
   * outros movimentos).
   */
  async fetchSettlements(
    tokens: StoredTokens,
    merchantId: string,
    from: Date,
    to: Date,
  ): Promise<RemoteSettlement[]> {
    interface RawClosingItem {
      id?: string;
      type?: string;
      amount?: number;
      status?: string;
      paymentDate?: string;
    }
    interface RawSettlement {
      startDateCalculation?: string;
      endDateCalculation?: string;
      closingItems?: RawClosingItem[];
    }
    // Filtra por data de CALCULO (nao de pagamento): assim cada settlement
    // devolvido traz os closingItems COMPLETOS do periodo, e o agrupamento
    // por periodo no import nunca soma parcial (janela por paymentDate
    // podia cortar um repasse do mesmo periodo pago em outra data).
    const qs = `beginCalculationDate=${toIsoDate(from)}&endCalculationDate=${toIsoDate(to)}`;
    const data = await this.get<{ settlements?: RawSettlement[] }>(
      `/financial/v3.0/merchants/${merchantId}/settlements?${qs}`,
      tokens,
    );

    const out: RemoteSettlement[] = [];
    for (const s of data?.settlements ?? []) {
      if (!s.startDateCalculation || !s.endDateCalculation) continue;
      for (const ci of s.closingItems ?? []) {
        if (ci.type && !ci.type.startsWith('REPASSE')) continue;
        out.push({
          periodStart: new Date(s.startDateCalculation),
          periodEnd: new Date(s.endDateCalculation),
          amountCents: Math.round((ci.amount ?? 0) * 100),
          expectedPayDate: ci.paymentDate ? new Date(ci.paymentDate) : undefined,
          type: ci.type,
          status: ci.status,
          externalId: ci.id,
        });
      }
    }
    return out;
  }

  // ================= Promotion =================

  async createPromotion(
    tokens: StoredTokens,
    merchantId: string,
    input: CreatePromotionInput,
  ): Promise<CreatePromotionResult> {
    const data = await this.post<{ aggregationId?: string }>(
      `/promotion/v1.0/merchants/${merchantId}/promotions`,
      tokens,
      {
        aggregationTag: input.aggregationTag,
        promotions: [
          {
            promotionName: input.name,
            channels: ['IFOOD-APP'],
            items: input.items.map((it) => ({
              ean: it.ean,
              discountValue: it.discountPercent,
              initialDate: toIsoDate(it.startsAt),
              finalDate: toIsoDate(it.endsAt),
              promotionType: 'PERCENTAGE',
            })),
          },
        ],
      },
    );
    if (!data?.aggregationId) {
      throw new AdapterApiError('ifood_promotion_no_aggregation_id', 502, data);
    }
    return { aggregationId: data.aggregationId };
  }

  async fetchPromotionItems(
    tokens: StoredTokens,
    merchantId: string,
    aggregationId: string,
  ): Promise<RemotePromotionItem[]> {
    interface RawPromotionItem {
      ean?: string;
      status?: string;
      error?: string;
    }
    const data = await this.get<{ items?: RawPromotionItem[] } | RawPromotionItem[]>(
      `/promotion/v1.0/merchants/${merchantId}/promotions/${aggregationId}/items`,
      tokens,
    );
    const arr = Array.isArray(data) ? data : (data?.items ?? []);
    return arr.map((it) => ({
      ean: it.ean,
      status: it.status ?? 'PROCESSING',
      error: it.error,
    }));
  }

  // ================= Logistics (rastreio) =================

  async fetchOrderTracking(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrderTracking | null> {
    interface RawTracking {
      latitude?: number;
      longitude?: number;
      expectedDelivery?: string;
      deliveryEtaEnd?: number;
    }
    let data: RawTracking;
    try {
      data = await this.get<RawTracking>(
        `/order/v1.0/orders/${externalOrderId}/tracking`,
        tokens,
      );
    } catch (err) {
      // 404 = sem rastreio ativo (pedido sem entregador iFood no momento).
      if (err instanceof AdapterApiError && err.status === 404) return null;
      throw err;
    }
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') {
      return null;
    }
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
      etaMinutes: data.deliveryEtaEnd,
    };
  }

  async pushStorePause(
    tokens: StoredTokens,
    merchantId: string,
    paused: boolean,
    until?: Date,
    reason?: string,
  ): Promise<void> {
    if (paused) {
      // Pausar = criar interrupcao (POST). O padrao do iFood NAO e um PUT com
      // {resume:true} — isso reprova a homologacao Merchant.
      await this.createInterruption(tokens, merchantId, {
        start: new Date(),
        end: until,
        description: reason,
      });
      return;
    }
    // Retomar = remover as interrupcoes ativas (DELETE por id).
    const active = await this.fetchInterruptions(tokens, merchantId);
    for (const it of active) {
      await this.removeInterruption(tokens, merchantId, it.id);
    }
  }

  /** Cria uma interrupcao (pausa) da loja — POST /interruptions. Devolve o id. */
  async createInterruption(
    tokens: StoredTokens,
    merchantId: string,
    input: { start: Date; end?: Date; description?: string },
  ): Promise<RemoteInterruption> {
    interface RawInterruption {
      id?: string;
      start?: string;
      end?: string;
      description?: string;
    }
    const data = await this.post<RawInterruption>(
      `/merchant/v1.0/merchants/${merchantId}/interruptions`,
      tokens,
      {
        description: input.description ?? 'Pausa via DeliveryHub',
        start: input.start.toISOString(),
        end: input.end?.toISOString(),
      },
    );
    if (!data?.id) {
      throw new AdapterApiError('ifood_interruption_no_id', 502, data);
    }
    return {
      id: data.id,
      start: data.start ? new Date(data.start) : input.start,
      end: data.end ? new Date(data.end) : input.end,
      description: data.description ?? input.description,
    };
  }

  /** Lista as interrupcoes ativas da loja — GET /interruptions. */
  async fetchInterruptions(
    tokens: StoredTokens,
    merchantId: string,
  ): Promise<RemoteInterruption[]> {
    interface RawInterruption {
      id?: string;
      start?: string;
      end?: string;
      description?: string;
    }
    const data = await this.get<RawInterruption[]>(
      `/merchant/v1.0/merchants/${merchantId}/interruptions`,
      tokens,
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((i) => i.id)
      .map((i) => ({
        id: i.id!,
        start: i.start ? new Date(i.start) : new Date(),
        end: i.end ? new Date(i.end) : undefined,
        description: i.description,
      }));
  }

  /** Remove (encerra) uma interrupcao pelo id — DELETE /interruptions/{id}. */
  async removeInterruption(
    tokens: StoredTokens,
    merchantId: string,
    interruptionId: string,
  ): Promise<void> {
    await this.del(
      `/merchant/v1.0/merchants/${merchantId}/interruptions/${interruptionId}`,
      tokens,
    );
  }

  /** Status de operacao da loja — GET /merchants/{id}/status. */
  async fetchMerchantStatus(
    tokens: StoredTokens,
    merchantId: string,
  ): Promise<RemoteMerchantStatus[]> {
    interface RawValidation {
      id?: unknown;
      code?: unknown;
      state?: unknown;
      message?: unknown;
    }
    interface RawStatus {
      operation?: string;
      salesChannel?: string;
      available?: boolean;
      state?: string;
      validations?: RawValidation[];
      message?: unknown;
    }
    const data = await this.get<RawStatus[]>(
      `/merchant/v1.0/merchants/${merchantId}/status`,
      tokens,
    );
    if (!Array.isArray(data)) return [];
    return data.map((s) => ({
      operation: s.operation,
      salesChannel: s.salesChannel,
      available: s.available === true,
      state: s.state,
      validations: Array.isArray(s.validations)
        ? s.validations.map((v) => ({
            id: typeof v.id === 'string' ? v.id : String(v.id ?? ''),
            code: typeof v.code === 'string' ? v.code : undefined,
            state: typeof v.state === 'string' ? v.state : undefined,
            message: flattenMessage(v.message),
          }))
        : [],
      message: flattenMessage(s.message),
    }));
  }

  async acceptOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/confirm`, tokens, {});
  }

  async rejectOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void> {
    // O iFood exige um cancellationCode VÁLIDO pro momento atual do pedido —
    // um código fixo errado faz o requestCancellation falhar (sem gerar o
    // evento CANCELLED). Busca os motivos válidos e usa o primeiro.
    let cancellationCode = '501'; // fallback: "PROBLEMAS DE SISTEMA"
    try {
      const reasons = await this.get<
        Array<{ cancelCodeId?: string; code?: string; description?: string }>
      >(`/order/v1.0/orders/${externalOrderId}/cancellationReasons`, tokens);
      const first = Array.isArray(reasons) ? reasons[0] : undefined;
      if (first?.cancelCodeId ?? first?.code) {
        cancellationCode = (first.cancelCodeId ?? first.code)!;
      }
    } catch {
      // Sem lista disponível — segue com o fallback.
    }
    await this.post(`/order/v1.0/orders/${externalOrderId}/requestCancellation`, tokens, {
      reason,
      cancellationCode,
    });
  }

  async dispatchOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/dispatch`, tokens, {});
  }

  async startPreparation(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/startPreparation`, tokens, {});
  }

  async readyToPickup(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/readyToPickup`, tokens, {});
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    // Sem secret configurado nao ha como verificar assinatura — recusa (nunca deixa
    // um HMAC com chave vazia "validar" qualquer payload).
    if (!this.config.webhookSecret) return false;
    const sig = headers['x-ifood-signature'] ?? headers['X-Ifood-Signature'];
    if (typeof sig !== 'string') return false;
    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    } catch {
      return false;
    }
  }

  // -------------- helpers --------------

  private async fetchFirstMerchantId(tokens: StoredTokens): Promise<string> {
    const data = await this.get<Array<{ id: string }>>('/merchant/v1.0/merchants', tokens);
    const first = data[0];
    if (!first) throw new AdapterApiError('no_merchants_returned', 404);
    return first.id;
  }

  private async postForm<T>(path: string, body: URLSearchParams): Promise<T> {
    return this.request<T>('POST', path, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  private async post<T>(path: string, tokens: StoredTokens, body: unknown): Promise<T> {
    return this.request<T>('POST', path, {
      headers: this.authHeaders(tokens),
      body: JSON.stringify(body),
    });
  }

  private async put<T>(path: string, tokens: StoredTokens, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, {
      headers: this.authHeaders(tokens),
      body: JSON.stringify(body),
    });
  }

  private async patch<T>(path: string, tokens: StoredTokens, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, {
      headers: this.authHeaders(tokens),
      body: JSON.stringify(body),
    });
  }

  private async get<T>(path: string, tokens: StoredTokens): Promise<T> {
    return this.request<T>('GET', path, { headers: this.authHeaders(tokens) });
  }

  private async del<T>(path: string, tokens: StoredTokens): Promise<T> {
    return this.request<T>('DELETE', path, { headers: this.authHeaders(tokens) });
  }

  private authHeaders(tokens: StoredTokens): Record<string, string> {
    return {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    init: { headers: Record<string, string>; body?: string | URLSearchParams },
  ): Promise<T> {
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(this.config.apiBaseUrl + path, {
        method,
        headers: init.headers,
        body: init.body,
      });
    } catch (err) {
      this.log?.({
        method,
        path,
        status: 0,
        durationMs: Date.now() - start,
        ok: false,
      });
      throw new AdapterApiError(
        `ifood_network_error ${method} ${path}`,
        0,
        err instanceof Error ? err.message : 'network_error',
      );
    }
    const durationMs = Date.now() - start;
    const text = await res.text();
    const json: unknown = text ? safeJson(text) : undefined;
    this.log?.({ method, path, status: res.status, durationMs, ok: res.ok });
    if (!res.ok) {
      throw new AdapterApiError(
        `ifood_api_error ${res.status} ${method} ${path}`,
        res.status,
        json ?? text,
      );
    }
    return (json ?? {}) as T;
  }
}

// iFood status codes → DeliveryHub OrderStatus.
// Null-safe: o DETALHE do pedido do iFood (GET /orders/{id}) NÃO traz um campo
// `status` — o status é dirigido por EVENTOS. Sem valor, cai no default 'placed'
// e o status real é aplicado a partir do eventType (ver ifoodEventStatus).
function mapIFoodStatus(
  raw: string | undefined | null,
): import('./adapter.interface.js').RemoteOrderStatus {
  const code = (raw ?? '').toUpperCase();
  if (['PLC', 'PLACED', 'CREATED'].includes(code)) return 'placed';
  if (['CFM', 'CON', 'CONFIRMED'].includes(code)) return 'accepted';
  if (['IPR', 'PREPARING', 'IN_PRODUCTION', 'STARTED_PREPARATION'].includes(code))
    return 'preparing';
  if (['RTP', 'RTD', 'READY_TO_PICKUP', 'READY_TO_DELIVER', 'READY'].includes(code)) return 'ready';
  if (['DSP', 'DISPATCHED', 'OUT_FOR_DELIVERY'].includes(code)) return 'dispatched';
  if (['CON', 'CONCLUDED', 'DELIVERED'].includes(code)) return 'delivered';
  if (['CAN', 'CANCELLED', 'CANCELED'].includes(code)) return 'cancelled';
  return 'placed';
}

/**
 * Mapeia o CÓDIGO DO EVENTO (fullCode do polling: PLACED, CONFIRMED, CANCELLED…)
 * para o status. Retorna `null` pra eventos que NÃO mexem no status do pedido
 * (ex.: grupo DELIVERY — ASSIGN_DRIVER etc.), pra não regredir o pedido.
 * É essa a fonte de verdade do status do iFood (o detalhe do pedido não tem).
 */
export function ifoodEventStatus(
  eventType: string,
): import('./adapter.interface.js').RemoteOrderStatus | null {
  const code = eventType.toUpperCase();
  if (['PLC', 'PLACED', 'CREATED'].includes(code)) return 'placed';
  if (['CFM', 'CONFIRMED'].includes(code)) return 'accepted';
  if (['IPR', 'PREPARING', 'IN_PRODUCTION', 'STARTED_PREPARATION'].includes(code))
    return 'preparing';
  if (['RTP', 'RTD', 'READY_TO_PICKUP', 'READY_TO_DELIVER', 'READY'].includes(code)) return 'ready';
  if (['DSP', 'DISPATCHED', 'OUT_FOR_DELIVERY'].includes(code)) return 'dispatched';
  if (['CON', 'CONCLUDED', 'DELIVERED'].includes(code)) return 'delivered';
  if (['CAN', 'CANCELLED', 'CANCELED'].includes(code)) return 'cancelled';
  return null;
}

/**
 * Coage um valor da API pra string não-vazia ou `undefined`. Trata string,
 * número e objeto aninhado tipo `{ number }`/`{ value }` (formatos que o
 * iFood usa em telefone/documento). Nunca deixa passar não-string adiante.
 */
function coerceStr(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object') {
    const o = v as { number?: unknown; value?: unknown };
    return coerceStr(o.number) ?? coerceStr(o.value);
  }
  return undefined;
}

/**
 * Converte um valor monetário da API pra centavos. Aceita número cru (10.5)
 * OU objeto `{ value: 10.5 }` — o iFood mistura os dois formatos entre
 * endpoints/versões. Nunca devolve NaN (default 0).
 */
function cents(money: unknown): number {
  if (typeof money === 'number' && Number.isFinite(money)) return Math.round(money * 100);
  if (money && typeof money === 'object') {
    const v = (money as { value?: unknown }).value;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
  }
  return 0;
}

/** O `message` do status da loja vem como objeto {title, subtitle, description} ou string. */
function flattenMessage(m: unknown): string | undefined {
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') {
    const o = m as { title?: unknown; description?: unknown };
    if (typeof o.title === 'string') return o.title;
    if (typeof o.description === 'string') return o.description;
  }
  return undefined;
}

function mapIFoodOrderType(
  raw: string | undefined,
): import('./adapter.interface.js').OrderType {
  const code = (raw ?? '').toUpperCase();
  if (['TAKEOUT', 'TAKE_OUT'].includes(code)) return 'takeout';
  if (['INDOOR', 'DINE_IN', 'DINEIN'].includes(code)) return 'dine_in';
  return 'delivery';
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function encodeHandle(payload: PendingHandlePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeHandle(handle: string): PendingHandlePayload {
  return JSON.parse(Buffer.from(handle, 'base64url').toString('utf-8')) as PendingHandlePayload;
}

/** Data no formato YYYY-MM-DD (UTC), como o iFood espera em query/body. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * UUID determinístico (v5-like, SHA-1) de namespace+chave. Garante que
 * republicar o mesmo item/opção gere os MESMOS ids no iFood — o PUT /items
 * então atualiza em vez de duplicar entidades a cada push.
 */
function deterministicUuid(namespace: string, key: string): string {
  const bytes = createHash('sha1').update(`${namespace} ${key}`).digest().subarray(0, 16);
  // Formato v4 obrigatorio: o Catalog v2 exige UUID v4 e responde 404
  // pra qualquer outro formato de id.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // formato v4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
