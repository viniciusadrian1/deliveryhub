import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { PlatformAdapter } from '@deliveryhub/ifood';
import { IFoodAdapter, MockAdapter } from '@deliveryhub/ifood';
import type { PlatformCode } from '@deliveryhub/shared';

import { loadEnv } from '../../config/env.js';

@Injectable()
export class AdapterRegistry {
  private readonly logger = new Logger(AdapterRegistry.name);
  private readonly adapters = new Map<PlatformCode, PlatformAdapter>();

  constructor() {
    const env = loadEnv();

    if (env.IFOOD_CLIENT_ID && env.IFOOD_CLIENT_SECRET && env.IFOOD_WEBHOOK_SECRET) {
      this.adapters.set(
        'ifood',
        new IFoodAdapter({
          clientId: env.IFOOD_CLIENT_ID,
          clientSecret: env.IFOOD_CLIENT_SECRET,
          apiBaseUrl: env.IFOOD_API_BASE_URL,
          webhookSecret: env.IFOOD_WEBHOOK_SECRET,
        }),
      );
      this.logger.log('iFood adapter registered (real)');
    } else {
      this.adapters.set('ifood', new MockAdapter('ifood'));
      this.logger.warn('iFood adapter registered (MOCK — set IFOOD_* envs to use the real one)');
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
