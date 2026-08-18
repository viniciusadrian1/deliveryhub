import type { PlatformCode } from '@deliveryhub/shared';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Início do fluxo OAuth Device — algo para o usuário fazer fora da app. */
export interface StartConnectionResult {
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresAt: Date;
  /** Token interno opaco a ser passado em finalize. */
  pendingHandle: string;
}

export interface FinalizeConnectionResult {
  tokens: StoredTokens;
  externalMerchantId: string;
}

export interface RemoteCategory {
  externalId: string;
  name: string;
  sortOrder?: number;
}

export interface RemoteMenuItem {
  externalId: string;
  /** Codigo externo real (EAN/SKU) do item na plataforma, distinto do externalId. */
  externalCode?: string;
  externalCategoryId: string | null;
  name: string;
  description?: string;
  sellingPriceCents: number;
  isAvailable: boolean;
  isPublished: boolean;
  imageUrl?: string;
}

export interface RemoteMenu {
  categories: RemoteCategory[];
  items: RemoteMenuItem[];
}

export type RemoteOrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export interface RemoteOrderCustomer {
  name: string;
  phone?: string;
  document?: string;
}

export interface RemoteOrderModifier {
  externalId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export interface RemoteOrderItem {
  externalId: string;
  externalCategoryId?: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  notes?: string;
  modifiers?: RemoteOrderModifier[];
}

/** Forma de pagamento informada pela plataforma. */
export type OrderPaymentMethod = 'online' | 'cash' | 'other';

/** Quem faz a entrega: a plataforma (entregador dela) ou a própria loja. */
export type OrderDeliveryBy = 'platform' | 'store';

/** Imediato = preparar/despachar já; agendado = segurar até a janela. */
export type OrderTiming = 'immediate' | 'scheduled';

/** Modalidade do pedido (define dispatch vs readyToPickup). */
export type OrderType = 'delivery' | 'takeout' | 'dine_in';

export interface RemoteOrderSchedule {
  /** Início da janela de entrega/retirada agendada. */
  deliveryStart: Date;
  deliveryEnd?: Date;
}

export interface RemoteOrder {
  externalId: string;
  externalMerchantId: string;
  status: RemoteOrderStatus;
  customer: RemoteOrderCustomer;
  items: RemoteOrderItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  flatFeeCents: number;
  notes?: string;
  placedAt: Date;
  /** Forma de pagamento, quando a plataforma informa. */
  paymentMethod?: OrderPaymentMethod;
  /** Quem entrega, quando a plataforma informa. */
  deliveryBy?: OrderDeliveryBy;
  /** Imediato ou agendado. Default 'immediate' quando ausente. */
  orderTiming?: OrderTiming;
  /** Modalidade (delivery/takeout/dine_in). */
  orderType?: OrderType;
  /** Janela agendada — presente só quando `orderTiming === 'scheduled'`. */
  schedule?: RemoteOrderSchedule;
}

export interface WebhookEnvelope {
  eventId: string;
  eventType: string;
  externalOrderId: string;
  externalMerchantId: string;
  occurredAt: Date;
}

/**
 * Evento devolvido pelo endpoint de polling. Compatível com `WebhookEnvelope`
 * (mesmos campos obrigatórios) — assim o pipeline de ingestão usa o mesmo
 * fluxo, venha de webhook ou poll.
 */
export interface PolledEvent extends WebhookEnvelope {
  /**
   * Metadados extras do evento, quando a plataforma envia. iFood usa em
   * eventos do grupo DELIVERY (ex.: ASSIGN_DRIVER traz `workerName`).
   */
  metadata?: Record<string, unknown>;
}

// ===== Catalog (publicação de cardápio na plataforma) =====

export interface RemoteCatalog {
  catalogId: string;
  /** Contextos do catálogo (iFood: DEFAULT = entrega, INDOOR, WHITELABEL). */
  context: string[];
  status?: string;
}

export interface PushCategoryInput {
  /** Id da categoria já existente na plataforma (se houver, evita duplicar). */
  externalId?: string;
  name: string;
  sortOrder?: number;
}

export interface PushCategoryResult {
  externalId: string;
}

export interface PushItemOption {
  /** Chave estável local (ex.: id do Modifier) — usada pra id determinístico. */
  externalId?: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
  sortOrder?: number;
}

export interface PushItemModifierGroup {
  /** Chave estável local (ex.: id do ModifierGroup). */
  externalId?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
  options: PushItemOption[];
}

export interface PushItemInput {
  /** Id do item na plataforma (update). Ausente = criação. */
  externalId?: string;
  /** Id da categoria NA PLATAFORMA (obrigatório no iFood). */
  externalCategoryId: string;
  name: string;
  description?: string;
  sellingPriceCents: number;
  isAvailable: boolean;
  /**
   * Caminho da imagem JÁ HOSPEDADA na plataforma (retorno de `uploadImage`),
   * não a URL pública nossa.
   */
  imagePath?: string;
  /** Código externo estável (nosso menuItemId) — chave de idempotência. */
  externalCode?: string;
  sortOrder?: number;
  modifierGroups?: PushItemModifierGroup[];
}

export interface PushItemResult {
  externalId: string;
  externalCategoryId: string;
}

// ===== Financial (repasses oficiais da plataforma) =====

export interface RemoteSettlement {
  periodStart: Date;
  periodEnd: Date;
  /** Valor do repasse em centavos (líquido, como informado pela plataforma). */
  amountCents: number;
  expectedPayDate?: Date;
  /** Tipo bruto da plataforma (iFood: REPASSE, BOLETO, ...). */
  type?: string;
  status?: string;
  externalId?: string;
}

// ===== Promotion =====

export interface CreatePromotionItemInput {
  /**
   * Identificador do item na plataforma: o EAN/externalCode do item no
   * catálogo — NÃO o id (UUID) do catálogo. Nosso `pushItem` grava o
   * menuItemId local como externalCode, então é ele que vai aqui.
   */
  ean: string;
  /** Desconto percentual (iFood só suporta percentual, máx. 70). */
  discountPercent: number;
  startsAt: Date;
  endsAt: Date;
}

export interface CreatePromotionInput {
  name: string;
  /** Tag única por tentativa — a plataforma exige NUNCA reutilizar. */
  aggregationTag: string;
  items: CreatePromotionItemInput[];
}

export interface CreatePromotionResult {
  /** Id assíncrono para consultar o processamento (iFood: aggregationId). */
  aggregationId: string;
}

export interface RemotePromotionItem {
  ean?: string;
  status: 'PROCESSING' | 'ACTIVE' | 'ERROR' | string;
  error?: string;
}

// ===== Logistics (rastreio do entregador da plataforma) =====

export interface RemoteOrderTracking {
  latitude: number;
  longitude: number;
  expectedDelivery?: Date;
  /** Epoch/minutos estimados, como a plataforma devolver (informativo). */
  etaMinutes?: number;
}

// ===== Merchant (status da loja + interrupcoes/pausa) =====

export interface RemoteInterruption {
  id: string;
  start: Date;
  end?: Date;
  description?: string;
}

export interface MerchantStatusValidation {
  id: string;
  code?: string;
  state?: string;
  message?: string;
}

/** Status de uma operacao da loja (iFood devolve um por operacao/canal). */
export interface RemoteMerchantStatus {
  operation?: string;
  salesChannel?: string;
  available: boolean;
  state?: string;
  validations: MerchantStatusValidation[];
  message?: string;
}

export interface PlatformAdapter {
  readonly code: PlatformCode;

