import * as Sentry from '@sentry/node';

import type { Env } from '../../config/env.js';

let initialized = false;

export function initSentry(env: Env): void {
  if (initialized || !env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
