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
export type PolledEvent = WebhookEnvelope;

export interface PlatformAdapter {
  readonly code: PlatformCode;

  startConnection(): Promise<StartConnectionResult>;

  /**
   * Polling: o adapter consulta a plataforma para ver se o usuário já
   * autorizou. Levanta `ConnectionPendingError` se ainda não.
   */
  finalizeConnection(pendingHandle: string): Promise<FinalizeConnectionResult>;

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