  startConnection(): Promise<StartConnectionResult>;

  /**
   * Polling: o adapter consulta a plataforma para ver se o usuário já
   * autorizou. Levanta `ConnectionPendingError` se ainda não.
   */
  /**
   * Conclui a conexão. `authorizationCode` é o código que algumas plataformas
   * (iFood device flow) devolvem ao usuário APÓS ele autorizar no portal —
   * necessário pra trocar por tokens. Plataformas que não usam (99Food, Keeta)
   * ignoram o parâmetro.
   */
  finalizeConnection(
    pendingHandle: string,
    authorizationCode?: string,
  ): Promise<FinalizeConnectionResult>;

  refreshAuth(refreshToken: string): Promise<StoredTokens>;

  fetchMenu(tokens: StoredTokens, externalMerchantId: string): Promise<RemoteMenu>;

  fetchOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrder>;

  /**
   * Parseia o payload do webhook. `rawBody` (Buffer cru) é passado quando
   * disponível — algumas plataformas (ex.: 99Food) usam IDs `long` 64-bit
   * que `JSON.parse` corrompe; o adapter precisa do raw pra extrair esses
   * IDs como string sem perda de precisão. Implementações que não precisam
   * podem ignorar o segundo argumento.
   */
  parseWebhook(payload: unknown, rawBody?: Buffer): WebhookEnvelope;

  /**
   * Polling: consulta a plataforma por eventos pendentes (alternativa a
   * receber webhooks). Para iFood "Distribuído" é a forma recomendada.
   * Devolve array vazio se não há eventos.
   *
   * Implementações que não suportam polling devem devolver `[]` (mock,
   * stubs) — quem suporta de verdade lê os eventos e devolve já parseados.
   */
  pollEvents(tokens: StoredTokens, externalMerchantId: string): Promise<PolledEvent[]>;

  /**
   * Confirma para a plataforma que os eventos foram processados. iFood
   * deixa um evento pendente até receber ack — sem ack, o mesmo evento
   * aparece nos próximos polls.
   */
  acknowledgeEvents(tokens: StoredTokens, eventIds: string[]): Promise<void>;

  pushItemPrice(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalId: string,
    sellingPriceCents: number,
  ): Promise<void>;

  pushItemAvailability(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalId: string,
    available: boolean,
  ): Promise<void>;

