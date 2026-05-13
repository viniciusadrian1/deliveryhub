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
