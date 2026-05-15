import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AiqfomeAdapter } from '@deliveryhub/aiqfome';
import { DidifoodAdapter } from '@deliveryhub/didifood';
import type { PlatformAdapter } from '@deliveryhub/ifood';
import { IFoodAdapter, MockAdapter } from '@deliveryhub/ifood';
import { KeetaAdapter } from '@deliveryhub/keeta';
import { RappiAdapter } from '@deliveryhub/rappi';
import type { PlatformCode } from '@deliveryhub/shared';
import { UberEatsAdapter } from '@deliveryhub/ubereats';

import { type Env, loadEnv } from '../../config/env.js';

/**
 * Registry de adapters por plataforma.
 *
 * Para cada plataforma suportada, o registry tenta instanciar o adapter
 * REAL se todas as env vars exigidas estiverem preenchidas. Caso
 * contrário, cai para um `MockAdapter` específico daquela plataforma —
 * o que permite testar o fluxo de UX (Hub, pausa, conexão fake) sem
 * credenciais reais.
 *
 * Plataformas sem operação no Brasil ou sem API pública (99Food, Keeta)
 * são deliberadamente NÃO registradas — qualquer tentativa de uso vai
 * gerar `adapter_not_registered`, sinal claro para a UI bloquear.
 */
@Injectable()
export class AdapterRegistry {
  private readonly logger = new Logger(AdapterRegistry.name);
  private readonly adapters = new Map<PlatformCode, PlatformAdapter>();

  constructor() {
    const env = loadEnv();

    this.registerIfood(env);
    this.registerRappi(env);
    this.registerUberEats(env);
    this.registerAiqfome(env);
    this.registerDidifood(env);
    this.registerKeeta(env);
  }

  private registerIfood(env: Env): void {
    if (env.IFOOD_CLIENT_ID && env.IFOOD_CLIENT_SECRET && env.IFOOD_WEBHOOK_SECRET) {
      const httpLogger = new Logger('IFoodAdapter.http');
      this.adapters.set(
        'ifood',
        new IFoodAdapter(
          {
            clientId: env.IFOOD_CLIENT_ID,
            clientSecret: env.IFOOD_CLIENT_SECRET,
            apiBaseUrl: env.IFOOD_API_BASE_URL,
            webhookSecret: env.IFOOD_WEBHOOK_SECRET,
          },
          {
            log: ({ method, path, status, durationMs, ok }) => {
              const msg = `${method} ${path} -> ${status} (${durationMs}ms)`;
              if (ok) httpLogger.debug(msg);
              else httpLogger.warn(msg);
            },
          },
        ),
      );
      this.logger.log('iFood adapter registered (real)');
    } else {
      this.adapters.set('ifood', new MockAdapter('ifood'));
      this.logger.warn('iFood adapter registered (MOCK — set IFOOD_* envs to use the real one)');
    }
  }

  private registerRappi(env: Env): void {
    if (env.RAPPI_CLIENT_ID && env.RAPPI_CLIENT_SECRET && env.RAPPI_WEBHOOK_SECRET) {
      this.adapters.set(
        'rappi',
        new RappiAdapter({
          clientId: env.RAPPI_CLIENT_ID,
          clientSecret: env.RAPPI_CLIENT_SECRET,
          apiBaseUrl: env.RAPPI_API_BASE_URL,
          webhookSecret: env.RAPPI_WEBHOOK_SECRET,
        }),
      );
      this.logger.log('Rappi adapter registered (real — STUB, will throw not_implemented)');
    } else {
      this.adapters.set('rappi', new MockAdapter('rappi'));
      this.logger.warn('Rappi adapter registered (MOCK)');
    }
  }

  private registerUberEats(env: Env): void {
    if (env.UBEREATS_CLIENT_ID && env.UBEREATS_CLIENT_SECRET && env.UBEREATS_WEBHOOK_SECRET) {
      this.adapters.set(
        'ubereats',
        new UberEatsAdapter({
          clientId: env.UBEREATS_CLIENT_ID,
          clientSecret: env.UBEREATS_CLIENT_SECRET,
          apiBaseUrl: env.UBEREATS_API_BASE_URL,
          webhookSecret: env.UBEREATS_WEBHOOK_SECRET,
          redirectUri: env.UBEREATS_REDIRECT_URI,
        }),
      );
      this.logger.log('Uber Eats adapter registered (real — STUB, will throw not_implemented)');
    } else {
      this.adapters.set('ubereats', new MockAdapter('ubereats'));
      this.logger.warn('Uber Eats adapter registered (MOCK)');
    }
  }

  private registerAiqfome(env: Env): void {
    if (env.AIQFOME_API_KEY && env.AIQFOME_WEBHOOK_SECRET) {
      this.adapters.set(
        'aiqfome',
        new AiqfomeAdapter({
          apiKey: env.AIQFOME_API_KEY,
          apiBaseUrl: env.AIQFOME_API_BASE_URL,
          webhookSecret: env.AIQFOME_WEBHOOK_SECRET,
        }),
      );
      this.logger.log('AiQfome adapter registered (real — STUB, will throw not_implemented)');
    } else {
      this.adapters.set('aiqfome', new MockAdapter('aiqfome'));
      this.logger.warn('AiQfome adapter registered (MOCK)');
    }
  }

  private registerDidifood(env: Env): void {
    if (env.DIDIFOOD_CLIENT_ID && env.DIDIFOOD_CLIENT_SECRET && env.DIDIFOOD_WEBHOOK_SECRET) {
      this.adapters.set(
        '99food',
        new DidifoodAdapter({
          clientId: env.DIDIFOOD_CLIENT_ID,
          clientSecret: env.DIDIFOOD_CLIENT_SECRET,
          apiBaseUrl: env.DIDIFOOD_API_BASE_URL,
          webhookSecret: env.DIDIFOOD_WEBHOOK_SECRET,
        }),
      );
      this.logger.log('99Food adapter registered (real — Authorization + Order + Store API)');
    } else {
      this.adapters.set('99food', new MockAdapter('99food'));
      this.logger.warn('99Food adapter registered (MOCK)');
    }
  }

  private registerKeeta(env: Env): void {
    if (env.KEETA_CLIENT_ID && env.KEETA_CLIENT_SECRET && env.KEETA_WEBHOOK_SECRET) {
      this.adapters.set(
        'keeta',
        new KeetaAdapter({
          clientId: env.KEETA_CLIENT_ID,
          clientSecret: env.KEETA_CLIENT_SECRET,
          apiBaseUrl: env.KEETA_API_BASE_URL,
          webhookSecret: env.KEETA_WEBHOOK_SECRET,
        }),
      );
      this.logger.log('Keeta adapter registered (real — STUB, will throw not_implemented)');
    } else {
      this.adapters.set('keeta', new MockAdapter('keeta'));
      this.logger.warn('Keeta adapter registered (MOCK)');
    }
  }

  get(code: PlatformCode): PlatformAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new NotFoundException(`adapter_not_registered:${code}`);
    }
    return adapter;
  }

  isMock(code: PlatformCode): boolean {
    const adapter = this.adapters.get(code);
    return adapter instanceof MockAdapter;
  }
}
