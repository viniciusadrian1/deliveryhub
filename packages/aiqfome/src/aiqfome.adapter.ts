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

export interface AiqfomeAdapterConfig {
  apiKey: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

export class AiqfomeAdapter implements PlatformAdapter {
  readonly code = 'aiqfome' as const;
  private readonly fallback = new MockAdapter('aiqfome');

  constructor(private readonly config: AiqfomeAdapterConfig) {}

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
      id?: string;
      type?: string;
      order_id?: string;
      store_id?: string;
      timestamp?: string;
    };
    return {
      eventId: p.id ?? `aiqfome-evt-${Date.now()}`,
      eventType: p.type ?? 'unknown',
      externalOrderId: p.order_id ?? '',
      externalMerchantId: p.store_id ?? '',
      occurredAt: new Date(p.timestamp ?? Date.now()),
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

