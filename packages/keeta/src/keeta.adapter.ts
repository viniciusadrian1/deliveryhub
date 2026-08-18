import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  AdapterApiError,
  type FinalizeConnectionResult,
  type OrderPaymentMethod,
  type PlatformAdapter,
  type PolledEvent,
  type RemoteMenu,
  type RemoteOrder,
  type RemoteOrderItem,
  type RemoteOrderStatus,
  type StartConnectionResult,
  type StoredTokens,
  type WebhookEnvelope,
} from '@deliveryhub/ifood';

/**
 * Keeta (Meituan Overseas) Open Delivery API adapter.
 *
 * Portal: https://developers.mykeeta.com  ·  API: https://open.mykeeta.com
 * Spec: Keeta Open Delivery API v1.0.7 (padrão Open Delivery / Abrasel).
 *
 * ════════════════════════════════════════════════════════════════════
 *  ASSINATURA — header `X-App-Signature`
 * ════════════════════════════════════════════════════════════════════
 *  Toda request leva `X-App-Signature` = HMAC-SHA256 (base64) sobre a
 *  string `URL & query_ordenada & body`, com chave = `clientSecret`.
 *  O body é canonicalizado (JCS / RFC 8785: chaves ordenadas, sem espaço)
 *  — assinamos exatamente o mesmo texto que enviamos.
 *
 * ════════════════════════════════════════════════════════════════════
 *  AUTENTICAÇÃO
 * ════════════════════════════════════════════════════════════════════
 *  POST /oauth/token (grant_type app_level_token, client_id+secret) →
 *  access_token de nível de APP (cobre todos os merchants autorizados).
 *  Todo endpoint exige `Authorization: Bearer <token>` + a assinatura.
 *
 * ════════════════════════════════════════════════════════════════════
 *  STATUS
 * ════════════════════════════════════════════════════════════════════
 *  ✅ signature, refreshAuth, fetchOrder, accept/reject/dispatchOrder
 *  ✅ pollEvents / acknowledgeEvents, parseWebhook, verifyWebhookSignature
 *  ✅ startConnection (URL de autorização do merchant)
 *  ⏳ finalizeConnection — a autorização do merchant na Keeta conclui via
 *     webhook /webhook/authorization + GET merchantInfo (precisa fiar o
 *     webhook de autorização). Documentado abaixo.
 *  🚫 fetchMenu / pushItemPrice / pushItemAvailability / pushStorePause —
 *     a Open Delivery API da Keeta não expõe esses endpoints.
 */
export interface KeetaAdapterConfig {
  /** client_id fornecido pela Keeta (= APP credentials). */
  clientId: string;
  /** client_secret — também é a chave HMAC da assinatura. */
  clientSecret: string;
  /** Base da API. Ex.: https://open.mykeeta.com/api/open/opendelivery */
  apiBaseUrl: string;
  /** Secret de verificação do webhook (assinatura X-App-Signature). */
  webhookSecret: string;
}

/** Hook opcional de log de request (sem PII). */
export interface KeetaRequestLogger {
  (info: { method: string; path: string; status: number; durationMs: number; ok: boolean }): void;
}

/** Loja autorizada devolvida por GET /oauth/authorized/{authId}/merchantInfo. */
export interface KeetaAuthorizedMerchant {
  merchantId: string;
  name?: string;
}

const UNSUPPORTED = 'keeta_endpoint_unsupported';

/** Eventos do Open Delivery da Keeta. */
interface RawEvent {
  eventId?: string;
  eventType?: string;
  orderId?: string;
  orderURL?: string;
  createdAt?: string;
  virtualBrand?: string;
}

/** Objeto de preço Open Delivery — `{ value, currency }`, value decimal. */
interface RawPrice {
  value?: number;
}
interface RawOrderItem {
  id?: string;
  externalCode?: string;
  name?: string;
  quantity?: number;
  unitPrice?: RawPrice;
  totalPrice?: RawPrice;
  specialInstructions?: string;
  options?: RawOrderItem[];
}
interface RawOrder {
  id?: string;
  displayId?: string;
  createdAt?: string;
  lastEvent?: string;
  extraInfo?: string;
  merchant?: { id?: string; name?: string };
  items?: RawOrderItem[];
  otherFees?: { type?: string; price?: RawPrice }[];
  total?: {
    itemsPrice?: RawPrice;
    otherFees?: RawPrice;
    discount?: RawPrice;
    orderAmount?: RawPrice;
  };
  payments?: {
    prepaid?: number;
    methods?: { type?: string; method?: string }[];
  };
  customer?: {
    name?: string;
    documentNumber?: string;
    phone?: { number?: string };
  };
  delivery?: { deliveredBy?: string };
}

