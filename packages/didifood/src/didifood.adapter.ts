import { createHash } from 'node:crypto';

import {
  AdapterApiError,
  ConnectionPendingError,
  type FinalizeConnectionResult,
  type OrderPaymentMethod,
  type PlatformAdapter,
  type PolledEvent,
  type RemoteCategory,
  type RemoteMenu,
  type RemoteMenuItem,
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
 *  - NÃO existe OAuth Device Flow. A loja é vinculada via página de
 *    auto-serviço: POST getUrl devolve uma URL, o lojista autoriza no
 *    portal 99Food, e `finalizeConnection` faz o diff do snapshot de
 *    lojas vinculadas pra descobrir a recém-conectada.
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
 *  ✅ verifyWebhookSignature, parseWebhook, parseActionRequest
 *  ✅ getAuthtoken / refreshAuthtoken
 *  ✅ fetchOrder, acceptOrder, rejectOrder, dispatchOrder
 *  ✅ confirmCashPayment, handleCancellation/RefundRequest, verifyOrder
 *  ✅ startConnection / finalizeConnection (bind self-service via web page)
 *  ✅ pushStorePause (Store API — setStatus)
 *  ✅ fetchMenu / pushItemPrice / pushItemAvailability (Menu API)
 *  ✅ parseDeliveryStatus + Self Delivery + delivery areas (Logistics API)
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

/** Motivo de recusa de um pedido de reembolso (`handleRefundRequest`). */
export interface DidifoodRefundRefusal {
  /** base_reason_id — da lista enviada no webhook orderRefundApply. */
  baseReasonId: string;
  /** base_reason — texto correspondente, da mesma lista. */
  baseReason: string;
  /** Observação livre opcional da loja. */
  customReason?: string;
}

/** Resultado de `verifyOrder` (verificação de pedido de retirada). */
export interface DidifoodVerifyResult {
  /** true se o total escaneado offline bate com o online dentro da margem. */
  passed: boolean;
  onlineGoodsPriceCents: number;
  offlineGoodsPriceCents: number;
}

/** Opção de motivo que a loja escolhe ao responder um pedido de ação. */
export interface DidifoodActionReasonOption {
  /** id — só o reembolso traz (base_reason_id); cancelamento traz só texto. */
  id?: string;
  label: string;
}

/**
 * Pedido de cancelamento/reembolso aberto pelo cliente via atendimento
 * do 99Food (webhooks orderCancelApply / orderRefundApply).
 */
export interface DidifoodActionRequest {
  kind: 'cancellation' | 'refund';
  /** order_id 64-bit como string. */
  externalOrderId: string;
  externalMerchantId: string;
  /** apply_id 64-bit como string — vai no /order/apply/{cancel,refund}. */
  applyId: string;
  /** Motivo informado pelo cliente. */
  customerReason?: string;
  /** Opções que a loja escolhe ao responder (obrigatório p/ recusar reembolso). */
  reasonOptions: DidifoodActionReasonOption[];
  /** Imagens anexadas pelo cliente como evidência (reembolso). */
  images: string[];
  occurredAt: Date;
}

/**
 * Atualização de status de entrega do webhook `deliveryStatus` (Logistics).
 * delivery_status: 120 atribuído · 130 chegou na loja · 140 coletou ·
 * 150 chegou no cliente · 160 entregue · 170 cancelado · 180 reatribuído ·
 * 190 abortado.
 */
export interface DidifoodDeliveryStatus {
  externalOrderId: string;
  externalMerchantId: string;
  deliveryStatus: number;
  courierName?: string;
  courierPhone?: string;
  occurredAt: Date;
}

/** Dados do entregador da loja para o Self Delivery (entrega própria). */
export interface DidifoodCourier {
  /** Nome completo exibido ao cliente. */
  name: string;
  firstName: string;
  lastName: string;
  /** Código do país, ex.: "+55". */
  phoneCode: string;
  phone: string;
  id?: string;
  imageUrl?: string;
  /** 100 a pé · 101 e-bike · 102 moto · 103 bike · 104 carro · 105 moto 125cc. */
  vehicleType?: number;
  vehicleNumber?: string;
}

/** Entrada do Self Delivery dispatch / updateCourierInfo. */
export interface DidifoodSelfDeliveryInput {
  courier: DidifoodCourier;
  /** Unix segundos — chegada estimada na loja p/ coleta. */
  pickupTime: number;
  /** Unix segundos — entrega estimada ao cliente. */
  deliveryTime: number;
}

/** Entrada de uma área de entrega (Add/Update Delivery Area). */
export interface DidifoodDeliveryAreaInput {
  /** 0 = círculo (usa radiusKm) · 1 = polígono (usa points). */
  areaType: 0 | 1;
  /** Raio em km — obrigatório p/ círculo. */
  radiusKm?: number;
  /** Pontos do polígono — obrigatório p/ polígono. */
  points?: { lat: number; lng: number }[];
  /** ETA médio de entrega, em segundos. */
  avgDeliveryEtaSeconds: number;
  /** Janelas de horário ativas (HH:mm). */
  enableTimes: { start: string; end: string }[];
  /** Preço da entrega, em centavos. */
  priceCents: number;
}

/** Uma área de entrega já configurada (Get Delivery Area). */
export interface DidifoodDeliveryArea {
  /** IDs 64-bit (string) — usados em update/delete. */
  areaIds: string[];
  areaType: number;
  radiusKm: number;
  priceCents: number;
  avgDeliveryEtaSeconds: number;
  /** Texto pronto das janelas, ex.: "00:50-05:00 06:50-10:00". */
  enableTimesLabel: string;
  pointCount: number;
}

interface DidifoodEnvelope<T> {
  errno: number;
  errmsg: string;
  requestId?: string;
  time?: number;
  data: T;
}

/**
 * Tipos de evento de STATUS de pedido do webhook 99Food.
 * `orderCancelApply` / `orderRefundApply` NÃO entram aqui — são pedidos de
 * ação do cliente, tratados por `parseActionRequest` (fluxo próprio).
 */
const ORDER_EVENT_TYPES = new Set([
  'orderNew',
  'orderConfirm',
  'orderReady',
  'orderCancel',
  'orderPartialCancel',
  'orderFinish',
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

/** pause_reason_code 1006 = "Other reason" — pausa manual feita pelo Hub. */
const PAUSE_REASON_OTHER = 1006;

/**
 * Campos `long` 64-bit emitidos como literal numérico cru no corpo JSON
 * (sem aspas, sem passar por Number) — senão perdem precisão.
 */
const RAW_NUMERIC_KEYS = [
  'order_id',
  'app_id',
  'shop_id',
  'apply_id',
  'picker_id',
  'cashier_id',
];

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
  pay_type?: number;
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

// Shapes parciais de List Bind Stores / List Authorized Stores —
// só os campos seguros (o `shop_id` long 64-bit da resposta é ignorado).
interface RawShopListItem {
  app_shop_id?: string;
  bound_flag?: number;
}
interface RawShopList {
  total_page?: number;
  shops?: RawShopListItem[];
}

/** Conteúdo do `pendingHandle` do 99Food (snapshot pré-bind). */
interface DidifoodPendingHandle {
  /** app_shop_id já vinculados ANTES de iniciar a conexão. */
  knownShopIds: string[];
  startedAt: number;
}

// Shapes parciais de Get Store Menu Details (GET /v3/item/item/list).
interface RawSoldInfo {
  time?: { begin?: string; end?: string }[];
  day?: number[];
  specialDay?: string[];
}
interface RawMenuItemFull {
  app_item_id?: string;
  /** Campo livre do lojista — pode ser string OU objeto JSON. */
  app_external_id?: unknown;
  item_name?: string;
  short_desc?: string;
  head_img?: string;
  sold_info_intl?: RawSoldInfo[];
  price?: number;
  priority?: number;
  status?: number;
  is_sold_separately?: boolean;
}
interface RawMenuCategory {
  app_category_id?: string;
  category_name?: string;
  app_item_ids?: string[];
  priority?: number;
}
interface RawMenuList {
  categories?: RawMenuCategory[];
  items?: RawMenuItemFull[];
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

  /**
   * Parseia os webhooks `orderCancelApply` / `orderRefundApply` — pedidos de
   * cancelamento/reembolso abertos pelo cliente. Devolve `null` se o webhook
   * não for um desses (o controller segue pro fluxo normal de pedido).
   *
   * order_id e apply_id são `long` 64-bit — extraídos do corpo cru. Os
   * demais campos (motivo, listas de motivo, imagens) são strings/arrays,
   * lidos com segurança do JSON parseado.
   */
  parseActionRequest(payload: unknown, rawBody?: Buffer): DidifoodActionRequest | null {
    const p = (payload ?? {}) as {
      type?: string;
      app_shop_id?: string;
      timestamp?: number;
      data?: {
        apply_reason?: string;
        reason_list?: { reason?: string }[];
        base_reason_list?: { base_reason_id?: string; base_reason?: string }[];
        images?: unknown;
      };
    };

    const kind =
      p.type === 'orderCancelApply'
        ? 'cancellation'
        : p.type === 'orderRefundApply'
          ? 'refund'
          : null;
    if (!kind) return null;

    const raw = rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const externalOrderId = matchBigIntField(raw, 'order_id') ?? '';
    const applyId = matchBigIntField(raw, 'apply_id') ?? '';
    if (!externalOrderId || !applyId) {
      throw new AdapterApiError('99food_action_request_missing_ids', 400, payload);
    }

    const data = p.data ?? {};
    const reasonOptions: DidifoodActionReasonOption[] =
      kind === 'cancellation'
        ? (data.reason_list ?? [])
            .map((r) => ({ label: r.reason ?? '' }))
            .filter((r) => r.label)
        : (data.base_reason_list ?? [])
            .map((r) => ({ id: r.base_reason_id, label: r.base_reason ?? '' }))
            .filter((r) => r.label && r.id);

    return {
      kind,
      externalOrderId,
      externalMerchantId:
        p.app_shop_id ?? matchStringField(raw, 'app_shop_id') ?? '',
      applyId,
      customerReason: data.apply_reason || undefined,
      reasonOptions,
      images: Array.isArray(data.images)
        ? data.images.filter((i): i is string => typeof i === 'string')
        : [],
      occurredAt: p.timestamp ? new Date(p.timestamp * 1000) : new Date(),
    };
  }

  /**
   * Parseia o webhook `deliveryStatus` (Logistics) — progresso do
   * entregador. Devolve `null` se não for esse tipo. `order_id` é long
   * 64-bit, extraído do corpo cru.
   */
  parseDeliveryStatus(payload: unknown, rawBody?: Buffer): DidifoodDeliveryStatus | null {
    const p = (payload ?? {}) as {
      type?: string;
      app_shop_id?: string;
      timestamp?: number;
      data?: {
        delivery_status?: number;
        rider_name?: string;
        rider_phone?: string;
      };
    };
    if (p.type !== 'deliveryStatus') return null;

    const raw = rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const externalOrderId = matchBigIntField(raw, 'order_id') ?? '';
    if (!externalOrderId) {
      throw new AdapterApiError('99food_delivery_status_missing_order_id', 400, payload);
    }
    const data = p.data ?? {};
    return {
      externalOrderId,
      externalMerchantId: p.app_shop_id ?? matchStringField(raw, 'app_shop_id') ?? '',
      deliveryStatus: typeof data.delivery_status === 'number' ? data.delivery_status : 0,
      courierName: data.rider_name || undefined,
      courierPhone: data.rider_phone || undefined,
      occurredAt: p.timestamp ? new Date(p.timestamp * 1000) : new Date(),
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
  // Order API — extras 99Food (fora do PlatformAdapter; só o
  // DidifoodAdapter expõe — o caller resolve via `instanceof`)
  // ===================================================================

  /**
   * POST /v1/order/order/payConfirm — confirma o recebimento do dinheiro
   * de um pedido pago em espécie (a maquininha do entregador 99Food).
   *
   * Vale só p/ entrega feita por entregador 99Food (não loja-própria) e
   * com o pedido em status 200 (aceito). É obrigatório nesse fluxo — sem
   * a confirmação o entregador não enxerga o endereço do cliente.
   */
  async confirmCashPayment(tokens: StoredTokens, externalOrderId: string): Promise<void> {
    await this.post('/v1/order/order/payConfirm', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
    });
  }

  /**
   * POST /v1/order/apply/cancel — aprova ou recusa um pedido de
   * CANCELAMENTO aberto pelo cliente via atendimento do 99Food.
   *
   * O `applyId` chega no webhook `orderCancelApply`. Sem resposta da loja
   * em ~10 min, o 99Food recusa por padrão. Exige que a loja tenha
   * habilitado o recebimento desses pedidos (Store API setApply).
   */
  async handleCancellationRequest(
    tokens: StoredTokens,
    externalOrderId: string,
    applyId: string,
    agree: boolean,
    reason?: string,
  ): Promise<void> {
    const body: Record<string, string | number | boolean> = {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
      apply_id: applyId,
      agree,
    };
    if (reason) body.reason = reason;
    await this.post('/v1/order/apply/cancel', body);
  }

  /**
   * POST /v1/order/apply/refund — aprova ou recusa um pedido de REEMBOLSO
   * aberto pelo cliente via atendimento do 99Food.
   *
   * O `applyId` chega no webhook `orderRefundApply`. Ao recusar, o 99Food
   * exige motivo (`baseReasonId` + `baseReason`, da lista do webhook). Sem
   * resposta da loja em ~24 h, o 99Food aprova o reembolso por padrão.
   */
  async handleRefundRequest(
    tokens: StoredTokens,
    externalOrderId: string,
    applyId: string,
    agree: boolean,
    refusal?: DidifoodRefundRefusal,
  ): Promise<void> {
    const body: Record<string, string | number | boolean> = {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
      apply_id: applyId,
      agree,
    };
    if (!agree) {
      if (!refusal?.baseReasonId || !refusal.baseReason) {
        throw new AdapterApiError('99food_refund_refusal_reason_required', 400);
      }
      body.base_reason_id = refusal.baseReasonId;
      body.base_reason = refusal.baseReason;
      if (refusal.customReason) body.custom_reason = refusal.customReason;
    }
    await this.post('/v1/order/apply/refund', body);
  }

  /**
   * POST /v1/order/order/verify — confere se o total escaneado offline
   * bate com o preço do pedido online (só pedidos de retirada/pickup).
   *
   * O 99Food levanta erro (errno != 0) quando a verificação falha ou o
   * status do pedido não permite — então, se este método retornar sem
   * lançar, a verificação passou.
   */
  async verifyOrder(
    tokens: StoredTokens,
    externalOrderId: string,
    offlineGoodsPriceCents: number,
    opts: { pickerId?: string; cashierId?: string } = {},
  ): Promise<DidifoodVerifyResult> {
    const body: Record<string, string | number | boolean> = {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
      offline_goods_price: offlineGoodsPriceCents,
    };
    if (opts.pickerId) body.picker_id = opts.pickerId;
    if (opts.cashierId) body.cashier_id = opts.cashierId;
    const data = await this.post<{
      verification?: string;
      online_goods_price?: number | string;
      offline_goods_price?: number | string;
    }>('/v1/order/order/verify', body);
    return {
      passed: data?.verification === 'passed',
      onlineGoodsPriceCents: Number(data?.online_goods_price ?? 0),
      offlineGoodsPriceCents: Number(data?.offline_goods_price ?? offlineGoodsPriceCents),
    };
  }

  // ===================================================================
  // Logistics API — entrega própria (Self Delivery) (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * POST /v1/order/selfdelivery/dispatch — avisa o 99Food que um pedido de
   * ENTREGA PRÓPRIA saiu pra entrega, com os dados do entregador da loja.
   */
  async selfDeliveryDispatch(
    tokens: StoredTokens,
    externalOrderId: string,
    input: DidifoodSelfDeliveryInput,
  ): Promise<void> {
    await this.postWithOrderId('/v1/order/selfdelivery/dispatch', externalOrderId, {
      auth_token: tokens.accessToken,
      courier_info: buildCourierInfo(input.courier),
      ...buildVehicle(input.courier),
      limit_time: { pickup_time: input.pickupTime, delivery_time: input.deliveryTime },
    });
  }

  /** POST /v1/order/selfdelivery/delivered — pedido de entrega própria entregue. */
  async selfDeliveryDelivered(
    tokens: StoredTokens,
    externalOrderId: string,
  ): Promise<void> {
    await this.post('/v1/order/selfdelivery/delivered', {
      auth_token: tokens.accessToken,
      order_id: externalOrderId,
    });
  }

  /** POST /v1/order/selfdelivery/updateCourierInfo — atualiza o entregador. */
  async updateCourierInfo(
    tokens: StoredTokens,
    externalOrderId: string,
    input: DidifoodSelfDeliveryInput,
  ): Promise<void> {
    await this.postWithOrderId(
      '/v1/order/selfdelivery/updateCourierInfo',
      externalOrderId,
      {
        auth_token: tokens.accessToken,
        courier_info: buildCourierInfo(input.courier),
        ...buildVehicle(input.courier),
        limit_time: { pickup_time: input.pickupTime, delivery_time: input.deliveryTime },
      },
    );
  }

  /**
   * POST /v1/order/selfdelivery/updateCourierTrack — posição GPS do
   * entregador (precisa de um app de entregador como fonte de coordenadas).
   */
  async updateCourierTrack(
    tokens: StoredTokens,
    externalOrderId: string,
    limitTime: { pickupTime: number; deliveryTime: number },
    coordinate: { longitude: number; latitude: number; timestamp: number },
  ): Promise<void> {
    await this.postWithOrderId(
      '/v1/order/selfdelivery/updateCourierTrack',
      externalOrderId,
      {
        auth_token: tokens.accessToken,
        limit_time: {
          pickup_time: limitTime.pickupTime,
          delivery_time: limitTime.deliveryTime,
        },
        coordinate,
      },
    );
  }

  // ===================================================================
  // Logistics API — áreas de entrega (DOCUMENTADO ✅)
  // ===================================================================

  /** GET /v1/shop/deliveryArea/list — áreas de entrega configuradas. */
  async getDeliveryAreas(tokens: StoredTokens): Promise<DidifoodDeliveryArea[]> {
    const qs = new URLSearchParams({ auth_token: tokens.accessToken }).toString();
    const text = await this.requestRaw('GET', `/v1/shop/deliveryArea/list?${qs}`);
    return parseDeliveryAreas(text);
  }

  /**
   * POST /v1/shop/deliveryArea/add — adiciona uma área de entrega
   * (círculo por raio ou polígono por pontos).
   */
  async addDeliveryArea(
    tokens: StoredTokens,
    input: DidifoodDeliveryAreaInput,
  ): Promise<void> {
    await this.postJson('/v1/shop/deliveryArea/add', {
      auth_token: tokens.accessToken,
      ...deliveryAreaBody(input),
    });
  }

  /** POST /v1/shop/deliveryArea/update — atualiza áreas existentes. */
  async updateDeliveryArea(
    tokens: StoredTokens,
    areaIds: string[],
    input: DidifoodDeliveryAreaInput,
  ): Promise<void> {
    await this.request(
      'POST',
      '/v1/shop/deliveryArea/update',
      buildDeliveryAreaIdBody(tokens.accessToken, areaIds, deliveryAreaBody(input)),
    );
  }

  /** POST /v1/shop/deliveryArea/delete — remove áreas de entrega. */
  async deleteDeliveryArea(tokens: StoredTokens, areaIds: string[]): Promise<void> {
    await this.request(
      'POST',
      '/v1/shop/deliveryArea/delete',
      buildDeliveryAreaIdBody(tokens.accessToken, areaIds),
    );
  }

  // ===================================================================
  // Store API — conexão de loja (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * Inicia a conexão de uma loja 99Food via bind self-service.
   *
   * Fluxo (≠ OAuth Device do iFood):
   *  1. Snapshot das lojas já vinculadas ao app.
   *  2. POST /v1/auth/authorizationpage/getUrl → URL de autorização.
   *  3. O lojista abre a URL, loga no 99Food e clica "Authorize" na loja.
   *  4. `finalizeConnection` faz o diff e descobre a loja recém-vinculada.
   *
   * 99Food não tem "user code" — a URL já é personalizada. Devolvemos
   * `userCode` vazio e a mesma URL nos dois campos. A URL vale 7 dias.
   */
  async startConnection(): Promise<StartConnectionResult> {
    const known = await this.listBoundShops();

    const data = await this.post<{ url?: string }>('/v1/auth/authorizationpage/getUrl', {
      app_id: this.config.clientId,
    });
    if (!data?.url) {
      throw new AdapterApiError('99food_authorization_url_missing', 502, data);
    }

    const handle: DidifoodPendingHandle = {
      knownShopIds: known,
      startedAt: Date.now(),
    };
    return {
      userCode: '',
      verificationUrl: data.url,
      verificationUrlComplete: data.url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pendingHandle: encodeHandle(handle),
    };
  }

  /**
   * Verifica se o lojista já concluiu o bind na página de autorização.
   *
   * Diff entre as lojas vinculadas AGORA e o snapshot do `startConnection`:
   * a loja que apareceu é a recém-conectada. Sem loja nova →
   * `ConnectionPendingError` (o lojista ainda não autorizou).
   */
  async finalizeConnection(pendingHandle: string): Promise<FinalizeConnectionResult> {
    const { knownShopIds } = decodeHandle(pendingHandle);
    const known = new Set(knownShopIds);

    const current = await this.listBoundShops();
    const fresh = current.filter((id) => !known.has(id));

    if (fresh.length === 0) throw new ConnectionPendingError();

    // Conexão é 1:1 loja↔plataforma. Se o lojista vinculou mais de uma na
    // mesma janela, pegamos a primeira — as demais ele conecta depois.
    const appShopId = fresh[0]!;
    const tokens = await this.getAuthtoken(appShopId);
    return { tokens, externalMerchantId: appShopId };
  }

  /**
   * POST /v1/shop/shop/setStatus — pausa ou reabre a loja.
   *
   *  paused=true  → store_status 3 (Business Pause) + pause_time + reason.
   *  paused=false → store_status 1 (Online).
   *
   * `pause_time` (enum 99Food): 1=10min · 2=20min · 3=30min · 4=fim do dia.
   * A resposta é assíncrona — o status final é confirmado pelo webhook
   * `shopStatus`. Aqui só garantimos que a requisição foi aceita (errno 0).
   */
  async pushStorePause(
    tokens: StoredTokens,
    _externalMerchantId: string,
    paused: boolean,
    until?: Date,
  ): Promise<void> {
    if (!paused) {
      await this.post('/v1/shop/shop/setStatus', {
        auth_token: tokens.accessToken,
        store_status: 1,
      });
      return;
    }
    await this.post('/v1/shop/shop/setStatus', {
      auth_token: tokens.accessToken,
      store_status: 3,
      pause_time: pauseTimeCode(until),
      pause_reason_code: PAUSE_REASON_OTHER,
    });
  }

  /**
   * Lista as lojas vinculadas ao app (bound_flag = 1).
   *
   * Usa `/v1/shop/shop/list` (List Bind Stores). Se o app não tiver
   * permissão nesse endpoint (errno 10006), cai pro v3 getAuthorizedShops
   * (List Authorized Stores) — mesma assinatura e mesmo shape de resposta.
   */
  private async listBoundShops(): Promise<string[]> {
    try {
      return await this.fetchShopList('/v1/shop/shop/list');
    } catch (err) {
      if (errnoOf(err) === 10006) {
        return this.fetchShopList('/v3/auth/authorization/getAuthorizedShops');
      }
      throw err;
    }
  }

  /**
   * Busca paginada de lojas num endpoint assinado. Body:
   * `{ app_id, timestamp, sign, page_no, page_size }` — `sign` é MD5 dos
   * params ordenados + app_secret.
   *
   * Só lemos campos seguros (app_shop_id, shop_name, bound_flag); o
   * `shop_id` (long 64-bit) da resposta é ignorado de propósito.
   */
  private async fetchShopList(endpoint: string): Promise<string[]> {
    const out: string[] = [];

    for (let pageNo = 1; pageNo <= 20; pageNo++) {
      const signed = {
        app_id: this.config.clientId,
        timestamp: Math.floor(Date.now() / 1000),
        page_no: pageNo,
        page_size: 50,
      };
      const data = await this.post<RawShopList>(endpoint, {
        ...signed,
        sign: signParams(signed, this.config.clientSecret),
      });

      for (const s of data?.shops ?? []) {
        if (s.bound_flag === 1 && s.app_shop_id) out.push(s.app_shop_id);
      }
      if (pageNo >= (data?.total_page ?? 1)) break;
    }
    return out;
  }

  // ===================================================================
  // Menu API — cardápio (DOCUMENTADO ✅)
  // ===================================================================

  /**
   * GET /v3/item/item/list — baixa o cardápio da loja e mapeia pro
   * RemoteMenu interno (categorias + itens, formato plano).
   *
   * No 99Food a relação é invertida: a categoria lista os `app_item_ids`;
   * o item não carrega a categoria. Reconstruímos iterando as categorias.
   * Itens `is_sold_separately: false` são sub-itens de modifier group
   * (não vendáveis sozinhos) — ficam fora do catálogo de produtos.
   */
  async fetchMenu(tokens: StoredTokens, _externalMerchantId: string): Promise<RemoteMenu> {
    const menu = await this.fetchRawMenu(tokens);

    const itemsById = new Map<string, RawMenuItemFull>();
    for (const it of menu.items ?? []) {
      if (it.app_item_id) itemsById.set(it.app_item_id, it);
    }

    const validCategories = (menu.categories ?? []).filter((c) => c.app_category_id);

    const categories: RemoteCategory[] = validCategories.map((c) => ({
      externalId: c.app_category_id!,
      name: c.category_name ?? 'Categoria',
      sortOrder: c.priority,
    }));

    const items: RemoteMenuItem[] = [];
    const seen = new Set<string>();
    for (const c of validCategories) {
      for (const itemId of c.app_item_ids ?? []) {
        if (seen.has(itemId)) continue;
        const it = itemsById.get(itemId);
        if (!it || it.is_sold_separately === false) continue;
        seen.add(itemId);
        items.push({
          externalId: itemId,
          externalCategoryId: c.app_category_id!,
          name: it.item_name ?? itemId,
          description: it.short_desc || undefined,
          sellingPriceCents: it.price ?? 0,
          isAvailable: (it.status ?? 1) === 1,
          isPublished: true,
          imageUrl: it.head_img || undefined,
        });
      }
    }
    return { categories, items };
  }

  /**
   * POST /v3/item/item/updateItem — atualiza o preço de um item.
   *
   * O 99Food não tem endpoint de "só preço": o updateItem exige item_name,
   * status e is_sold_separately. Buscamos o item atual no /list e
   * reenviamos os campos, sobrescrevendo só o preço (ver buildUpdateItemBody).
   */
  async pushItemPrice(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalId: string,
    sellingPriceCents: number,
  ): Promise<void> {
    const menu = await this.fetchRawMenu(tokens);
    const item = (menu.items ?? []).find((it) => it.app_item_id === externalId);
    if (!item) {
      throw new AdapterApiError('99food_menu_item_not_found', 404, {
        app_item_id: externalId,
      });
    }
    await this.postJson('/v3/item/item/updateItem', {
      ...buildUpdateItemBody(item),
      auth_token: tokens.accessToken,
      price: sellingPriceCents,
    });
  }

  /**
   * POST /v3/item/item/updateItemStatus — marca o item disponível (1) ou
   * indisponível (2). A resposta traz success[]/failed[] por item.
   */
  async pushItemAvailability(
    tokens: StoredTokens,
    _externalMerchantId: string,
    externalId: string,
    available: boolean,
  ): Promise<void> {
    const data = await this.postJson<{ failed?: string[] }>(
      '/v3/item/item/updateItemStatus',
      {
        auth_token: tokens.accessToken,
        app_item_ids: [externalId],
        status: available ? 1 : 2,
      },
    );
    if (data?.failed?.includes(externalId)) {
      throw new AdapterApiError('99food_item_status_update_failed', 502, {
        app_item_id: externalId,
      });
    }
  }

  /** GET /v3/item/item/list — cardápio cru da loja. */
  private async fetchRawMenu(tokens: StoredTokens): Promise<RawMenuList> {
    return this.get<RawMenuList>('/v3/item/item/list', {
      auth_token: tokens.accessToken,
    });
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
   * POST com body JSON. Campos `long` 64-bit (order_id, app_id, shop_id)
   * são emitidos como literal numérico cru pra preservar a precisão.
   */
  private async post<T>(
    path: string,
    fields: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.request<T>('POST', path, buildJsonBody(fields, RAW_NUMERIC_KEYS));
  }

  /**
   * POST com body JSON arbitrário (objetos/arrays aninhados). Usado pelos
   * endpoints de cardápio — que não têm IDs `long` 64-bit, então o
   * JSON.stringify padrão é seguro.
   */
  private async postJson<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, JSON.stringify(body));
  }

  /**
   * POST com body JSON aninhado + `order_id` long 64-bit como literal cru.
   * Usado pelo Self Delivery (corpo tem objetos courier_info/vehicle/
   * limit_time, mas `order_id` não pode passar por JSON.stringify).
   */
  private async postWithOrderId<T>(
    path: string,
    orderId: string,
    rest: object,
  ): Promise<T> {
    const restJson = JSON.stringify(rest);
    const idPart = /^\d+$/.test(orderId) ? orderId : JSON.stringify(orderId);
    const body =
      restJson === '{}'
        ? `{"order_id":${idPart}}`
        : `{"order_id":${idPart},${restJson.slice(1)}`;
    return this.request<T>('POST', path, body);
  }

  /**
   * Igual a `request`, mas devolve o corpo CRU — usado quando a resposta
   * tem IDs `long` 64-bit (ex.: area_id_list) que JSON.parse corromperia.
   */
  private async requestRaw(
    method: string,
    pathWithQuery: string,
    rawJsonBody?: string,
  ): Promise<string> {
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
      throw new AdapterApiError(
        `99food_network_error ${method} ${stripQuery(pathWithQuery)}`,
        0,
        err instanceof Error ? err.message : 'network_error',
      );
    }
    const text = await res.text();
    const errno = (safeJson(text) as { errno?: number } | undefined)?.errno;
    this.log?.({
      method,
      path: stripQuery(pathWithQuery),
      status: res.status,
      durationMs: Date.now() - start,
      ok: res.ok && errno === 0,
      errno,
    });
    if (!res.ok) {
      throw new AdapterApiError(
        `99food_http_error ${res.status} ${method} ${stripQuery(pathWithQuery)}`,
        res.status,
        text,
      );
    }
    if (errno !== 0) {
      throw new AdapterApiError(
        `99food_api_error errno=${errno} ${stripQuery(pathWithQuery)}`,
        res.status,
        text,
      );
    }
    return text;
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
    paymentMethod: mapPaymentMethod(info.pay_type),
    deliveryBy: info.delivery_type === 2 ? 'store' : info.delivery_type === 1 ? 'platform' : undefined,
  };
}

/**
 * pay_type do 99Food → forma de pagamento interna.
 *  1 = Online · 2 = Cash · 3 = POS · 4 = Wallet · 5/6 = PayPay.
 */
function mapPaymentMethod(payType: number | undefined): OrderPaymentMethod | undefined {
  switch (payType) {
    case 1:
      return 'online';
    case 2:
      return 'cash';
    case undefined:
      return undefined;
    default:
      return 'other';
  }
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

/** Monta o objeto `courier_info` do Self Delivery. */
function buildCourierInfo(c: DidifoodCourier): Record<string, unknown> {
  const info: Record<string, unknown> = {
    courier_name: c.name,
    courier_first_name: c.firstName,
    courier_last_name: c.lastName,
    courier_phone_code: c.phoneCode,
    courier_phone: c.phone,
  };
  if (c.id) info.courier_id = c.id;
  if (c.imageUrl) info.courier_image_url = c.imageUrl;
  return info;
}

/** Monta o objeto `vehicle` do Self Delivery (vazio se não houver dados). */
function buildVehicle(c: DidifoodCourier): { vehicle?: Record<string, unknown> } {
  if (c.vehicleType == null && !c.vehicleNumber) return {};
  const vehicle: Record<string, unknown> = {};
  if (c.vehicleType != null) vehicle.vehicle_type = c.vehicleType;
  if (c.vehicleNumber) vehicle.vehicle_number = c.vehicleNumber;
  return { vehicle };
}

/** Campos comuns de área de entrega (add / update). */
function deliveryAreaBody(input: DidifoodDeliveryAreaInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    area_type: input.areaType,
    avg_delivery_eta: input.avgDeliveryEtaSeconds,
    enable_time_list: input.enableTimes,
    price: input.priceCents,
  };
  if (input.areaType === 0) body.radius = input.radiusKm ?? 0;
  else body.points = input.points ?? [];
  return body;
}

/**
 * Monta o corpo de update/delete de área de entrega — `area_id_list` é
 * lista de `long` 64-bit, emitida como literais numéricos crus.
 */
function buildDeliveryAreaIdBody(
  authToken: string,
  areaIds: string[],
  rest: Record<string, unknown> = {},
): string {
  const ids = areaIds.filter((id) => /^\d+$/.test(id)).join(',');
  const head = JSON.stringify({ auth_token: authToken, ...rest });
  return `${head.slice(0, -1)},"area_id_list":[${ids}]}`;
}

interface RawDeliveryAreaGroup {
  area_type?: number;
  radius?: number;
  price?: number;
  avg_delivery_eta?: number;
  display_enable_times?: string;
  points?: unknown[];
}

/** Parseia a resposta de Get Delivery Area (area_id_list é long 64-bit). */
function parseDeliveryAreas(rawText: string): DidifoodDeliveryArea[] {
  const json = safeJson(rawText) as
    | { data?: { areaGroup?: RawDeliveryAreaGroup[] } }
    | undefined;
  const groups = json?.data?.areaGroup ?? [];
  const idArrays = matchBigIntArrays(rawText, 'area_id_list');
  return groups.map((g, i) => ({
    areaIds: idArrays[i] ?? [],
    areaType: g.area_type ?? 0,
    radiusKm: g.radius ?? 0,
    priceCents: g.price ?? 0,
    avgDeliveryEtaSeconds: g.avg_delivery_eta ?? 0,
    enableTimesLabel: g.display_enable_times ?? '',
    pointCount: Array.isArray(g.points) ? g.points.length : 0,
  }));
}

/** Extrai todos os arrays de um campo numérico 64-bit do JSON cru. */
function matchBigIntArrays(raw: string, field: string): string[][] {
  const out: string[][] = [];
  const re = new RegExp(`"${field}"\\s*:\\s*\\[([^\\]]*)\\]`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1]!.match(/\d+/g) ?? []);
  }
  return out;
}

