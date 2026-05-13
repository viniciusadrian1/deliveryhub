import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { initSentry } from './common/observability/sentry.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  initSentry(env);

  if (env.MODE === 'worker') {
    // Sprint 5+: inicializa BullMQ consumers em vez do servidor HTTP.
    console.warn('[main] worker mode — consumers ainda não implementados (Sprint 5+)');
    return;
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  console.warn(`[main] API listening on http://0.0.0.0:${env.API_PORT}`);
}

bootstrap().catch((err) => {
  console.error('[main] bootstrap failed', err);
  process.exit(1);
});
