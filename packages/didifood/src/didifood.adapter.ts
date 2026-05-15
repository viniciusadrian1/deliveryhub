import { createHash } from 'node:crypto';

import {
  AdapterApiError,
  ConnectionPendingError,
  type FinalizeConnectionResult,
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
 * 99Food (DiDi Food) Open Platform adapter.
 *
 * Portal: https://developer-food.99app.com  ·  API: https://openapi.99food.com
 *
 * ════════════════════════════════════════════════════════════════════
 *  MODELO DE INTEGRAÇÃO (difere bastante do iFood)
 * ════════════════════════════════════════════════════════════════════
 *  - Credenciais de NÍVEL DE APP: `app_id` + `app_secret`.
 *  - Cada loja é vinculada (bind) ao app por um `app_shop_id`.
 *  - Com (app_id, app_secret, app_shop_id) pegamos `auth_token` por loja
 *    via GET /v1/auth/authtoken/get. O auth_token vai em todas as chamadas
 *    de pedido e expira (refresh via /v1/auth/authtoken/refresh).
 *  - NÃO existe OAuth Device Flow.
 *
 *  Mapeamento no `PlatformAdapter`:
 *    StoredTokens.accessToken  = auth_token
 *    StoredTokens.refreshToken = app_shop_id (99Food renova por loja)
 *    StoredTokens.expiresAt    = token_expiration_time
 *
 * ════════════════════════════════════════════════════════════════════
 *  ASSINATURA
 * ════════════════════════════════════════════════════════════════════
 *  Webhook (entrada): header `didi-header-sign` = MD5(rawBody + app_secret).
 *  Endpoints de pedido autenticam por `auth_token` (sem sign extra).
 *
 * ════════════════════════════════════════════════════════════════════
 *  ⚠️ ID 64-bit
 * ════════════════════════════════════════════════════════════════════
 *  order_id / app_id / shop_id são `long`. JSON.parse corrompe. Tratamos:
 *   - webhook: order_id extraído do corpo cru via regex
 *   - request POST: order_id emitido como literal numérico cru no JSON
 *   - GET detail: order_id vai na query string (texto, sem perda); a
 *     resposta é parseada com JSON.parse normal, mas só lemos campos
 *     seguros (status, preços, strings) — nunca o order_id numérico da
 *     resposta (usamos o que entrou como parâmetro).
 *
 * ════════════════════════════════════════════════════════════════════
 *  STATUS
 * ════════════════════════════════════════════════════════════════════
 *  ✅ verifyWebhookSignature, parseWebhook
 *  ✅ getAuthtoken / refreshAuthtoken
 *  ✅ fetchOrder, acceptOrder, rejectOrder, dispatchOrder
 *  ⏳ startConnection / finalizeConnection — falta doc do Store API (bind)
 *  ⏳ fetchMenu / pushItemPrice / pushItemAvailability — falta Menu API
 *  ⏳ pushStorePause — falta Store API (setStatus)
 */
export interface DidifoodAdapterConfig {
  /** app_id (long, string pra não perder precisão). */
  clientId: string;
  /** app_secret. */
  clientSecret: string;
  /** Base da API. Default https://openapi.99food.com */
  apiBaseUrl: string;
  /** Secret de verificação do webhook (= app_secret no 99Food). */
  webhookSecret: string;
}

/** Hook opcional de log de request (sem PII). */
export interface DidifoodRequestLogger {
  (info: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ok: boolean;
    errno?: number;
  }): void;
}

interface DidifoodEnvelope<T> {
  errno: number;
  errmsg: string;
  requestId?: string;
  time?: number;
  data: T;
}

/** Tipos de evento de pedido do webhook 99Food. */
const ORDER_EVENT_TYPES = new Set([
  'orderNew',
  'orderConfirm',
  'orderReady',
  'orderCancel',
  'orderPartialCancel',
  'orderFinish',
  'orderCancelApply',
  'orderRefundApply',
]);

/**
 * Status 99Food (int) → status interno.
 *  100 criado · 200 aceito (loja confirmou) · 400 saiu p/ entrega ·
 *  500 entregador chegou · 600 concluído · 9xx cancelado.
 */
function map99FoodStatus(status: number | undefined): RemoteOrderStatus {
  switch (status) {
    case 100:
      return 'placed';
    case 200:
      return 'accepted';
    case 400:
    case 500:
      return 'dispatched';
    case 600:
      return 'delivered';
    case 901:
    case 902:
    case 921:
    case 922:
    case 923:
    case 961:
    case 971:
    case 981:
      return 'cancelled';
    default:
      return 'placed';
  }
}

