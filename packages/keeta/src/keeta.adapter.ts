import { createHash, timingSafeEqual } from 'node:crypto';

import {
  AdapterApiError,
  type FinalizeConnectionResult,
  type OrderPaymentMethod,
  type PlatformAdapter,
  type PolledEvent,
  type RemoteMenu,
  type RemoteMerchantStatus,
  type RemoteOrder,
  type RemoteOrderItem,
  type RemoteOrderStatus,
  type StartConnectionResult,
  type StoredTokens,
  type WebhookEnvelope,
} from '@deliveryhub/ifood';

/**
 * Keeta (Meituan Overseas) — Standard API adapter.
 *
 * Portal: https://developers.mykeeta.com  ·  API: https://open.mykeeta.com
 * Spec: Keeta Standard API (Order + Store + Menu) — ver docs/keeta-standard-api.md.
 *
 * ════════════════════════════════════════════════════════════════════
 *  AUTENTICAÇÃO — OAuth `authorization_code` (PER-MERCHANT)
 * ════════════════════════════════════════════════════════════════════
 *  Cada loja autoriza o app em merchant.mykeeta.com/.../authorize
 *  (responseType=authorization_code) → devolve um `code` (via webhook
 *  Event 1 OU redirect). Trocamos o code em POST /api/open/base/oauth/token
 *  por { accessToken, refreshToken, expiresIn≈90d } — token de nível de
 *  LOJA (não de app). `refreshAuth` usa grantType=refresh_token.
 *
 * ════════════════════════════════════════════════════════════════════
 *  ASSINATURA — parâmetro `sig` (SHA-256, NÃO HMAC)
 * ════════════════════════════════════════════════════════════════════
 *  sig = sha256( FULL_URL + '?' + params_ordenados(k=v&…) + appSecret )
 *  hex minúsculo. Params de auth (appId, timestamp, accessToken, grantType…)
 *  vão na QUERY e entram no sig; o corpo de negócio vai como JSON no body.
 *  ponytail: SIT-confirm — se a Keeta incluir campos do body no sig, basta
 *  mesclá-los no mapa de params em `signedParams` (uma linha).
 *
 * ════════════════════════════════════════════════════════════════════
 *  STATUS
 * ════════════════════════════════════════════════════════════════════
 *  ✅ token/refresh, sig, startConnection, exchangeAuthorizationCode,
 *     fetchAuthorizedResources, finalize, parse(de)authorization
 *  ✅ fetchOrder + accept/startPreparation/readyToPickup/dispatch/reject
 *  ✅ pushStorePause (scm/shop/status/rest|open), fetchMerchantStatus
 *  ✅ parseWebhook (Event 1001), verifyWebhookSignature
 *  ⏳ fetchMenu / pushItemPrice — dependem de resolução de id + menu/sync
 *     assíncrono; precisam do merchant de teste (ver stubs no fim).
 */
export interface KeetaAdapterConfig {
  /** appId (numérico) do portal de dev. Era `clientId` no Open Delivery. */
  appId: string;
  /** appSecret — chave da assinatura `sig`. Era `clientSecret`. */
  appSecret: string;
  /** Base da API Standard. Ex.: https://open.mykeeta.com */
  apiBaseUrl: string;
  /** Base do portal do lojista (consent). Ex.: https://merchant.mykeeta.com */
  merchantBaseUrl: string;
  /** redirectUri opcional pro fluxo authorization_code (se usarmos redirect). */
  redirectUri?: string;
}

/** Hook opcional de log de request (sem PII). */
export interface KeetaRequestLogger {
  (info: { method: string; path: string; status: number; durationMs: number; ok: boolean }): void;
}

/** Loja autorizada devolvida por /api/open/base/authorized/resource/get. */
export interface KeetaAuthorizedMerchant {
  merchantId: string;
  name?: string;
}

/** Resultado da troca do authorization_code: tokens + lojas autorizadas. */
export interface KeetaAuthorizationResult {
  tokens: StoredTokens;
  merchants: KeetaAuthorizedMerchant[];
}

