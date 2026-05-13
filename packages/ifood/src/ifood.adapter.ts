import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  AdapterApiError,
  ConnectionPendingError,
  type FinalizeConnectionResult,
  type PlatformAdapter,
  type StartConnectionResult,
  type StoredTokens,
} from './adapter.interface.js';

/**
 * Configuração do IFoodAdapter — injetada pela camada de aplicação a partir do env.
 * Os endpoints seguem o iFood Merchant API v1 (developer.ifood.com.br).
 *
 * Quando a Anthropic AppSec aprovar a conta parceiro, validar:
 * - clientId/clientSecret reais
 * - endpoint base (merchant-api.ifood.com.br em produção,
 *   merchant-api-sandbox.ifood.com.br em sandbox)
 * - webhookSecret para HMAC nos webhooks
 */
export interface IFoodAdapterConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

interface PendingHandlePayload {
  authorizationCodeVerifier: string;
}

interface UserCodeResponse {
  userCode: string;
  authorizationCodeVerifier: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class IFoodAdapter implements PlatformAdapter {
  readonly code = 'ifood' as const;

  constructor(private readonly config: IFoodAdapterConfig) {}

  async startConnection(): Promise<StartConnectionResult> {
    const body = new URLSearchParams({ clientId: this.config.clientId });
    const data = await this.postForm<UserCodeResponse>('/authentication/v1.0/oauth/userCode', body);

    const handle = encodeHandle({ authorizationCodeVerifier: data.authorizationCodeVerifier });
    const expiresAt = new Date(Date.now() + data.expiresIn * 1000);

    return {
      userCode: data.userCode,
      verificationUrl: data.verificationUrl,
      verificationUrlComplete: data.verificationUrlComplete,
      expiresAt,
      pendingHandle: handle,
    };
  }

  async finalizeConnection(pendingHandle: string): Promise<FinalizeConnectionResult> {
    const { authorizationCodeVerifier } = decodeHandle(pendingHandle);
    const body = new URLSearchParams({
      grantType: 'authorization_code',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      authorizationCodeVerifier,
    });

    let tokens: TokenResponse;
    try {
      tokens = await this.postForm<TokenResponse>('/authentication/v1.0/oauth/token', body);
    } catch (err) {
      if (err instanceof AdapterApiError && err.status === 400) {
        // iFood retorna 400 enquanto o user-code ainda não foi confirmado pelo usuário.
        throw new ConnectionPendingError();
      }
      throw err;
    }

    const stored: StoredTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };

    const merchantId = await this.fetchFirstMerchantId(stored);

    return { tokens: stored, externalMerchantId: merchantId };
  }

  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    const body = new URLSearchParams({
      grantType: 'refresh_token',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken,
    });
    const data = await this.postForm<TokenResponse>('/authentication/v1.0/oauth/token', body);
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date(Date.now() + data.expiresIn * 1000),
    };
  }

  async fetchMenu(tokens: StoredTokens, merchantId: string) {
    interface RawCategory {
      id: string;
      name: string;
      sortOrder?: number;
      items?: RawItem[];
    }
    interface RawItem {
      id: string;
      categoryId?: string;
      name: string;
      description?: string;
      priceCents?: number;
      price?: { value: number };
      status?: 'AVAILABLE' | 'UNAVAILABLE';
      isPublished?: boolean;
      imageUrl?: string;
    }

    const data = await this.get<{ categories: RawCategory[] }>(
      `/catalog/v2.0/merchants/${merchantId}/catalog`,
      tokens,
    );

    const categories = data.categories.map((c) => ({
      externalId: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    }));

    const items = data.categories.flatMap((c) =>
      (c.items ?? []).map((it) => ({
        externalId: it.id,
        externalCategoryId: it.categoryId ?? c.id,
        name: it.name,
        description: it.description,
        sellingPriceCents:
          typeof it.priceCents === 'number'
            ? it.priceCents
            : it.price
              ? Math.round(it.price.value * 100)
              : 0,
        isAvailable: (it.status ?? 'AVAILABLE') === 'AVAILABLE',
        isPublished: it.isPublished ?? true,
        imageUrl: it.imageUrl,
      })),
    );

    return { categories, items };
  }

  async pushItemPrice(
    tokens: StoredTokens,
    merchantId: string,
    externalId: string,
    sellingPriceCents: number,
  ): Promise<void> {
    await this.put(`/catalog/v2.0/merchants/${merchantId}/items/${externalId}/price`, tokens, {
      value: sellingPriceCents / 100,
    });
  }

  async pushItemAvailability(
    tokens: StoredTokens,
    merchantId: string,
    externalId: string,
    available: boolean,
  ): Promise<void> {
    await this.put(
      `/catalog/v2.0/merchants/${merchantId}/items/${externalId}/status`,
      tokens,
      { status: available ? 'AVAILABLE' : 'UNAVAILABLE' },
    );
  }

  async pushStorePause(
    tokens: StoredTokens,
    merchantId: string,
    paused: boolean,
    until?: Date,
    reason?: string,
  ): Promise<void> {
    await this.put(
      `/merchant/v1.0/merchants/${merchantId}/interruptions`,
      tokens,
      paused
        ? {
            start: new Date().toISOString(),
            end: until?.toISOString(),
            description: reason ?? 'Pausa via DeliveryHub',
          }
        : { resume: true },
    );
  }

  async acceptOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/confirm`, tokens, {});
  }

  async rejectOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
    reason: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/requestCancellation`, tokens, {
      reason,
      cancellationCode: 'CUSTOMER_GIVE_UP',
    });
  }

  async dispatchOrder(
    tokens: StoredTokens,
    _merchantId: string,
    externalOrderId: string,
  ): Promise<void> {
    await this.post(`/order/v1.0/orders/${externalOrderId}/dispatch`, tokens, {});
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean {
    const sig = headers['x-ifood-signature'] ?? headers['X-Ifood-Signature'];
    if (typeof sig !== 'string') return false;
    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    } catch {
      return false;
    }
  }

  // -------------- helpers --------------

  private async fetchFirstMerchantId(tokens: StoredTokens): Promise<string> {
    const data = await this.get<Array<{ id: string }>>('/merchant/v1.0/merchants', tokens);
    const first = data[0];
    if (!first) throw new AdapterApiError('no_merchants_returned', 404);
    return first.id;
  }

  private async postForm<T>(path: string, body: URLSearchParams): Promise<T> {
    return this.request<T>('POST', path, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  private async post<T>(path: string, tokens: StoredTokens, body: unknown): Promise<T> {
    return this.request<T>('POST', path, {
      headers: this.authHeaders(tokens),
      body: JSON.stringify(body),
    });
  }

  private async put<T>(path: string, tokens: StoredTokens, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, {
      headers: this.authHeaders(tokens),
      body: JSON.stringify(body),
    });
  }

  private async get<T>(path: string, tokens: StoredTokens): Promise<T> {
    return this.request<T>('GET', path, { headers: this.authHeaders(tokens) });
  }

  private authHeaders(tokens: StoredTokens): Record<string, string> {
    return {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    init: { headers: Record<string, string>; body?: string | URLSearchParams },
  ): Promise<T> {
    const res = await fetch(this.config.apiBaseUrl + path, {
      method,
      headers: init.headers,
      body: init.body,
    });
    const text = await res.text();
    const json: unknown = text ? safeJson(text) : undefined;
    if (!res.ok) {
      throw new AdapterApiError(
        `ifood_api_error ${res.status} ${method} ${path}`,
        res.status,
        json ?? text,
      );
    }
    return (json ?? {}) as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function encodeHandle(payload: PendingHandlePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeHandle(handle: string): PendingHandlePayload {
  return JSON.parse(Buffer.from(handle, 'base64url').toString('utf-8')) as PendingHandlePayload;
}
