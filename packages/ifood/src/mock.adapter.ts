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

  async pushItemAvailability(): Promise<void> {}
  async pushStorePause(): Promise<void> {}
  async acceptOrder(): Promise<void> {}
  async rejectOrder(): Promise<void> {}
  async dispatchOrder(): Promise<void> {}

  verifyWebhookSignature(): boolean {
    return true;
  }
}
