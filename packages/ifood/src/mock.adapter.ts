import { randomBytes } from 'node:crypto';

import {
  type FinalizeConnectionResult,
  type PlatformAdapter,
  type StartConnectionResult,
  type StoredTokens,
} from './adapter.interface.js';

/**
 * Adapter de mentirinha para dev/testes — quando as credenciais reais do iFood
 * ainda não estão disponíveis ou queremos rodar smokes/e2e sem chamar a API real.
 *
 * - startConnection retorna um userCode determinístico
 * - finalizeConnection sempre completa com sucesso e devolve um merchantId fake
 * - operações (pause, accept, etc.) são no-op silencioso
 */
export class MockAdapter implements PlatformAdapter {
  readonly code: PlatformAdapter['code'];

  constructor(code: PlatformAdapter['code'] = 'ifood') {
    this.code = code;
  }

  async startConnection(): Promise<StartConnectionResult> {
    const userCode = randomBytes(3).toString('hex').toUpperCase();
    return {
      userCode,
      verificationUrl: 'https://mock.deliveryhub.local/auth',
      verificationUrlComplete: `https://mock.deliveryhub.local/auth?code=${userCode}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      pendingHandle: `mock:${userCode}`,
    };
  }

  async finalizeConnection(pendingHandle: string): Promise<FinalizeConnectionResult> {
    return {
      tokens: {
        accessToken: `mock-access-${pendingHandle}`,
        refreshToken: `mock-refresh-${pendingHandle}`,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      externalMerchantId: `mock-merchant-${pendingHandle.slice(-6)}`,
    };
  }

  async refreshAuth(refreshToken: string): Promise<StoredTokens> {
    return {
      accessToken: `mock-access-${randomBytes(4).toString('hex')}`,
      refreshToken,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
  }

  async fetchMenu() {
    // Devolve um cardápio fake reproduzível — útil para testar a sincronização inicial.
    return {
      categories: [
        { externalId: 'mock-cat-burgers', name: 'Hambúrgueres', sortOrder: 0 },
        { externalId: 'mock-cat-drinks', name: 'Bebidas', sortOrder: 1 },
      ],
      items: [
        {
          externalId: 'mock-item-smash',
          externalCategoryId: 'mock-cat-burgers',
          name: 'Smash Duplo',
          description: 'Dois smash 90g, queijo, alface, tomate, molho.',
          sellingPriceCents: 3990,
          isAvailable: true,
          isPublished: true,
        },
        {
          externalId: 'mock-item-cheeseburger',
          externalCategoryId: 'mock-cat-burgers',
          name: 'Cheeseburger',
          sellingPriceCents: 2890,
          isAvailable: true,
          isPublished: true,
        },
        {
          externalId: 'mock-item-coke',
          externalCategoryId: 'mock-cat-drinks',
          name: 'Coca-Cola 350ml',
          sellingPriceCents: 800,
          isAvailable: true,
          isPublished: true,
        },
      ],
    };
  }

  async fetchOrder(_tokens: StoredTokens, externalMerchantId: string, externalOrderId: string) {
    return {
      externalId: externalOrderId,
      externalMerchantId,
      status: 'placed' as const,
      customer: {
        name: 'Maria Silva',
        phone: '+5511999998888',
        document: '12345678900',
      },
      items: [
        {
          externalId: 'mock-item-smash',
          name: 'Smash Duplo',
          qty: 1,
          unitPriceCents: 3990,
          totalCents: 3990,
          modifiers: [
            { externalId: 'mock-mod-cheese', name: 'Cheddar extra', qty: 1, unitPriceCents: 400 },
          ],
        },
        {
          externalId: 'mock-item-coke',
          name: 'Coca-Cola 350ml',
          qty: 1,
          unitPriceCents: 800,
          totalCents: 800,
        },
      ],
      subtotalCents: 5190,
      deliveryFeeCents: 990,
      totalCents: 6180,
      platformFeeCents: 1194,
      processingFeeCents: 155,
      flatFeeCents: 0,
      notes: 'Por favor caprichar',
      placedAt: new Date(),
    };
  }

  parseWebhook(payload: unknown) {
    const p = payload as {
      id?: string;
      code?: string;
      orderId?: string;
      merchantId?: string;
      createdAt?: string;
    };
    return {
      eventId: p.id ?? `mock-evt-${Date.now()}`,
      eventType: p.code ?? 'PLC',
      externalOrderId: p.orderId ?? `mock-order-${Date.now()}`,
      externalMerchantId: p.merchantId ?? 'mock-merchant',
      occurredAt: new Date(p.createdAt ?? Date.now()),
    };
  }

  async pushItemPrice(): Promise<void> {}
  async pushItemAvailability(): Promise<void> {}
  async pushStorePause(): Promise<void> {}
  async acceptOrder(): Promise<void> {}
  async rejectOrder(): Promise<void> {}
  async dispatchOrder(): Promise<void> {}

  // Mock não tem eventos reais — devolve array vazio. Ack é no-op.
  async pollEvents() {
    return [];
  }
  async acknowledgeEvents(): Promise<void> {}

  verifyWebhookSignature(): boolean {
    return true;
  }
}
