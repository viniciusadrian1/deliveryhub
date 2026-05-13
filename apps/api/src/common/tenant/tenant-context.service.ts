import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthContext } from '../auth/auth-context.js';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<AuthContext>();

  run<T>(context: AuthContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): AuthContext | undefined {
    return this.storage.getStore();
  }

  getOrThrow(): AuthContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new UnauthorizedException('tenant_context_missing');
    }
    return ctx;
  }
}
