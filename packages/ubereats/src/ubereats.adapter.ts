import {
  AdapterApiError,
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
 * Uber Eats (Eats Marketplace API) adapter — **scaffolding stub**.
 *
 * A Uber Eats expõe uma plataforma robusta para integrações de POS via
 * developer portal (developer.uber.com). O fluxo é OAuth 2.0 Authorization
 * Code com `eats.store`/`eats.orders` scopes. Webhooks são autenticados
 * com HMAC-SHA256 no header `X-Uber-Signature`. Endpoints relevantes
 * (a confirmar com a doc oficial):
 *
 *   - POST https://login.uber.com/oauth/v2/token                 — token exchange
 *   - GET  /v2/eats/orders/{order_id}                            — fetch order
 *   - PUT  /v2/eats/stores/{store_id}/menus                      — sync menu
 *   - POST /v1/eats/orders/{order_id}/accept_pos_order           — accept
 *   - POST /v1/eats/orders/{order_id}/deny_pos_order             — reject
 *   - PATCH /v1/eats/stores/{store_id}/holiday_hours             — pause
 *
 * Requer parceria formal e onboarding com o time Uber. Enquanto isso, o
 * registry mantém um `MockAdapter('ubereats')` neste slot.
 */
export interface UberEatsAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
  /** Uber callback após o usuário autorizar o app. */
  redirectUri: string;
}

const NOT_IMPLEMENTED = 'ubereats_adapter_not_implemented_yet';

export class UberEatsAdapter implements PlatformAdapter {
  readonly code = 'ubereats' as const;

  constructor(private readonly config: UberEatsAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Implementar OAuth Authorization Code (gera URL de consent).',
    });
  }

  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async refreshAuth(_refreshToken: string): Promise<StoredTokens> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async fetchMenu(_tokens: StoredTokens, _externalMerchantId: string): Promise<RemoteMenu> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async fetchOrder(
    _tokens: StoredTokens,
    _externalMerchantId: string,
    _externalOrderId: string,
  ): Promise<RemoteOrder> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  parseWebhook(payload: unknown): WebhookEnvelope {
    // Padrão Uber Eats: { event_id, event_type, resource_href, meta: { order_id, store_id }, event_time }
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

  async pushItemPrice(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async pushItemAvailability(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async pushStorePause(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async acceptOrder(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async rejectOrder(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async dispatchOrder(): Promise<void> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  // Uber Eats trabalha primariamente via webhooks; sem polling público.
  async pollEvents(_tokens: StoredTokens, _externalMerchantId: string): Promise<PolledEvent[]> {
    return [];
  }
  async acknowledgeEvents(_tokens: StoredTokens, _eventIds: string[]): Promise<void> {}

  verifyWebhookSignature(_headers: Record<string, string>, _rawBody: Buffer): boolean {
    // TODO: HMAC-SHA256(rawBody, webhookSecret) vs header X-Uber-Signature.
    return false;
  }
}