/** reason_id padrão pra cancelamento (1080 = "Other reason"; sempre com texto). */
const CANCEL_REASON_OTHER = 1080;

const NOT_IMPLEMENTED = '99food_endpoint_not_implemented_yet';

// Shapes parciais da resposta de Get Order Details (só o que usamos).
interface RawSubItem {
  app_item_id?: string;
  name?: string;
  amount?: number;
  sku_price?: number;
}
interface RawOrderItem {
  app_item_id?: string;
  name?: string;
  amount?: number;
  sku_price?: number;
  total_price?: number;
  remark?: string;
  sub_item_list?: RawSubItem[];
}
interface RawOrderInfo {
  status?: number;
  remark?: string;
  create_time?: number;
  delivery_type?: number;
  price?: {
    order_price?: number;
    delivery_price?: number;
    real_pay_price?: number;
    customer_need_paying_money?: number;
  };
  shop?: { app_shop_id?: string };
  receive_address?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    calling_code?: string;
    phone?: string;
    cpf?: number | string;
  };
  order_items?: RawOrderItem[];
}
interface RawOrderDetail {
  order_id?: number;
  order_info?: RawOrderInfo;
}

export class DidifoodAdapter implements PlatformAdapter {
  readonly code = '99food' as const;
  private readonly log?: DidifoodRequestLogger;

  constructor(
    private readonly config: DidifoodAdapterConfig,
    options: { log?: DidifoodRequestLogger } = {},
  ) {
    this.log = options.log;
  }

