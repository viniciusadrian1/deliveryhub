import {
  AdapterApiError,
  type FinalizeConnectionResult,
  type PlatformAdapter,
  type RemoteMenu,
  type RemoteOrder,
  type StartConnectionResult,
  type StoredTokens,
  type WebhookEnvelope,
} from '@deliveryhub/ifood';

/**
 * 99Food (DiDi Food) adapter — **scaffolding stub**.
 *
 * Portal de desenvolvedor: https://developer-food.99app.com/pt-BR/home
 *
 * Filesystem-wise o pacote se chama `didifood` (DiDi é a empresa-mãe) para
 * evitar nomes começando com dígito em TypeScript/identifiers. O
 * `PlatformCode` permanece `'99food'` — é o brand voltado pro usuário.
 *
 * O fluxo típico observado em portais DiDi Open:
 *   - OAuth 2.0 Client Credentials (server-to-server) — recebe `access_token`
 *     com TTL curto que precisa ser renovado periodicamente.
 *   - Webhook autenticado com HMAC-SHA256 em header `X-99Food-Signature`
 *     (a confirmar com a doc oficial após cadastro).
 *   - Endpoints prováveis (a validar):
 *       POST /oauth/token                     — token exchange
 *       GET  /v1/orders/{id}                  — fetch order
 *       PUT  /v1/menu                          — sync menu
 *       POST /v1/orders/{id}/confirm|reject   — accept/reject
 *       PATCH /v1/store/availability          — pause
 *
 * Quando o cadastro no portal estiver concluído, preencha as 3 env vars no
 * `.env` (`DIDIFOOD_CLIENT_ID/SECRET/WEBHOOK_SECRET`) e implemente os
 * métodos abaixo substituindo os `throw NOT_IMPLEMENTED`.
 */
export interface DidifoodAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

const NOT_IMPLEMENTED = '99food_adapter_not_implemented_yet';

export class DidifoodAdapter implements PlatformAdapter {
  readonly code = '99food' as const;

  constructor(private readonly config: DidifoodAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Implementar OAuth Client Credentials contra o 99Food Open Platform.',
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
    const p = payload as {
      event_id?: string;
      id?: string;
      event_type?: string;
      type?: string;
      order_id?: string;
      store_id?: string;
      shop_id?: string;
      timestamp?: number | string;
      created_at?: string;
    };
    return {
      eventId: p.event_id ?? p.id ?? `99food-evt-${Date.now()}`,
      eventType: p.event_type ?? p.type ?? 'unknown',
      externalOrderId: p.order_id ?? '',
      externalMerchantId: p.shop_id ?? p.store_id ?? '',
      occurredAt: new Date(p.created_at ?? p.timestamp ?? Date.now()),
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

  verifyWebhookSignature(_headers: Record<string, string>, _rawBody: Buffer): boolean {
    // TODO: HMAC-SHA256 com webhookSecret e header X-99Food-Signature
    // (nome real do header a confirmar na doc do portal).
    return false;
  }
}
