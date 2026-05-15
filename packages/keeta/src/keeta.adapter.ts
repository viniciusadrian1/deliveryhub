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
 * Keeta (Meituan Overseas) adapter — **scaffolding stub**.
 *
 * Portal de desenvolvedor: https://developers.mykeeta.com
 *
 * A Keeta é a operação internacional do Meituan (líder de delivery na
 * China). Atua principalmente em Hong Kong, Arábia Saudita e mais
 * recentemente expandindo na América Latina, incluindo o Brasil.
 *
 * O padrão de plataformas Meituan/Keeta observado (a confirmar com a doc
 * pública após cadastro no portal):
 *   - OAuth 2.0 Client Credentials, server-to-server.
 *   - Tokens com TTL ~2h, sem refresh token (renova com client_credentials
 *     novamente).
 *   - Webhook assinado com HMAC-SHA256, header `X-Keeta-Signature`
 *     ou `X-Mt-Signature`.
 *   - Endpoints prováveis:
 *       POST /oauth2/token                     — token exchange
 *       GET  /v1/orders/{order_id}             — fetch order
 *       PUT  /v1/menu                           — sync menu
 *       POST /v1/orders/{order_id}/{action}    — accept/reject/dispatch
 *       PATCH /v1/store/status                 — pause
 *
 * Para ativar: cadastre o app no portal mykeeta, gere credenciais e
 * preencha `KEETA_CLIENT_ID/SECRET/WEBHOOK_SECRET` no `.env`. Depois
 * implemente os métodos abaixo.
 */
export interface KeetaAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

const NOT_IMPLEMENTED = 'keeta_adapter_not_implemented_yet';

export class KeetaAdapter implements PlatformAdapter {
  readonly code = 'keeta' as const;

  constructor(private readonly config: KeetaAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Implementar OAuth Client Credentials contra Keeta openapi.',
    });
  }

  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async refreshAuth(_refreshToken: string): Promise<StoredTokens> {
    // Client Credentials não tem refresh — renovação é client_credentials
    // novamente. Mas mantemos o método na interface por consistência.
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
      eventId?: string;
      event_type?: string;
      eventType?: string;
      order_id?: string;
      orderId?: string;
      store_id?: string;
      storeId?: string;
      merchant_id?: string;
      timestamp?: number | string;
    };
    return {
      eventId: p.event_id ?? p.eventId ?? `keeta-evt-${Date.now()}`,
      eventType: p.event_type ?? p.eventType ?? 'unknown',
      externalOrderId: p.order_id ?? p.orderId ?? '',
      externalMerchantId: p.merchant_id ?? p.store_id ?? p.storeId ?? '',
      occurredAt: new Date(p.timestamp ?? Date.now()),
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

  // Keeta: padrão Meituan tende a webhook, mas a API openapi pode oferecer
  // polling — confirmar com doc oficial após cadastro.
  async pollEvents(_tokens: StoredTokens, _externalMerchantId: string): Promise<PolledEvent[]> {
    return [];
  }
  async acknowledgeEvents(_tokens: StoredTokens, _eventIds: string[]): Promise<void> {}

  verifyWebhookSignature(_headers: Record<string, string>, _rawBody: Buffer): boolean {
    // TODO: HMAC-SHA256 com webhookSecret e header X-Keeta-Signature
    // (nome real do header a confirmar na doc oficial).
    return false;
  }
}
