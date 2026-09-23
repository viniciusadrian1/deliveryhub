import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// JSON.stringify estoura em BigInt (Prisma devolve BigInt em colunas *_cents).
// Serializa como Number globalmente — o front já consome esses campos como
// number. ponytail: seguro até 2^53-1 centavos (~R$ 90 trilhões); nenhum
// repasse chega perto. Se um dia chegar, serializar como string aqui.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Logger } from 'nestjs-pino';

// Load .env from the monorepo root. We're compiled to `apps/api/dist/main.js`,
// and the project root is 3 levels up. Try the closest paths first to avoid
// accidentally loading an unrelated `.env` from a parent directory on the
// developer's machine.
(() => {
  for (const path of [
    resolve(__dirname, '..', '.env'),       // apps/api/.env
    resolve(__dirname, '..', '..', '.env'), // apps/.env
    resolve(__dirname, '..', '..', '..', '.env'), // monorepo root
  ]) {
    if (existsSync(path)) {
      loadDotenv({ path });
      break;
    }
  }
})();

import { AppModule } from './app.module.js';
import { initSentry } from './common/observability/sentry.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  initSentry(env);

  if (env.MODE === 'worker') {
    const worker = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    worker.enableShutdownHooks();
    console.warn('[main] worker mode — poller de pedidos e scheduler de pausas ativos');
    // O contexto mantém os Cron jobs ativos. O timer também garante que o
    // processo continue vivo mesmo se não houver conexões ou jobs pendentes.
    setInterval(() => undefined, 60_000);
    await new Promise<void>(() => undefined);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Ifood-Signature'],
  });

  await app.listen(env.API_PORT, '0.0.0.0');
  console.warn(`[main] API listening on http://0.0.0.0:${env.API_PORT}`);
}

bootstrap().catch((err) => {
  console.error('[main] bootstrap failed', err);
  process.exit(1);
});
