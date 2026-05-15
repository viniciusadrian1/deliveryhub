import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { PrismaClient } from '../generated/client/index.js';

// Carrega .env da raiz do monorepo antes de instanciar o PrismaClient.
// (tsx não auto-carrega .env como o Next.js faz.)
(() => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const path of [
    resolve(here, '..', '.env'),           // packages/db/.env
    resolve(here, '..', '..', '.env'),     // packages/.env
    resolve(here, '..', '..', '..', '.env'), // monorepo root
  ]) {
    if (existsSync(path)) {
      loadDotenv({ path });
      break;
    }
  }
})();

const prisma = new PrismaClient();

/**
 * Seed do banco.
 *
 * 1. Plataformas — sempre executa (idempotente).
 * 2. Usuário de teste — APENAS em ambientes não-produção, e desabilitável
 *    explicitamente via `SKIP_TEST_USER_SEED=1`.
 *
 * O hash do password é Argon2id pré-computado pra não exigir runtime de
 * criptografia neste pacote — a string abaixo verifica contra a senha
 * `DeliveryHub2026!` usando os mesmos parâmetros do @node-rs/argon2 que
 * o `auth.service` usa em produção.
 */

const TEST_USER = {
  email: 'teste@deliveryhub.local',
  name: 'Usuário de Teste',
  organizationName: 'Restaurante de Teste',
  storeName: 'Loja Matriz',
  // Hash de "DeliveryHub2026!" — Argon2id, parâmetros padrão do @node-rs/argon2 v2.
  passwordHash:
    '$argon2id$v=19$m=19456,t=2,p=1$P8vs6wxIQ4vrxGrL18haDA$Rizkn6qjapuGzYbhyzeIuZcNcY4n2nZ0M1l1Q1zCTeM',
};

async function seedPlatforms(): Promise<number> {
  const platforms = [
    { code: 'ifood', name: 'iFood', colorHex: '#EA1D2C', active: true },
    { code: 'rappi', name: 'Rappi', colorHex: '#FF441F', active: false },
    { code: '99food', name: '99Food', colorHex: '#FE3324', active: true },
    { code: 'keeta', name: 'Keeta', colorHex: '#FFCC00', active: false },
    { code: 'ubereats', name: 'Uber Eats', colorHex: '#06C167', active: false },
    { code: 'aiqfome', name: 'AiQfome', colorHex: '#E2231A', active: false },
  ];

  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }
  return platforms.length;
}

async function seedTestUser(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: TEST_USER.email },
    include: { memberships: { include: { organization: true }, take: 1 } },
  });

  if (existing) {
    console.warn(`Test user "${TEST_USER.email}" already exists — skipping creation`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: TEST_USER.organizationName },
    });

    const user = await tx.user.create({
      data: {
        email: TEST_USER.email,
        name: TEST_USER.name,
        passwordHash: TEST_USER.passwordHash,
      },
    });

    await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      },
    });

    await tx.store.create({
      data: {
        organizationId: organization.id,
        name: TEST_USER.storeName,
        timezone: 'America/Sao_Paulo',
      },
    });
  });

  console.warn(`Created test user: ${TEST_USER.email}`);
}

async function main(): Promise<void> {
  const platformCount = await seedPlatforms();
  console.warn(`Seeded ${platformCount} platforms`);

  const env = process.env.NODE_ENV ?? 'development';
  const skip = process.env.SKIP_TEST_USER_SEED === '1';

  if (env === 'production') {
    console.warn(`NODE_ENV=${env} — skipping test user seed (production)`);
    return;
  }
  if (skip) {
    console.warn('SKIP_TEST_USER_SEED=1 — skipping test user seed');
    return;
  }

  await seedTestUser();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
