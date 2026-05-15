import { createHash } from 'node:crypto';

import {
  AdapterApiError,
  ConnectionPendingError,
  type FinalizeConnectionResult,
  type PlatformAdapter,
  type PolledEvent,
  type RemoteMenu,
  type RemoteOrder,
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
 *
 *  - Credenciais de NÍVEL DE APP: `app_id` + `app_secret`.
 *  - Cada loja é vinculada (bind) ao app por um `app_shop_id` — um
 *    identificador que NÓS escolhemos pra loja no nosso sistema.
 *  - Com (app_id, app_secret, app_shop_id) pegamos um `auth_token` por
 *    loja via `GET /v1/auth/authtoken/get`. Esse token vai em todas as
 *    chamadas seguintes e expira (refresh via `/v1/auth/authtoken/refresh`).
 *  - NÃO existe OAuth Device Flow. O fluxo de "conectar" usa a página de
 *    autorização (`/auth/authorizationpage/getUrl`) ou bind direto
 *    (`v3/auth/authorization/shopBind`).
 *
 *  Como encaixamos no `PlatformAdapter` (que assume device flow):
 *    - StoredTokens.accessToken  = auth_token do 99Food
 *    - StoredTokens.refreshToken = app_shop_id (reaproveitado pra carregar
 *      qual loja renovar — 99Food não tem refresh token, renova por shop)
 *    - StoredTokens.expiresAt    = token_expiration_time
 *
 * ════════════════════════════════════════════════════════════════════
 *  ASSINATURA
 * ════════════════════════════════════════════════════════════════════
 *
 *  Webhook (entrada): header `didi-header-sign` = MD5(rawBody + app_secret).
 *  Request à API (saída): MD5( params ordenados "k=v" juntados por "&" +
 *                              app_secret ).
 *
 * ════════════════════════════════════════════════════════════════════
 *  ⚠️ ID 64-bit
 * ════════════════════════════════════════════════════════════════════
 *  app_id / order_id / shop_id são `long`. JSON.parse padrão corrompe
 *  (5764607801871631353 vira ...1631000). parseWebhook extrai esses IDs
 *  do corpo cru via regex pra preservar precisão.
 *
 * ════════════════════════════════════════════════════════════════════
 *  STATUS DA IMPLEMENTAÇÃO
 * ════════════════════════════════════════════════════════════════════
 *  ✅ verifyWebhookSignature  — documentado e implementado
 *  ✅ parseWebhook            — envelope documentado, implementado
 *  ✅ getAuthtoken / refreshAuthtoken — endpoints documentados
 *  ⏳ fetchOrder / accept / reject / dispatch — falta doc do "Order API"
 *  ⏳ startConnection / finalizeConnection   — falta doc do "Store API" (bind)
 *  ⏳ fetchMenu / pushItemPrice / pushItemAvailability — falta doc "Menu API"
 *  ⏳ pushStorePause          — falta doc do "Store API" (setStatus)
 */
export interface DidifoodAdapterConfig {
  /** app_id (long, mantido como string pra não perder precisão). */
  clientId: string;
  /** app_secret. */
  clientSecret: string;
  /** Base da API. Default https://openapi.99food.com */
  apiBaseUrl: string;
  /**
   * Secret de verificação do webhook. No 99Food é IGUAL ao app_secret —
   * a config aceita separado por consistência com os outros adapters.
   */
  webhookSecret: string;
}

/** Hook opcional de log de request (sem PII — método/path/status/ms). */
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

/** Resposta padrão de toda API 99Food. */
interface DidifoodEnvelope<T> {
  errno: number;
  errmsg: string;
  requestId?: string;
  time?: number;
  data: T;
}

/** Mapeia o `type` do webhook 99Food → status interno de pedido. */
const ORDER_EVENT_TYPES = new Set([
  'orderNew',
  'orderCancel',
  'orderFinish',
  'deliveryStatus',
  'orderCancelApply',
  'orderRefundApply',
  'orderPartialCancel',
]);

const NOT_IMPLEMENTED = '99food_endpoint_not_implemented_yet';

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
  // Webhook — verificação de assinatura (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * `didi-header-sign` = MD5(rawBody + app_secret). Comparação
   * case-insensitive (MD5 hex). Sem o header → rejeita.
   */
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    const provided = headers['didi-header-sign'] ?? headers['Didi-Header-Sign'];
    if (!provided) return false;
    const expected = createHash('md5')
      .update(Buffer.concat([rawBody, Buffer.from(this.config.webhookSecret, 'utf8')]))
      .digest('hex');
    return safeEqualHex(provided.trim().toLowerCase(), expected.toLowerCase());
  }

  // ===================================================================
  // Webhook — parsing do envelope (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * Envelope 99Food: { app_id, app_shop_id, type, timestamp, data }.
   * `type` é o evento (orderNew, orderCancel, ...). `data` carrega o
   * detalhe — pra eventos de pedido, contém `order_id` (long).
   *
   * Extraímos `order_id` direto do corpo cru via regex pra não perder
   * precisão do 64-bit. `app_shop_id` é string (seguro via JSON).
   */
  parseWebhook(payload: unknown, rawBody?: Buffer): WebhookEnvelope {
    const p = (payload ?? {}) as {
      app_id?: unknown;
      app_shop_id?: string;
      type?: string;
      timestamp?: number;
      data?: unknown;
    };

    const type = p.type ?? 'unknown';
    if (!ORDER_EVENT_TYPES.has(type)) {
      // shopStatus / imageAuditStatus / uploadMenuTaskStatus etc. — não
      // viram pedido. O controller captura esse throw e responde "ignored".
      throw new AdapterApiError(`unsupported_event_type:${type}`, 200, payload);
    }

    const raw = rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    // order_id pode estar no topo do `data` ou aninhado — pega o 1º match.
    const orderId =
      matchBigIntField(raw, 'order_id') ??
      matchBigIntField(raw, 'orderId') ??
      '';
    const merchantId = p.app_shop_id ?? matchStringField(raw, 'app_shop_id') ?? '';
    const occurredAt = p.timestamp
      ? new Date(p.timestamp * 1000)
      : new Date();

    if (!orderId) {
      throw new AdapterApiError('webhook_missing_order_id', 400, payload);
    }

    return {
      // 99Food não manda eventId — sintetizamos pra idempotência.
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

  /**
   * GET /v1/auth/authtoken/get — obtém auth_token de uma loja vinculada.
   * Os endpoints de authtoken usam `app_secret` direto (não exigem sign).
   */
  async getAuthtoken(appShopId: string): Promise<StoredTokens> {
    const data = await this.get<{
      app_id: number;
      app_shop_id: string;
      auth_token: string;
      token_expiration_time: number;
    }>('/v1/auth/authtoken/get', {
      app_id: this.config.clientId,
      app_secret: this.config.clientSecret,
      app_shop_id: appShopId,
    });
    return {
      accessToken: data.auth_token,
      refreshToken: appShopId, // 99Food renova por loja, não por refresh token
      expiresAt: new Date(data.token_expiration_time * 1000),
    };
  }

  /**
   * GET /v1/auth/authtoken/refresh — renova o auth_token expirado.
   * Após renovar, é preciso chamar getAuthtoken de novo (a doc diz isso).
   * Cooldown de 2 min entre refreshes da mesma loja.
   */
  async refreshAuthtoken(appShopId: string): Promise<void> {
    await this.get<boolean>('/v1/auth/authtoken/refresh', {
      app_id: this.config.clientId,
      app_secret: this.config.clientSecret,
      app_shop_id: appShopId,
    });
  }

  /**
   * Implementa `PlatformAdapter.refreshAuth`. Aqui `refreshToken` carrega
   * o `app_shop_id` (ver nota no topo). Renova e devolve o token novo.
   */
  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    const appShopId = refreshToken;
    await this.refreshAuthtoken(appShopId);
    return this.getAuthtoken(appShopId);
  }

  // ===================================================================
  // Conexão de loja — PENDENTE (falta doc do "Store API" / bind)
  // ===================================================================

  async startConnection(): Promise<StartConnectionResult> {
    // TODO: usar GET /v1/auth/authorizationpage/getUrl pra gerar a URL de
    // self-service binding; OU v3/auth/authorization/shopBind direto.
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Falta doc do Store API (bind/authorization page).',
    });
  }

  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    // TODO: após o bind, chamar getAuthtoken(app_shop_id).
    throw new ConnectionPendingError();
  }

  // ===================================================================
  // Pedidos — PENDENTE (falta doc detalhada do "Order API")
  // ===================================================================

  async fetchOrder(
    _tokens: StoredTokens,
    _externalMerchantId: string,
    _externalOrderId: string,
  ): Promise<RemoteOrder> {
    // TODO: GET v1/order/order/detail — falta o shape da resposta.
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v1/order/order/detail',
    });
  }

  async acceptOrder(): Promise<void> {
    // TODO: POST v1/order/order/confirm
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v1/order/order/confirm',
    });
  }

  async rejectOrder(): Promise<void> {
    // TODO: POST v1/order/order/cancel
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v1/order/order/cancel',
    });
  }

  async dispatchOrder(): Promise<void> {
    // TODO: POST v1/order/order/ready (preparado) ou /delivered (entregue)
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v1/order/order/ready',
    });
  }

  // ===================================================================
  // Cardápio — PENDENTE (falta doc do "Menu API")
  // ===================================================================

  async fetchMenu(): Promise<RemoteMenu> {
    // TODO: POST v3/item/item/list
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v3/item/item/list',
    });
  }

  async pushItemPrice(): Promise<void> {
    // TODO: POST v3/item/item/updateItem
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async pushItemAvailability(): Promise<void> {
    // TODO: POST v3/item/item/updateItemStatus
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  // ===================================================================
  // Pausa de loja — PENDENTE (falta doc do "Store API" / setStatus)
  // ===================================================================

  async pushStorePause(): Promise<void> {
    // TODO: POST v1/shop/shop/setStatus
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      endpoint: 'v1/shop/shop/setStatus',
    });
  }

  // ===================================================================
  // Polling — 99Food é webhook-only, sem polling.
  // ===================================================================

  async pollEvents(): Promise<PolledEvent[]> {
    return [];
  }

  async acknowledgeEvents(): Promise<void> {}

  // ===================================================================
  // HTTP + assinatura (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * GET com query params. Endpoints de authtoken não exigem sign.
   * Outros endpoints (a implementar) usarão `signParams` antes de chamar.
   */
  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    return this.request<T>('GET', `${path}?${qs}`);
  }

  private async request<T>(
    method: string,
    pathWithQuery: string,
    body?: unknown,
  ): Promise<T> {
    const start = Date.now();
    const url = this.config.apiBaseUrl.replace(/\/$/, '') + pathWithQuery;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
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
    // errno != 0 é erro de negócio mesmo com HTTP 200.
    if (errno !== 0) {
      throw new AdapterApiError(
        `99food_api_error errno=${errno} ${json?.errmsg ?? ''} ${stripQuery(pathWithQuery)}`,
        res.status,
        json,
      );
    }
    return json!.data;
  }

  /**
   * Assinatura de request à API (pra endpoints que exigem — não os de
   * authtoken). Params ordenados ASCII, "k=v" juntos por "&", app_secret
   * concatenado no fim, MD5. Exportável pra testes.
   */
  signParams(params: Record<string, string | number>): string {
    return signParams(params, this.config.clientSecret);
  }
}

// =====================================================================
// Helpers puros
// =====================================================================

/** Assinatura MD5 de params (sorted "k=v"&... + secret). Documentado pela 99Food. */
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

/** Extrai um campo numérico 64-bit do JSON cru, como string (sem perda). */
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

/** Comparação de hex de tempo ~constante (evita timing attack na verificação). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
