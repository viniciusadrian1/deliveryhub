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

/** Garante o usuário owner + org + loja. Devolve {orgId, storeId}. Idempotente. */
async function seedTestUser(): Promise<{ orgId: string; storeId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: TEST_USER.email },
    include: { memberships: { take: 1 } },
  });

  if (existing) {
    const orgId = existing.memberships[0]!.organizationId;
    const store = await prisma.store.findFirst({ where: { organizationId: orgId } });
    console.warn(`Test user "${TEST_USER.email}" already exists — reusing`);
    return { orgId, storeId: store!.id };
  }

  return prisma.$transaction(async (tx) => {
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
      data: { organizationId: organization.id, userId: user.id, role: 'owner' },
    });
    const store = await tx.store.create({
      data: {
        organizationId: organization.id,
        name: TEST_USER.storeName,
        timezone: 'America/Sao_Paulo',
      },
    });
    console.warn(`Created test user: ${TEST_USER.email}`);
    return { orgId: organization.id, storeId: store.id };
  });
}

/**
 * Cardápio de demonstração — dá pra ver o app funcionando ponta a ponta
 * (cardápio, CMV/margem, config por plataforma) sem digitação manual.
 * Idempotente: se a loja já tem categoria, não faz nada.
 */
async function seedDemoMenu(orgId: string, storeId: string): Promise<void> {
  const hasMenu = await prisma.category.findFirst({ where: { storeId } });
  if (hasMenu) {
    console.warn('Demo menu already present — skipping');
    return;
  }

  const platforms = await prisma.platform.findMany({
    where: { code: { in: ['ifood', '99food'] } },
    select: { id: true, code: true },
  });

  const lanches = await prisma.category.create({
    data: { organizationId: orgId, storeId, name: 'Lanches', sortOrder: 0 },
  });
  const bebidas = await prisma.category.create({
    data: { organizationId: orgId, storeId, name: 'Bebidas', sortOrder: 1 },
  });

  // [nome, categoria, CMV (custo), preço de venda, salesKind]
  const items: Array<[string, string, number, number, string]> = [
    ['X-Burger', lanches.id, 650, 1890, 'main'],
    ['X-Salada', lanches.id, 780, 2190, 'main'],
    ['X-Bacon', lanches.id, 900, 2490, 'main'],
    ['Batata Frita', lanches.id, 320, 1290, 'side'],
    ['Coca-Cola Lata', bebidas.id, 250, 690, 'drink'],
    ['Suco de Laranja', bebidas.id, 300, 890, 'drink'],
  ];

  for (const [name, categoryId, costCents, priceCents, salesKind] of items) {
    const item = await prisma.menuItem.create({
      data: {
        organizationId: orgId,
        storeId,
        categoryId,
        name,
        costCents,
        salesKind: salesKind as never,
      },
    });
    // Mesmo preço nas duas plataformas ativas (sem externalId: publicação
    // real preenche isso na sincronização/publish).
    for (const p of platforms) {
      await prisma.menuItemPlatformConfig.create({
        data: {
          organizationId: orgId,
          menuItemId: item.id,
          platformId: p.id,
          sellingPriceCents: priceCents,
        },
      });
    }

    // Grupo de adicionais no X-Burger, pra demonstrar complementos.
    if (name === 'X-Burger') {
      const group = await prisma.modifierGroup.create({
        data: {
          organizationId: orgId,
          menuItemId: item.id,
          kind: 'ingredients',
          name: 'Adicionais',
          minSelect: 0,
          maxSelect: 3,
        },
      });
      for (const [mName, delta] of [
        ['Bacon extra', 400],
        ['Ovo', 250],
        ['Queijo extra', 300],
      ] as const) {
        await prisma.modifier.create({
          data: {
            organizationId: orgId,
            modifierGroupId: group.id,
            name: mName,
            costDeltaCents: delta,
          },
        });
      }
    }
  }

  console.warn(`Seeded demo menu: 2 categories, ${items.length} items`);
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

  const { orgId, storeId } = await seedTestUser();
  await seedDemoMenu(orgId, storeId);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
