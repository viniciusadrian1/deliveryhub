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
 * Rappi Partners adapter — **scaffolding stub**.
 *
 * Rappi expose uma Partner API (Marketplace + Orders + Menu) via OAuth 2.0
 * Client Credentials, mas o acesso é gateado por parceria comercial direta
 * com o time deles (não há self-service no portal). Quando a parceria for
 * formalizada, os métodos abaixo precisam ser implementados contra a
 * documentação oficial. Endpoints relevantes (a confirmar com o time Rappi):
 *
 *   - POST {API_BASE}/api/v2/restaurants/auth/login   — obter access_token
 *   - GET  {API_BASE}/api/v2/orders/{id}              — buscar pedido
 *   - PUT  {API_BASE}/api/v2/restaurants/{id}/menu    — sincronizar menu
 *   - POST {API_BASE}/api/v2/orders/{id}/{action}     — accept/reject/dispatch
 *   - POST {API_BASE}/api/v2/restaurants/{id}/pause   — pause
 *   - Webhook → assinado com HMAC-SHA256, header `X-Rappi-Signature`
 *
 * Enquanto não temos credenciais reais, o `AdapterRegistry` registra um
 * `MockAdapter('rappi')` neste slot. Para promover este adapter para
 * "real", basta preencher RAPPI_CLIENT_ID, RAPPI_CLIENT_SECRET e
 * RAPPI_WEBHOOK_SECRET no `.env` — o registry detecta e instancia esta
 * classe (que ainda vai lançar `not_implemented` em todos os métodos
 * até alguém preencher).
 */
export interface RappiAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

const NOT_IMPLEMENTED = 'rappi_adapter_not_implemented_yet';

export class RappiAdapter implements PlatformAdapter {
  readonly code = 'rappi' as const;

  constructor(private readonly config: RappiAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'Implementar Rappi OAuth Client Credentials login.',
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
    // Estrutura tentativa baseada em padrões Rappi públicos — confirmar.
    const p = payload as {
      id?: string;
      event_id?: string;
      type?: string;
      event?: string;
      order_id?: string;
      orderId?: string;
      store_id?: string;
      storeId?: string;
      created_at?: string;
      createdAt?: string;
    };
    return {
      eventId: p.event_id ?? p.id ?? `rappi-evt-${Date.now()}`,
      eventType: p.event ?? p.type ?? 'unknown',
      externalOrderId: p.order_id ?? p.orderId ?? '',
      externalMerchantId: p.store_id ?? p.storeId ?? '',
      occurredAt: new Date(p.created_at ?? p.createdAt ?? Date.now()),
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

  // Rappi não tem API de polling pública conhecida; até a parceria definir
  // o caminho, devolvemos array vazio (poller ignora) e ack é no-op.
  async pollEvents(_tokens: StoredTokens, _externalMerchantId: string): Promise<PolledEvent[]> {
    return [];
  }
  async acknowledgeEvents(_tokens: StoredTokens, _eventIds: string[]): Promise<void> {}

  verifyWebhookSignature(_headers: Record<string, string>, _rawBody: Buffer): boolean {
    // TODO: HMAC-SHA256 com webhookSecret + header X-Rappi-Signature.
    // Rejeita por padrão para não aceitar payloads não autenticados em prod.
    return false;
  }
}