  // ===================================================================
  // Webhook — assinatura (DOCUMENTADO ✅)
  // ===================================================================

  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    const provided = headers['didi-header-sign'] ?? headers['Didi-Header-Sign'];
    if (!provided) return false;
    const expected = createHash('md5')
      .update(Buffer.concat([rawBody, Buffer.from(this.config.webhookSecret, 'utf8')]))
      .digest('hex');
    return safeEqualHex(provided.trim().toLowerCase(), expected.toLowerCase());
  }

  // ===================================================================
  // Webhook — parsing (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * Envelope 99Food: { app_id, app_shop_id, type, timestamp, data }.
   * `orderNew` traz data.order_info completo; demais eventos só data.order_id.
   * Extraímos order_id do corpo cru pra preservar o 64-bit.
   */
  parseWebhook(payload: unknown, rawBody?: Buffer): WebhookEnvelope {
    const p = (payload ?? {}) as {
      app_shop_id?: string;
      type?: string;
      timestamp?: number;
    };

    const type = p.type ?? 'unknown';
    if (!ORDER_EVENT_TYPES.has(type)) {
      // shopStatus / imageAuditStatus / uploadMenuTaskStatus — não viram
      // pedido. O controller captura o throw e responde "ignored".
      throw new AdapterApiError(`unsupported_event_type:${type}`, 200, payload);
    }

    const raw = rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const orderId = matchBigIntField(raw, 'order_id') ?? '';
    const merchantId = p.app_shop_id ?? matchStringField(raw, 'app_shop_id') ?? '';
    const occurredAt = p.timestamp ? new Date(p.timestamp * 1000) : new Date();

    if (!orderId) {
      throw new AdapterApiError('webhook_missing_order_id', 400, payload);
    }

    return {
      eventId: `${type}:${orderId}:${p.timestamp ?? Date.now()}`,
      eventType: type,
      externalOrderId: orderId,
      externalMerchantId: merchantId,
      occurredAt,
    };
  }

  // ===================================================================
  // Authtoken (DOCUMENTADO ✅)
  // ===================================================================

  async getAuthtoken(appShopId: string): Promise<StoredTokens> {
    const data = await this.get<{
      auth_token: string;
      token_expiration_time: number;
    }>('/v1/auth/authtoken/get', {
      app_id: this.config.clientId,
      app_secret: this.config.clientSecret,
      app_shop_id: appShopId,
    });
    return {
      accessToken: data.auth_token,
      refreshToken: appShopId,
      expiresAt: new Date(data.token_expiration_time * 1000),
    };
  }

  async refreshAuthtoken(appShopId: string): Promise<void> {
    await this.get<boolean>('/v1/auth/authtoken/refresh', {
      app_id: this.config.clientId,
      app_secret: this.config.clientSecret,
      app_shop_id: appShopId,
    });
  }

  /** `refreshToken` carrega o app_shop_id (ver nota no topo). */
  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    await this.refreshAuthtoken(refreshToken);
    return this.getAuthtoken(refreshToken);
  }

  // ===================================================================
  // Pedidos (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * GET /v1/order/order/detail — busca o pedido completo e mapeia pro
   * formato interno (RemoteOrder).
   */
  async fetchOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrder> {
    const data = await this.get<RawOrderDetail>('/v1/order/order/detail', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
    });
    const info = data.order_info ?? {};
    return mapOrderInfoToRemote(info, externalOrderId);
  }

  /** POST /v1/order/order/confirm — confirma o pedido (loja aceitou). */
  async acceptOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post('/v1/order/order/confirm', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
    });
  }

  /** POST /v1/order/order/cancel — cancela o pedido com motivo. */
  async rejectOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void> {
    await this.post('/v1/order/order/cancel', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
      reason_id: CANCEL_REASON_OTHER,
      reason: reason || 'Cancelado pela loja',
    });
  }

  /**
   * POST /v1/order/order/ready — sinaliza que a refeição está pronta.
   * É a ação universal da loja (no 99Food-courier, o despacho real é do
   * entregador; "ready" é o sinal do lado da loja).
   */
  async dispatchOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post('/v1/order/order/ready', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
    });
  }

  // ===================================================================
  // Conexão de loja — PENDENTE (falta doc do Store API / bind)
  // ===================================================================

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Falta doc do Store API (bind / authorization page).',
    });
  }

  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    throw new ConnectionPendingError();
  }

  // ===================================================================
  // Cardápio / pausa — PENDENTE (falta doc Menu API / Store API setStatus)
  // ===================================================================

  async fetchMenu(): Promise<RemoteMenu> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, { endpoint: 'v3/item/item/list' });
  }
  async pushItemPrice(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, { endpoint: 'v3/item/item/updateItem' });
  }
  async pushItemAvailability(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v3/item/item/updateItemStatus',
    });
  }
  async pushStorePause(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, { endpoint: 'v1/shop/shop/setStatus' });
  }

  // 99Food é webhook-only.
  async pollEvents(): Promise<PolledEvent[]> {
    return [];
  }
  async acknowledgeEvents(): Promise<void> {}

  // ===================================================================
  // HTTP
  // ===================================================================

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    return this.request<T>('GET', `${path}?${qs}`);
  }

  /**
   * POST com body JSON. `order_id` (se presente) é emitido como literal
   * numérico cru pra preservar o 64-bit (ver nota no topo).
   */
  private async post<T>(
    path: string,
    fields: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>('POST', path, buildJsonBody(fields, ['order_id']));
  }

  private async request<T>(
    method: string,
    pathWithQuery: string,
    rawJsonBody?: string,
  ): Promise<T> {
    const start = Date.now();
    const url = this.config.apiBaseUrl.replace(/\/$/, '') + pathWithQuery;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: rawJsonBody ? { 'Content-Type': 'application/json' } : {},
        body: rawJsonBody,
      });
    } catch (err) {
      this.log?.({
        method,
        path: stripQuery(pathWithQuery),
        status: 0,
        durationMs: Date.now() - start,
        ok: false,
      });
      throw new AdapterApiError(
        `99food_network_error ${method} ${stripQuery(pathWithQuery)}`,
        0,
        err instanceof Error ? err.message : 'network_error',
      );
    }

    const durationMs = Date.now() - start;
    const text = await res.text();
    const json = safeJson(text) as DidifoodEnvelope<T> | undefined;
    const errno = json?.errno;

    this.log?.({
      method,
      path: stripQuery(pathWithQuery),
      status: res.status,
      durationMs,
      ok: res.ok && errno === 0,
      errno,
    });

    if (!res.ok) {
      throw new AdapterApiError(
        `99food_http_error ${res.status} ${method} ${stripQuery(pathWithQuery)}`,
        res.status,
        json ?? text,
      );
    }
    if (errno !== 0) {
      throw new AdapterApiError(
        `99food_api_error errno=${errno} ${json?.errmsg ?? ''} ${stripQuery(pathWithQuery)}`,
        res.status,
        json,
      );
    }
    return json!.data;
  }

  /** Assinatura MD5 de request (pra endpoints que exigem — Store/Menu API). */
  signParams(params: Record<string, string | number>): string {
    return signParams(params, this.config.clientSecret);
  }
}