/**
 * lastEvent / eventType da Keeta → status interno.
 * Eventos ambíguos (refund, cancellation request) caem em `placed` — o
 * reconcileFromPlatform a montante impede regressão de status.
 */
function mapKeetaStatus(event: string | undefined): RemoteOrderStatus {
  switch (event) {
    case 'CONFIRMED':
      return 'accepted';
    case 'READY_FOR_PICKUP':
      return 'ready';
    case 'DISPATCHED':
    case 'PICKED_UP':
    case 'PICKUP_ONGOING':
      return 'dispatched';
    case 'DELIVERED':
    case 'CONCLUDED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      // CREATED + eventos pós-entrega (refund/etc.)
      return 'placed';
  }
}

/** Converte um preço Open Delivery (decimal) em centavos. */
function toCents(p: RawPrice | undefined): number {
  return Math.round((p?.value ?? 0) * 100);
}

/** Normaliza o corpo do webhook de autorização (Keeta às vezes aninha em body/data). */
function asAuthBody(payload: unknown, rawBody?: Buffer): Record<string, unknown> {
  let obj = payload;
  if ((!obj || typeof obj !== 'object') && rawBody) {
    try {
      obj = JSON.parse(rawBody.toString('utf8'));
    } catch {
      obj = {};
    }
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const nested = (o.body ?? o.data) as Record<string, unknown> | undefined;
  return nested && typeof nested === 'object' ? { ...o, ...nested } : o;
}

/** Primeiro valor string/number não-vazio entre as chaves candidatas. */
function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

export class KeetaAdapter implements PlatformAdapter {
  readonly code = 'keeta' as const;
  private readonly log?: KeetaRequestLogger;

  /**
   * Cache eventId → { orderId, eventType } populado pelo `pollEvents`.
   * O `acknowledgeEvents` recebe só os ids; a Keeta exige orderId+eventType
   * no ack, então recuperamos daqui (limite de tamanho pra não vazar).
   */
  private readonly eventCache = new Map<string, { orderId: string; eventType: string }>();

  constructor(
    private readonly config: KeetaAdapterConfig,
    options: { log?: KeetaRequestLogger } = {},
  ) {
    this.log = options.log;
  }

  // ===================================================================
  // Conexão de loja
  // ===================================================================

  /**
   * GET /oauth/authorization/url — devolve a URL onde o lojista autoriza
   * o app na Keeta. Keeta não tem "user code"; a URL já é completa.
   */
  async startConnection(): Promise<StartConnectionResult> {
    const data = await this.request<{ merchantAuthorizationUrl?: string }>(
      'GET',
      '/oauth/authorization/url',
      { query: { clientId: this.config.clientId } },
    );
    const url = data?.merchantAuthorizationUrl;
    if (!url) {
      throw new AdapterApiError('keeta_authorization_url_missing', 502, data);
    }
    return {
      userCode: '',
      verificationUrl: url,
      verificationUrlComplete: url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pendingHandle: Buffer.from(JSON.stringify({ startedAt: Date.now() })).toString(
        'base64url',
      ),
    };
  }

  /**
   * A autorização do merchant na Keeta é concluída do lado deles e
   * notificada por `POST /webhook/authorization` (traz o `authId`); só
   * então `GET /oauth/authorized/{authId}/merchantInfo` lista as lojas.
   *
   * Esse fluxo é webhook-driven e não cabe no finalize por polling — fiar
   * o webhook de autorização é o próximo passo da integração Keeta.
   */
  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    throw new AdapterApiError('keeta_connection_needs_authorization_webhook', 501, {
      hint: 'Conclua a autorização do merchant: webhook /webhook/authorization + GET /oauth/authorized/{authId}/merchantInfo.',
    });
  }

  /**
   * Webhook 1301 (nova autorização de loja) → extrai o `authId`.
   * `null` = payload não é de autorização (ignora).
   * NOTA: nomes de campo confirmados contra o payload real dos logs — ver
   * `webhook_received` no WebhooksController (loga o corpo cru).
   */
  parseAuthorization(payload: unknown, rawBody?: Buffer): { authId: string } | null {
    const body = asAuthBody(payload, rawBody);
    const authId = firstString(body, ['authId', 'authorizationId', 'authorizeId']);
    return authId ? { authId } : null;
  }

  /** Webhook 1302 (desautorização) → extrai o id da loja (ou o authId). */
  parseDeauthorization(
    payload: unknown,
    rawBody?: Buffer,
  ): { merchantId?: string; authId?: string } | null {
    const body = asAuthBody(payload, rawBody);
    const merchantId = firstString(body, ['merchantId', 'storeId', 'brandId', 'shopId', 'id']);
    const authId = firstString(body, ['authId', 'authorizationId']);
    if (!merchantId && !authId) return null;
    return { merchantId, authId };
  }

  /**
   * GET /oauth/authorized/{authId}/merchantInfo — lista as lojas que o
   * merchant autorizou nesta autorização. Chamada após o webhook 1301.
   */
  async fetchAuthorizedMerchants(
    tokens: StoredTokens,
    authId: string,
  ): Promise<KeetaAuthorizedMerchant[]> {
    interface RawMerchant {
      id?: string;
      merchantId?: string;
      storeId?: string;
      name?: string;
      storeName?: string;
    }
    const data = await this.request<
      RawMerchant[] | { merchants?: RawMerchant[]; stores?: RawMerchant[] }
    >('GET', `/oauth/authorized/${encodeURIComponent(authId)}/merchantInfo`, {
      token: tokens.accessToken,
    });
    const list = Array.isArray(data) ? data : (data?.merchants ?? data?.stores ?? []);
    const out: KeetaAuthorizedMerchant[] = [];
    for (const m of list) {
      const merchantId = m.merchantId ?? m.storeId ?? m.id;
      if (merchantId) out.push({ merchantId, name: m.name ?? m.storeName });
    }
    return out;
  }

  /**
   * POST /oauth/token (grant_type=app_level_token) — a Keeta usa token de
   * nível de APP; "renovar" é trocar credenciais de novo. `refreshToken`
   * é ignorado de propósito.
   */
  async refreshAuth(_refreshToken: string): Promise<StoredTokens> {
    return this.fetchAppToken();
  }

  private async fetchAppToken(): Promise<StoredTokens> {
    const data = await this.request<{ access_token?: string; expires_in?: number }>(
      'POST',
      '/oauth/token',
      {
        body: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'app_level_token',
        },
        skipAuth: true,
      },
    );
    if (!data?.access_token) {
      throw new AdapterApiError('keeta_token_missing', 502, data);
    }
    return {
      accessToken: data.access_token,
      refreshToken: '',
      expiresAt: new Date(Date.now() + (data.expires_in ?? 7200) * 1000),
    };
  }

  // ===================================================================
  // Pedidos
  // ===================================================================

  /** GET /v1/orders/{orderId} — busca o pedido e mapeia pro RemoteOrder. */
  async fetchOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrder> {
    const data = await this.request<RawOrder>(
      'GET',
      `/v1/orders/${encodeURIComponent(externalOrderId)}`,
      { token: tokens.accessToken },
    );
    return mapOrderToRemote(data ?? {}, externalOrderId);
  }

  /** POST /v1/orders/{orderId}/confirm — confirma (aceita) o pedido. */
  async acceptOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.request('POST', `/v1/orders/${encodeURIComponent(externalOrderId)}/confirm`, {
      token: tokens.accessToken,
      body: {
        createdAt: new Date().toISOString(),
        orderExternalCode: externalOrderId,
      },
    });
  }

  /** POST /v1/orders/{orderId}/requestCancellation — cancela o pedido. */
  async rejectOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void> {
    await this.request(
      'POST',
      `/v1/orders/${encodeURIComponent(externalOrderId)}/requestCancellation`,
      {
        token: tokens.accessToken,
        body: {
          reason: reason || 'Cancelado pela loja',
          code: 'INTERNAL_DIFFICULTIES_OF_THE_RESTAURANT',
          mode: 'MANUAL',
        },
      },
    );
  }

  /**
   * POST /v1/orders/{orderId}/readyForPickup — sinaliza que o pedido está
   * pronto pra coleta (ação universal da loja; o despacho é da logística).
   */
  async dispatchOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.request(
      'POST',
      `/v1/orders/${encodeURIComponent(externalOrderId)}/readyForPickup`,
      { token: tokens.accessToken },
    );
  }

  // ===================================================================
  // Eventos — polling + webhook
  // ===================================================================

  /** GET /v1/events:polling — eventos novos da(s) loja(s). */
  async pollEvents(
    tokens: StoredTokens,
    externalMerchantId: string,
  ): Promise<PolledEvent[]> {
    const data = await this.request<RawEvent[]>('GET', '/v1/events:polling', {
      token: tokens.accessToken,
      headers: { 'x-polling-merchants': externalMerchantId },
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is RawEvent & { eventId: string; orderId: string } =>
        Boolean(e.eventId && e.orderId),
      )
      .map((e) => {
        this.rememberEvent(e.eventId, e.orderId, e.eventType ?? 'unknown');
        return {
          eventId: e.eventId,
          eventType: e.eventType ?? 'unknown',
          externalOrderId: e.orderId,
          externalMerchantId,
          occurredAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        };
      });
  }

  /**
   * POST /v1/events/acknowledgment — confirma o processamento dos eventos.
   * A Keeta exige `{ id, orderId, eventType }` por evento; recuperamos
   * orderId/eventType do cache preenchido no `pollEvents`.
   */
  async acknowledgeEvents(tokens: StoredTokens, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const body = eventIds.map((id) => {
      const cached = this.eventCache.get(id);
      return { id, orderId: cached?.orderId ?? '', eventType: cached?.eventType ?? '' };
    });
    await this.request('POST', '/v1/events/acknowledgment', {
      token: tokens.accessToken,
      body,
    });
    for (const id of eventIds) this.eventCache.delete(id);
  }

  /**
   * Webhook `POST /v1/newEvent` — corpo é um `Event`. O merchantId vem no
   * header `X-App-MerchantId` (não no corpo); como `parseWebhook` não
   * recebe headers, o intake principal da Keeta é por polling.
   */
  parseWebhook(payload: unknown): WebhookEnvelope {
    const p = (payload ?? {}) as RawEvent & { merchantId?: string };
    const eventId = p.eventId ?? '';
    const orderId = p.orderId ?? '';
    if (!eventId || !orderId) {
      throw new AdapterApiError('keeta_invalid_webhook_payload', 400, payload);
    }
    return {
      eventId,
      eventType: p.eventType ?? 'unknown',
      externalOrderId: orderId,
      externalMerchantId: p.merchantId ?? '',
      occurredAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    };
  }

  /**
   * Verifica o header `X-App-Signature` do webhook — HMAC-SHA256 (base64)
   * do corpo cru com a chave de webhook. O esquema exato de assinatura do
   * webhook deve ser confirmado na homologação (SIT) com a Keeta.
   */
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    const provided = headers['x-app-signature'] ?? headers['X-App-Signature'];
    if (typeof provided !== 'string' || !provided) return false;
    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('base64');
    try {
      return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ===================================================================
  // Cardápio / pausa — não suportados pela Open Delivery API da Keeta
  // ===================================================================

  async fetchMenu(): Promise<RemoteMenu> {
    throw new AdapterApiError(UNSUPPORTED, 501, { endpoint: 'menu (Keeta não expõe)' });
  }
  async pushItemPrice(): Promise<void> {
    throw new AdapterApiError(UNSUPPORTED, 501, { endpoint: 'item price (Keeta não expõe)' });
  }
  async pushItemAvailability(): Promise<void> {
    throw new AdapterApiError(UNSUPPORTED, 501, {
      endpoint: 'item availability (Keeta não expõe)',
    });
  }
  async pushStorePause(): Promise<void> {
    throw new AdapterApiError(UNSUPPORTED, 501, { endpoint: 'store pause (Keeta não expõe)' });
  }

  // ===================================================================
  // HTTP + assinatura
  // ===================================================================

  private rememberEvent(eventId: string, orderId: string, eventType: string): void {
    if (this.eventCache.size > 5000) {
      const first = this.eventCache.keys().next().value;
      if (first) this.eventCache.delete(first);
    }
    this.eventCache.set(eventId, { orderId, eventType });
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, string | number>;
      body?: unknown;
      token?: string;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    } = {},
  ): Promise<T> {
    const start = Date.now();
    const baseUrl = this.config.apiBaseUrl.replace(/\/$/, '') + path;
    const bodyStr =
      opts.body !== undefined ? canonicalJson(opts.body) : undefined;

    // Assinatura: URL + &k=v (query ordenada) + &body.
    const signature = this.sign(baseUrl, opts.query, bodyStr);

    const headers: Record<string, string> = {
      'X-App-Signature': signature,
      ...(opts.headers ?? {}),
    };
    if (bodyStr !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

    const qs = opts.query
      ? '?' + new URLSearchParams(asStringRecord(opts.query)).toString()
      : '';
    const url = baseUrl + qs;

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: bodyStr });
    } catch (err) {
      this.log?.({ method, path, status: 0, durationMs: Date.now() - start, ok: false });
      throw new AdapterApiError(
        `keeta_network_error ${method} ${path}`,
        0,
        err instanceof Error ? err.message : 'network_error',
      );
    }

    const durationMs = Date.now() - start;
    const text = await res.text();
    const json = text ? safeJson(text) : undefined;
    this.log?.({ method, path, status: res.status, durationMs, ok: res.ok });

    if (!res.ok) {
      throw new AdapterApiError(
        `keeta_api_error ${res.status} ${method} ${path}`,
        res.status,
        json ?? text,
      );
    }
    return (json ?? {}) as T;
  }

  /** HMAC-SHA256(base64) de `URL & query_ordenada & body` — chave clientSecret. */
  private sign(
    url: string,
    query: Record<string, string | number> | undefined,
    body: string | undefined,
  ): string {
    let s = url;
    if (query) {
      for (const k of Object.keys(query).sort()) {
        s += `&${k}=${query[k] ?? ''}`;
      }
    }
    if (body && body !== '{}' && body.trim()) {
      s += `&${body}`;
    }
    return createHmac('sha256', this.config.clientSecret)
      .update(s, 'utf8')
      .digest('base64');
  }
}