  pushStorePause(
    tokens: StoredTokens,
    externalMerchantId: string,
    paused: boolean,
    until?: Date,
    reason?: string,
  ): Promise<void>;

  // ===== Merchant (opcional — status e interrupcoes no padrao da plataforma) =====

  /** Status de operacao da loja (disponibilidade + validacoes: polling, horario). */
  fetchMerchantStatus?(
    tokens: StoredTokens,
    externalMerchantId: string,
  ): Promise<RemoteMerchantStatus[]>;

  /** Cria uma interrupcao (pausa) da loja e devolve o id p/ remover depois. */
  createInterruption?(
    tokens: StoredTokens,
    externalMerchantId: string,
    input: { start: Date; end?: Date; description?: string },
  ): Promise<RemoteInterruption>;

  /** Lista as interrupcoes ativas da loja. */
  fetchInterruptions?(
    tokens: StoredTokens,
    externalMerchantId: string,
  ): Promise<RemoteInterruption[]>;

  /** Remove (encerra) uma interrupcao pelo id — retoma a loja. */
  removeInterruption?(
    tokens: StoredTokens,
    externalMerchantId: string,
    interruptionId: string,
  ): Promise<void>;

  acceptOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void>;

  rejectOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void>;

  dispatchOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void>;

  /**
   * Sinaliza pra plataforma que o pedido entrou em preparo. Obrigatório pra
   * homologação Order do iFood: sem essa transição, o app iFood do cliente
   * fica travado em "confirmado" e a homologação falha.
   * Opcional — adapters que não têm o conceito (ex.: 99Food, Keeta) ignoram.
   */
  startPreparation?(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void>;

  /**
   * Sinaliza pra plataforma que o pedido está pronto pro entregador iFood
   * retirar. Obrigatório pra homologação Order quando a entrega é iFood.
   * Opcional — adapters que não têm o conceito ignoram.
   */
  readyToPickup?(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<void>;

  // ===== Catalog (opcional — plataformas com API de publicação de cardápio) =====

  /** Lista os catálogos do merchant (iFood tem 1+ por contexto). */
  fetchCatalogs?(tokens: StoredTokens, externalMerchantId: string): Promise<RemoteCatalog[]>;

  /** Cria a categoria na plataforma (ou devolve a existente se externalId veio). */
  pushCategory?(
    tokens: StoredTokens,
    externalMerchantId: string,
    catalogId: string,
    input: PushCategoryInput,
  ): Promise<PushCategoryResult>;

  /**
   * Upsert completo de um item (produto + grupos de complementos + opções)
   * no catálogo da plataforma. Idempotente por externalCode.
   */
  pushItem?(
    tokens: StoredTokens,
    externalMerchantId: string,
    catalogId: string,
    input: PushItemInput,
  ): Promise<PushItemResult>;

  /**
   * Sobe uma imagem pra plataforma. `imageDataUri` = data URI base64
   * (`data:image/png;base64,...`). Devolve o path interno da plataforma,
   * usável em `PushItemInput.imagePath`.
   */
  uploadImage?(
    tokens: StoredTokens,
    externalMerchantId: string,
    imageDataUri: string,
  ): Promise<string>;

  /** Altera o preco de um complemento (option) no catalogo. */
  pushOptionPrice?(
    tokens: StoredTokens,
    externalMerchantId: string,
    optionExternalId: string,
    priceCents: number,
  ): Promise<void>;

  /** Altera a disponibilidade (status) de um complemento (option). */
  pushOptionAvailability?(
    tokens: StoredTokens,
    externalMerchantId: string,
    optionExternalId: string,
    available: boolean,
  ): Promise<void>;

  // ===== Financial (opcional — repasses oficiais) =====

  /** Repasses oficiais da plataforma no período (data de pagamento). */
  fetchSettlements?(
    tokens: StoredTokens,
    externalMerchantId: string,
    from: Date,
    to: Date,
  ): Promise<RemoteSettlement[]>;

  // ===== Promotion (opcional) =====

  /** Cria promoções (processamento assíncrono na plataforma). */
  createPromotion?(
    tokens: StoredTokens,
    externalMerchantId: string,
    input: CreatePromotionInput,
  ): Promise<CreatePromotionResult>;

  /** Consulta o status de processamento dos itens de uma promoção. */
  fetchPromotionItems?(
    tokens: StoredTokens,
    externalMerchantId: string,
    aggregationId: string,
  ): Promise<RemotePromotionItem[]>;

  // ===== Logistics (opcional — rastreio do entregador da plataforma) =====

  /** Posição atual do entregador. `null` = sem rastreio ativo pro pedido. */
  fetchOrderTracking?(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrderTracking | null>;

  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean;
}

export class ConnectionPendingError extends Error {
  constructor() {
    super('connection_pending');
    this.name = 'ConnectionPendingError';
  }
}

export class AdapterApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AdapterApiError';
  }
}
