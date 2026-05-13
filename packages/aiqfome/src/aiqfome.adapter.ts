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
 * AiQfome (Magalu Marketplace) adapter — **scaffolding stub**.
 *
 * AiQfome, hoje parte da Magalu, expõe uma API para parceiros POS através
 * do programa Magalu Marketplace. A documentação não é pública (acesso
 * sob NDA), mas o padrão observado em integrações conhecidas é:
 *
 *   - Auth: API Key estática + Secret HMAC para webhooks (sem OAuth).
 *   - GET  /v1/orders/{id}              — buscar pedido
 *   - PUT  /v1/menu                      — sincronizar menu
 *   - POST /v1/orders/{id}/accept|reject — confirmar/rejeitar
 *   - PATCH /v1/store/availability       — pausa
 *   - Webhook: HMAC-SHA256 em header `X-Aiqfome-Signature`
 *
 * Como é API Key e não OAuth, o "fluxo de conexão" no MVP pode ser um
 * formulário simples (cole sua API key) em vez de Device Flow. O
 * `startConnection` então retornaria uma URL para um formulário interno
 * (ou poderia ser feito direto via REST sem passar pelo OAuth dance).
 *
 * Enquanto a parceria com Magalu não está fechada, o registry mantém
 * `MockAdapter('aiqfome')` ativo neste slot.
 */
export interface AiqfomeAdapterConfig {
  apiKey: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

const NOT_IMPLEMENTED = 'aiqfome_adapter_not_implemented_yet';

export class AiqfomeAdapter implements PlatformAdapter {
  readonly code = 'aiqfome' as const;

  constructor(private readonly config: AiqfomeAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501, {
      hint: 'AiQfome usa API Key — fluxo deve ser um formulário, não Device Flow.',
    });
  }

  async finalizeConnection(_pendingHandle: string): Promise<FinalizeConnectionResult> {
    throw new AdapterApiError(NOT_IMPLEMENTED, 501);
  }

  async refreshAuth(_refreshToken: string): Promise<StoredTokens> {
    // API Key não rotaciona — devolve os mesmos tokens.
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
    // TODO: HMAC-SHA256 com webhookSecret e header X-Aiqfome-Signature.
    return false;
  }
}
