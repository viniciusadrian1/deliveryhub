import {
  type FinalizeConnectionResult,
  MockAdapter,
  type PlatformAdapter,
  type PolledEvent,
  type RemoteMenu,
  type RemoteOrder,
  type StartConnectionResult,
  type StoredTokens,
  type WebhookEnvelope,
} from '@deliveryhub/ifood';

export interface UberEatsAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
  redirectUri: string;
}

export class UberEatsAdapter implements PlatformAdapter {
  readonly code = 'ubereats' as const;
  private readonly fallback = new MockAdapter('ubereats');

  constructor(private readonly config: UberEatsAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    return this.fallback.startConnection();
  }

  async finalizeConnection(
    pendingHandle: string,
    authorizationCode?: string,
  ): Promise<FinalizeConnectionResult> {
    return this.fallback.finalizeConnection(pendingHandle, authorizationCode);
  }

  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    return this.fallback.refreshAuth(refreshToken);
  }

  async fetchMenu(_tokens: StoredTokens, _externalMerchantId: string): Promise<RemoteMenu> {
    return this.fallback.fetchMenu();
  }

  async fetchOrder(
    tokens: StoredTokens,
    externalMerchantId: string,
    externalOrderId: string,
  ): Promise<RemoteOrder> {
    return this.fallback.fetchOrder(tokens, externalMerchantId, externalOrderId);
  }

  parseWebhook(payload: unknown): WebhookEnvelope {
    const p = payload as {
      event_id?: string;
      event_type?: string;
      event_time?: number | string;
      meta?: { order_id?: string; store_id?: string; user_id?: string };
    };
    return {
      eventId: p.event_id ?? `ubereats-evt-${Date.now()}`,
      eventType: p.event_type ?? 'unknown',
      externalOrderId: p.meta?.order_id ?? '',
      externalMerchantId: p.meta?.store_id ?? '',
      occurredAt: new Date(p.event_time ?? Date.now()),
    };
  }

  async pushItemPrice(): Promise<void> {}

  async pushItemAvailability(): Promise<void> {}

  async pushStorePause(): Promise<void> {}

  async acceptOrder(): Promise<void> {}

  async rejectOrder(): Promise<void> {}

  async dispatchOrder(): Promise<void> {}

  async pollEvents(_tokens: StoredTokens, _externalMerchantId: string): Promise<PolledEvent[]> {
    return [];
  }

  async acknowledgeEvents(_tokens: StoredTokens, _eventIds: string[]): Promise<void> {}

  verifyWebhookSignature(_headers: Record<string, string>, _rawBody: Buffer): boolean {
    return true;
  }
}