/** Serializa o pendingHandle (snapshot de bind) em base64url. */
function encodeHandle(handle: DidifoodPendingHandle): string {
  return Buffer.from(JSON.stringify(handle), 'utf8').toString('base64url');
}

/** Lê o pendingHandle; handle corrompido vira erro claro (não silencioso). */
function decodeHandle(handle: string): DidifoodPendingHandle {
  try {
    const o = JSON.parse(
      Buffer.from(handle, 'base64url').toString('utf8'),
    ) as Partial<DidifoodPendingHandle>;
    return {
      knownShopIds: Array.isArray(o.knownShopIds)
        ? o.knownShopIds.filter((x): x is string => typeof x === 'string')
        : [],
      startedAt: typeof o.startedAt === 'number' ? o.startedAt : 0,
    };
  } catch {
    throw new AdapterApiError('99food_invalid_pending_handle', 400);
  }
}

/** Extrai o `errno` de um AdapterApiError do 99Food (vem no `body`). */
function errnoOf(err: unknown): number | undefined {
  if (err instanceof AdapterApiError && err.body && typeof err.body === 'object') {
    const errno = (err.body as { errno?: unknown }).errno;
    if (typeof errno === 'number') return errno;
  }
  return undefined;
}

/**
 * Converte um horário-alvo de reabertura no enum `pause_time` do 99Food:
 *  1 = 10min · 2 = 20min · 3 = 30min · 4 = até o fim do dia.
 * Sem `until` (pausa indefinida) → 4.
 */