// =====================================================================
// Mapeamento de pedido
// =====================================================================

/** Converte o `order_info` do 99Food no RemoteOrder interno. */
function mapOrderInfoToRemote(info: RawOrderInfo, externalOrderId: string): RemoteOrder {
  const price = info.price ?? {};
  const orderPrice = price.order_price ?? 0;
  const deliveryPrice = price.delivery_price ?? 0;
  // total: preferimos real_pay_price; fallback p/ customer_need_paying_money;
  // por último order_price + delivery_price.
  const totalCents =
    price.real_pay_price ??
    price.customer_need_paying_money ??
    orderPrice + deliveryPrice;

  const items: RemoteOrderItem[] = (info.order_items ?? []).map((it) => ({
    externalId: it.app_item_id ?? '',
    name: it.name ?? 'Item',
    qty: it.amount ?? 1,
    unitPriceCents: it.sku_price ?? 0,
    totalCents: it.total_price ?? 0,
    notes: it.remark || undefined,
    modifiers: (it.sub_item_list ?? []).map((sub) => ({
      externalId: sub.app_item_id ?? '',
      name: sub.name ?? '',
      qty: sub.amount ?? 1,
      unitPriceCents: sub.sku_price ?? 0,
    })),
  }));

  const addr = info.receive_address ?? {};
  const customerName = pickCustomerName(addr);
  const phone =
    addr.phone && addr.calling_code
      ? `${addr.calling_code}${addr.phone}`
      : addr.phone || undefined;

  return {
    externalId: externalOrderId,
    externalMerchantId: info.shop?.app_shop_id ?? '',
    status: map99FoodStatus(info.status),
    customer: {
      name: customerName,
      phone,
      document: addr.cpf ? String(addr.cpf) : undefined,
    },
    items,
    subtotalCents: orderPrice,
    deliveryFeeCents: deliveryPrice,
    totalCents,
    // 99Food não expõe a comissão no detalhe do pedido — ela vem na
    // Financial API (settlements). Mantemos 0 aqui; o líquido exato é
    // reconciliado depois.
    platformFeeCents: 0,
    processingFeeCents: 0,
    flatFeeCents: 0,
    notes: info.remark || undefined,
    placedAt: info.create_time ? new Date(info.create_time * 1000) : new Date(),
  };
}

/** Nome do cliente, lidando com valores mascarados de privacidade. */
function pickCustomerName(addr: {
  name?: string;
  first_name?: string;
  last_name?: string;
}): string {
  const masked = (v?: string) =>
    !v || v === '' || v === 'privacy protection' || /^\*+$/.test(v);
  if (!masked(addr.name)) return addr.name!;
  const full = [addr.first_name, addr.last_name].filter((p) => !masked(p)).join(' ');
  return full.trim() || 'Cliente 99Food';
}

// =====================================================================
// Helpers puros
// =====================================================================

/** Assinatura MD5 de params (sorted "k=v"&... + secret). */
export function signParams(
  params: Record<string, string | number>,
  appSecret: string,
): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const joined = sorted.map((k) => `${k}=${params[k]}`).join('&');
  return createHash('md5').update(joined + appSecret, 'utf8').digest('hex');
}

/**
 * Monta JSON manualmente. Campos em `rawNumericKeys` são emitidos como
 * literal numérico cru (sem aspas) — usado pro order_id 64-bit, que não
 * pode passar por Number nem virar string sem mudar o tipo esperado.
 */
function buildJsonBody(
  fields: Record<string, string | number>,
  rawNumericKeys: string[],
): string {
  const parts = Object.entries(fields).map(([k, v]) => {
    if (rawNumericKeys.includes(k) && /^\d+$/.test(String(v))) {
      return `${JSON.stringify(k)}:${v}`;
    }
    return `${JSON.stringify(k)}:${JSON.stringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}

/** Extrai um campo numérico 64-bit do JSON cru, como string. */
function matchBigIntField(raw: string, field: string): string | null {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"?(\\d{1,25})"?`));
  return m ? m[1]! : null;
}

/** Extrai um campo string do JSON cru. */
function matchStringField(raw: string, field: string): string | null {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`));
  return m ? m[1]! : null;
}

function safeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stripQuery(pathWithQuery: string): string {
  const i = pathWithQuery.indexOf('?');
  return i >= 0 ? pathWithQuery.slice(0, i) : pathWithQuery;
}

/** Comparação de hex em tempo ~constante. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