const API_PREFIX = '/api/open';

/** Preço Standard — centavos inteiros (ver mapeamento). ponytail: SIT-confirm unidade. */
interface RawOrderItem {
  itemId?: string;
  skuId?: string;
  openItemCode?: string;
  name?: string;
  quantity?: number;
  price?: number;
  totalPrice?: number;
  remark?: string;
  attrs?: RawOrderItem[];
}
interface RawOrder {
  orderId?: string;
  displayId?: string;
  shopId?: string;
  status?: string | number;
  createTime?: number | string;
  remark?: string;
  items?: RawOrderItem[];
  amount?: {
    total?: number;
    subtotal?: number;
    deliveryFee?: number;
    discount?: number;
  };
  settlement?: {
    commission?: number;
    serviceFee?: number;
    flatFee?: number;
  };
  payType?: string | number;
  deliveryType?: string | number;
  customer?: { name?: string; phone?: string; taxId?: string };
}

/**
 * Status do pedido Standard → status interno. Valores exatos confirmam no SIT;
 * o reconcileFromPlatform a montante impede regressão.
 * ponytail: SIT-confirm — mapeia tanto string quanto código numérico.
 */
function mapKeetaStatus(status: string | number | undefined): RemoteOrderStatus {
  switch (String(status ?? '').toUpperCase()) {
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'accepted';
    case 'PREPARING':
      return 'preparing';
    case 'READY':
    case 'READY_FOR_PICKUP':
      return 'ready';
    case 'DISPATCHED':
    case 'PICKED_UP':
    case 'DELIVERING':
      return 'dispatched';
    case 'DELIVERED':
    case 'COMPLETED':
    case 'CONCLUDED':
      return 'delivered';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'placed';
  }
}

/** Centavos: a Standard já envia inteiro em centavos na maioria dos campos. */
function cents(v: number | undefined): number {
  return Math.round(v ?? 0);
}