// =====================================================================
// Mapeamento de pedido
// =====================================================================

/** Converte o `Order` (Open Delivery) da Keeta no RemoteOrder interno. */
function mapOrderToRemote(o: RawOrder, externalOrderId: string): RemoteOrder {
  const items: RemoteOrderItem[] = (o.items ?? []).map((it) => ({
    externalId: it.id ?? it.externalCode ?? '',
    name: it.name ?? 'Item',
    qty: it.quantity ?? 1,
    unitPriceCents: toCents(it.unitPrice),
    totalCents: toCents(it.totalPrice),
    notes: it.specialInstructions || undefined,
    modifiers: (it.options ?? []).map((op) => ({
      externalId: op.id ?? '',
      name: op.name ?? '',
      qty: op.quantity ?? 1,
      unitPriceCents: toCents(op.unitPrice),
    })),
  }));

  const deliveryFee = (o.otherFees ?? []).find((f) => f.type === 'DELIVERY_FEE');
  const subtotalCents = toCents(o.total?.itemsPrice);
  const totalCents = toCents(o.total?.orderAmount);

  return {
    externalId: o.id ?? externalOrderId,
    externalMerchantId: o.merchant?.id ?? '',
    status: mapKeetaStatus(o.lastEvent),
    customer: {
      name: o.customer?.name || 'Cliente Keeta',
      phone: o.customer?.phone?.number || undefined,
      document: o.customer?.documentNumber || undefined,
    },
    items,
    subtotalCents,
    deliveryFeeCents: toCents(deliveryFee?.price),
    totalCents: totalCents || subtotalCents,
    // A Open Delivery da Keeta não detalha a comissão no pedido — fica 0.
    platformFeeCents: 0,
    processingFeeCents: 0,
    flatFeeCents: 0,
    notes: o.extraInfo || undefined,
    placedAt: o.createdAt ? new Date(o.createdAt) : new Date(),
    paymentMethod: mapPaymentMethod(o),
    deliveryBy:
      o.delivery?.deliveredBy === 'MERCHANT'
        ? 'store'
        : o.delivery?.deliveredBy === 'MARKETPLACE'
          ? 'platform'
          : undefined,
  };
}

/** Deriva a forma de pagamento dos métodos do pedido. */
function mapPaymentMethod(o: RawOrder): OrderPaymentMethod | undefined {
  const methods = o.payments?.methods ?? [];
  if (methods.length === 0) return undefined;
  if (methods.some((m) => m.method === 'CASH')) return 'cash';
  if (methods.some((m) => m.type === 'PREPAID') || (o.payments?.prepaid ?? 0) > 0) {
    return 'online';
  }
  return 'other';
}

// =====================================================================
// Helpers
// =====================================================================

/**
 * Serialização canônica (aprox. RFC 8785 / JCS): chaves ordenadas, sem
 * espaços. Assinamos e enviamos exatamente esta string.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const parts = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

function asStringRecord(q: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) out[k] = String(v);
  return out;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