function pauseTimeCode(until?: Date): number {
  if (!until) return 4;
  const minutes = (until.getTime() - Date.now()) / 60_000;
  if (minutes <= 15) return 1;
  if (minutes <= 25) return 2;
  if (minutes <= 45) return 3;
  return 4;
}

/**
 * Monta o corpo do updateItem ecoando os campos atuais do item — o
 * caller sobrescreve `auth_token` e `price`.
 *
 * `activity_price` (preço promocional) é omitido de propósito: se o novo
 * preço-base cair abaixo da promo antiga, o 99Food rejeita (errno 100103).
 * Omitir = vende pelo preço-base novo, sem promo (errno 100101). Promoções
 * são gerenciadas à parte, não por edição de preço vinda do Hub.
 */
function buildUpdateItemBody(item: RawMenuItemFull): Record<string, unknown> {
  const body: Record<string, unknown> = {
    app_item_id: item.app_item_id,
    item_name: item.item_name ?? item.app_item_id ?? '',
    status: item.status ?? 1,
    is_sold_separately: item.is_sold_separately ?? true,
  };
  if (item.app_external_id !== undefined) body.app_external_id = item.app_external_id;
  if (item.short_desc) body.short_desc = item.short_desc;
  if (item.head_img) body.head_img = item.head_img;
  if (typeof item.priority === 'number') body.priority = item.priority;
  if (item.sold_info_intl && item.sold_info_intl.length > 0) {
    body.sold_info_intl = item.sold_info_intl;
  }
  return body;
}

/**
 * Monta JSON manualmente. Campos em `rawNumericKeys` são emitidos como
 * literal numérico cru (sem aspas) — usado pro order_id 64-bit, que não
 * pode passar por Number nem virar string sem mudar o tipo esperado.
 */
function buildJsonBody(
  fields: Record<string, string | number | boolean>,
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