/** Normaliza o corpo do webhook (Keeta às vezes aninha em body/data). */
function asBody(payload: unknown, rawBody?: Buffer): Record<string, unknown> {
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

  constructor(
    private readonly config: KeetaAdapterConfig,
    options: { log?: KeetaRequestLogger } = {},
  ) {
    this.log = options.log;
  }

  // ===================================================================
  // Conexão de loja — OAuth authorization_code (per-merchant)
  // ===================================================================

  /**
   * Monta a URL de consent do lojista. Standard usa authorization_code:
   * a loja autoriza e a Keeta devolve um `code` (webhook Event 1 ou redirect).
   * Não há "user code" — a URL já é completa.
   */
  async startConnection(): Promise<StartConnectionResult> {
    const state = Buffer.from(JSON.stringify({ t: 'keeta' })).toString('base64url');
    const params = new URLSearchParams({
      responseType: 'authorization_code',
      appId: this.config.appId,
      scope: 'all',
      state,
    });
    if (this.config.redirectUri) params.set('redirectUri', this.config.redirectUri);
    const url = `${this.config.merchantBaseUrl.replace(/\/$/, '')}/m/web/openapi/authorize?${params.toString()}`;
    return {
      userCode: '',
      verificationUrl: url,
      verificationUrlComplete: url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pendingHandle: Buffer.from(JSON.stringify({ state, startedAt: Date.now() })).toString(
        'base64url',
      ),
    };
  }

  /**
   * Troca o authorization_code por tokens PER-MERCHANT e já lista as lojas
   * autorizadas. Usado tanto pelo webhook de autorização (Event 1) quanto
   * pelo finalize manual (loja cola o code).
   */
  async exchangeAuthorizationCode(code: string): Promise<KeetaAuthorizationResult> {
    const tokens = await this.fetchToken('authorization_code', { code });
    const merchants = await this.fetchAuthorizedResources(tokens);
    return { tokens, merchants };
  }

  /**
   * finalize por code (fallback quando a loja cola o code manualmente).
   * O caminho principal é webhook-driven (integrations.service).
   */
  async finalizeConnection(
    _pendingHandle: string,
    authorizationCode?: string,
  ): Promise<FinalizeConnectionResult> {
    const code = authorizationCode?.trim();
    if (!code) {
      throw new AdapterApiError('authorization_code_required', 400, {
        hint: 'Standard usa authorization_code; a conexão ativa via webhook Event 1 ou com o code colado.',
      });
    }
    const { tokens, merchants } = await this.exchangeAuthorizationCode(code);
    const merchantId = merchants[0]?.merchantId;
    if (!merchantId) {
      throw new AdapterApiError('keeta_no_authorized_merchant', 502, { merchants });
    }
    return { tokens, externalMerchantId: merchantId };
  }

  /** Webhook Event 1 (auth code) → extrai o `code`. `null` = não é auth. */
  parseAuthorization(payload: unknown, rawBody?: Buffer): { code: string } | null {
    const body = asBody(payload, rawBody);
    const code = firstString(body, ['code', 'authorizationCode', 'authCode', 'authorization_code']);
    return code ? { code } : null;
  }

  /** Webhook 1302/1303 (desautorização) → id da loja/brand. */
  parseDeauthorization(
    payload: unknown,
    rawBody?: Buffer,
  ): { merchantId?: string; authId?: string } | null {
    const body = asBody(payload, rawBody);
    const merchantId = firstString(body, ['shopId', 'merchantId', 'storeId', 'brandId', 'id']);
    if (!merchantId) return null;
    return { merchantId };
  }

  /**
   * POST /api/open/base/authorized/resource/get — lojas que este token
   * (merchant) autorizou. Chamado após a troca do code.
   */
  async fetchAuthorizedResources(tokens: StoredTokens): Promise<KeetaAuthorizedMerchant[]> {
    interface RawShop {
      shopId?: string;
      merchantId?: string;
      id?: string;
      name?: string;
      shopName?: string;
    }
    const data = await this.request<
      RawShop[] | { shops?: RawShop[]; resources?: RawShop[]; merchants?: RawShop[] }
    >('POST', '/base/authorized/resource/get', { token: tokens.accessToken, body: {} });
    const list = Array.isArray(data)
      ? data
      : (data?.shops ?? data?.resources ?? data?.merchants ?? []);
    const out: KeetaAuthorizedMerchant[] = [];
    for (const s of list) {
      const merchantId = s.shopId ?? s.merchantId ?? s.id;
      if (merchantId) out.push({ merchantId, name: s.name ?? s.shopName });
    }
    return out;
  }

  /** grantType=refresh_token — Standard emite token de 90 dias renovável. */
  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    if (!refreshToken) {
      throw new AdapterApiError('keeta_refresh_token_missing', 400, {
        hint: 'Standard é per-merchant: sem refreshToken não há como renovar. Reconecte a loja.',
      });
    }
    return this.fetchToken('refresh_token', { refreshToken });
  }

  private async fetchToken(
    grantType: 'authorization_code' | 'refresh_token',
    extra: { code?: string; refreshToken?: string },
  ): Promise<StoredTokens> {
    const body: Record<string, unknown> = { appId: this.config.appId, grantType };
    if (extra.code) body.code = extra.code;
    if (extra.refreshToken) body.refreshToken = extra.refreshToken;
    const data = await this.request<{
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    }>('POST', '/base/oauth/token', { body, skipToken: true });
    if (!data?.accessToken) {
      throw new AdapterApiError('keeta_token_missing', 502, data);
    }
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? extra.refreshToken ?? '',
      // Standard: 90 dias (7776000s). Default defensivo se ausente.
      expiresAt: new Date(Date.now() + (data.expiresIn ?? 7776000) * 1000),
    };
  }

  // ===================================================================
  // Pedidos — POST /api/open/order/*
  // ===================================================================

  /** POST /api/open/order/get — busca o pedido e mapeia pro RemoteOrder. */
  async fetchOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrder> {
    const data = await this.request<RawOrder | { order?: RawOrder }>('POST', '/order/get', {
      token: tokens.accessToken,
      body: { orderId: externalOrderId },
    });
    const order = (data as { order?: RawOrder })?.order ?? (data as RawOrder);
    return mapOrderToRemote(order ?? {}, externalOrderId);
  }

  /** POST /api/open/order/confirm — aceita o pedido. */
  async acceptOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.request('POST', '/order/confirm', {
      token: tokens.accessToken,
      body: { orderId: externalOrderId },
    });
  }

  /** POST /api/open/order/prepare — em preparo. */
  async startPreparation(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.request('POST', '/order/prepare', {
      token: tokens.accessToken,
      body: { orderId: externalOrderId },
    });
  }

  /** POST /api/open/order/collect — pronto pra coleta (entregador da Keeta). */
  async readyToPickup(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.request('POST', '/order/collect', {
      token: tokens.accessToken,
      body: { orderId: externalOrderId },
    });
  }

  /** Ação universal "pronto"/"despachar": usa collect (readyForPickup). */
  async dispatchOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.readyToPickup(tokens, externalMerchantId, externalOrderId);
  }

  /** POST /api/open/order/cancel — cancela (recusa) o pedido. */
  async rejectOrder(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void> {
    await this.request('POST', '/order/cancel', {
      token: tokens.accessToken,
      body: { orderId: externalOrderId, reason: reason || 'Cancelado pela loja' },
    });
  }

  // ===================================================================
  // Eventos — Standard é webhook-driven (Event 1001); sem polling.
  // ===================================================================

  /** Standard entrega pedidos por webhook (Event 1001), não por polling. */
  async pollEvents(): Promise<PolledEvent[]> {
    return [];
  }

  /** Sem polling → sem ack. */
  async acknowledgeEvents(): Promise<void> {
    return;
  }

  /** Webhook de pedido (Event 1001) → envelope. */
  parseWebhook(payload: unknown, rawBody?: Buffer): WebhookEnvelope {
    const body = asBody(payload, rawBody);
    const eventId = firstString(body, ['eventId', 'messageId', 'id']) ?? '';
    const orderId = firstString(body, ['orderId', 'orderNo', 'displayId']) ?? '';
    const merchantId = firstString(body, ['shopId', 'merchantId', 'storeId']) ?? '';
    if (!eventId || !orderId) {
      throw new AdapterApiError('keeta_invalid_webhook_payload', 400, payload);
    }
    const eventType = firstString(body, ['eventType', 'type', 'event']) ?? 'ORDER';
    const ts = body['createTime'] ?? body['timestamp'];
    return {
      eventId,
      eventType: String(eventType),
      externalOrderId: orderId,
      externalMerchantId: merchantId,
      occurredAt: ts ? new Date(Number(ts) || String(ts)) : new Date(),
    };
  }

  /**
   * Verifica a assinatura do webhook. Standard assina com o mesmo appSecret;
   * o esquema exato do header confirma no SIT (o WebhooksController loga o
   * corpo cru + headers ANTES de verificar justamente pra isso).
   * ponytail: SIT-confirm — expected = sha256(rawBody + appSecret) hex.
   */
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    const provided =
      headers['sign'] ?? headers['sig'] ?? headers['x-app-signature'] ?? headers['x-sign'];
    if (typeof provided !== 'string' || !provided) return false;
    const expected = createHash('sha256')
      .update(Buffer.concat([rawBody, Buffer.from(this.config.appSecret, 'utf8')]))
      .digest('hex');
    try {
      return timingSafeEqual(
        Buffer.from(provided.toLowerCase()),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  // ===================================================================
  // Loja — pausa / status (Store API)
  // ===================================================================

  /**
   * POST /api/open/scm/shop/status/rest (pausar) | /status/open (reabrir).
   * `until` (fim da pausa) é passado quando a loja agenda a reabertura.
   */
  async pushStorePause(
    tokens: StoredTokens,
    externalMerchantId: string,
    paused: boolean,
    until?: Date,
    reason?: string,
  ): Promise<void> {
    const path = paused ? '/scm/shop/status/rest' : '/scm/shop/status/open';
    const body: Record<string, unknown> = { shopId: externalMerchantId };
    if (paused && until) body.restEndTime = Math.floor(until.getTime() / 1000);
    if (paused && reason) body.reason = reason;
    await this.request('POST', path, { token: tokens.accessToken, body });
  }

  /** POST /api/open/scm/shop/base/get — status/dados da loja. */
  async fetchMerchantStatus(
    tokens: StoredTokens,
    externalMerchantId: string,
  ): Promise<RemoteMerchantStatus[]> {
    const data = await this.request<{ status?: string | number; open?: boolean }>(
      'POST',
      '/scm/shop/base/get',
      { token: tokens.accessToken, body: { shopId: externalMerchantId } },
    );
    const open =
      data?.open ?? ['OPEN', 'OPENING', '1', 'ONLINE'].includes(String(data?.status).toUpperCase());
    return [
      {
        operation: 'DELIVERY',
        available: Boolean(open),
        state: String(data?.status ?? (open ? 'OPEN' : 'CLOSED')),
        validations: [],
      },
    ];
  }

  // ===================================================================
  // Cardápio — Standard SUPORTA (Menu API), mas o wiring precisa do SIT
  // ===================================================================

  /**
   * Standard tem Menu API completa, mas ler/publicar exige resolver ids
   * (product/spu/list) e o menu/sync é ASSÍNCRONO (webhook de conclusão).
   * Sem merchant de teste não dá pra mapear os shapes com segurança —
   * habilita assim que a homologação Menu confirmar os campos.
   * Mecanismo: GET via /product/spu/list + /product/shopcategory/list;
   * PUSH via /product/menu/sync (upsert do cardápio inteiro por openItemCode).
   */
  async fetchMenu(): Promise<RemoteMenu> {
    throw new AdapterApiError('keeta_menu_pending_sit', 501, {
      endpoint: 'product/spu/list',
      hint: 'Standard suporta; habilitar após homologação Menu (resolução de id + shapes).',
    });
  }

  /**
   * Preço na Standard não tem endpoint isolado — vai pelo menu/sync (ou
   * spu/batchupdate por id). Precisa do id da SPU (spu/list) → SIT.
   */
  async pushItemPrice(): Promise<void> {
    throw new AdapterApiError('keeta_menu_pending_sit', 501, {
      endpoint: 'product/menu/sync',
      hint: 'Preço vai pelo menu/sync; requer mapa openItemCode↔SPU do merchant de teste.',
    });
  }

  /**
   * POST /api/open/product/spustatus/batchupdatebycode — disponibilidade
   * por openItemCode. `externalId` = o código externo (nosso menuItemId)
   * gravado como openItemCode na publicação. ponytail: SIT-confirm shape.
   */
  async pushItemAvailability(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalId: string,
    available: boolean,
  ): Promise<void> {
    await this.request('POST', '/product/spustatus/batchupdatebycode', {
      token: tokens.accessToken,
      body: {
        shopId: externalMerchantId,
        items: [{ openItemCode: externalId, sellStatus: available ? 1 : 0 }],
      },
    });
  }

  // ===================================================================
  // HTTP + assinatura `sig`
  // ===================================================================

  private async request<T>(
    method: string,
    path: string,
    opts: {
      body?: unknown;
      token?: string;
      /** true no /oauth/token (ainda não temos accessToken). */
      skipToken?: boolean;
    } = {},
  ): Promise<T> {
    const start = Date.now();
    // Standard chama no host raiz (/api/open/...). Normaliza configs herdadas do
    // Open Delivery (…/api/open/opendelivery) pro host, evitando path duplicado.
    const host = this.config.apiBaseUrl
      .replace(/\/$/, '')
      .replace(/\/api\/open(\/.*)?$/, '');
    const url = host + API_PREFIX + path;

    // Params de auth vão na query e entram no sig; o corpo de negócio é JSON.
    const params: Record<string, string> = {
      appId: this.config.appId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    if (!opts.skipToken && opts.token) params.accessToken = opts.token;
    params.sig = this.sign(url, params);

    const qs = new URLSearchParams(params).toString();
    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const headers: Record<string, string> = {};
    if (bodyStr !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`${url}?${qs}`, { method, headers, body: bodyStr });
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
    // Standard encapsula em { code, msg, data }: desembrulha quando presente.
    const envelope = json as { code?: number | string; data?: unknown } | undefined;
    if (
      envelope &&
      typeof envelope === 'object' &&
      'data' in envelope &&
      ('code' in envelope || 'msg' in envelope)
    ) {
      const okCode = envelope.code === 0 || envelope.code === '0' || envelope.code === undefined;
      if (!okCode) {
        throw new AdapterApiError(`keeta_api_error ${method} ${path}`, res.status, envelope);
      }
      return (envelope.data ?? {}) as T;
    }
    return (json ?? {}) as T;
  }

  /**
   * sig = sha256( FULL_URL + '?' + params_ordenados(k=v&…) + appSecret ) hex.
   * O próprio `sig` nunca entra no cálculo (ainda não existe).
   */
  private sign(url: string, params: Record<string, string>): string {
    return signKeeta(url, params, this.config.appSecret);
  }
}

/** Assinatura Standard, exportada pra self-check. */
export function signKeeta(
  url: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sig')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha256').update(`${url}?${sorted}${appSecret}`, 'utf8').digest('hex');
}

// =====================================================================
// Mapeamento de pedido
// =====================================================================

/** Converte o Order (Standard) da Keeta no RemoteOrder interno. */
function mapOrderToRemote(o: RawOrder, externalOrderId: string): RemoteOrder {
  const items: RemoteOrderItem[] = (o.items ?? []).map((it) => ({
    externalId: it.itemId ?? it.skuId ?? it.openItemCode ?? '',
    name: it.name ?? 'Item',
    qty: it.quantity ?? 1,
    unitPriceCents: cents(it.price),
    totalCents: cents(it.totalPrice ?? (it.price ?? 0) * (it.quantity ?? 1)),
    notes: it.remark || undefined,
    modifiers: (it.attrs ?? []).map((op) => ({
      externalId: op.itemId ?? op.skuId ?? '',
      name: op.name ?? '',
      qty: op.quantity ?? 1,
      unitPriceCents: cents(op.price),
    })),
  }));

  const subtotalCents = cents(o.amount?.subtotal);
  const totalCents = cents(o.amount?.total);

  return {
    externalId: o.orderId ?? externalOrderId,
    externalMerchantId: o.shopId ?? '',
    status: mapKeetaStatus(o.status),
    customer: {
      name: o.customer?.name || 'Cliente Keeta',
      phone: o.customer?.phone || undefined,
      document: o.customer?.taxId || undefined,
    },
    items,
    subtotalCents,
    deliveryFeeCents: cents(o.amount?.deliveryFee),
    totalCents: totalCents || subtotalCents,
    // Settlement vem no pedido: comissão/taxas quando presentes.
    platformFeeCents: cents(o.settlement?.commission),
    processingFeeCents: cents(o.settlement?.serviceFee),
    flatFeeCents: cents(o.settlement?.flatFee),
    notes: o.remark || undefined,
    placedAt: o.createTime ? new Date(Number(o.createTime) || String(o.createTime)) : new Date(),
    paymentMethod: mapPaymentMethod(o.payType),
    deliveryBy:
      String(o.deliveryType ?? '').toUpperCase() === 'SELF'
        ? 'store'
        : o.deliveryType !== undefined
          ? 'platform'
          : undefined,
  };
}

/** Deriva a forma de pagamento do payType. ponytail: SIT-confirm códigos. */
function mapPaymentMethod(payType: string | number | undefined): OrderPaymentMethod | undefined {
  if (payType === undefined) return undefined;
  const t = String(payType).toUpperCase();
  if (t === 'CASH' || t === 'COD' || t === '2') return 'cash';
  if (t === 'ONLINE' || t === 'PREPAID' || t === '1') return 'online';
  return 'other';
}

// =====================================================================
// Helpers
// =====================================================================

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
