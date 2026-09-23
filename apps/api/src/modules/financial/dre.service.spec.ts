import { describe, expect, it } from 'vitest';

import { DreService } from './dre.service.js';

describe('DreService', () => {
  it('uses positive bank credits when the period has no orders', async () => {
    const prisma = {
      order: { findMany: async () => [] },
      bankTransaction: {
        aggregate: async () => ({ _sum: { amountCents: 125_000n } }),
      },
      expense: { findMany: async () => [] },
    } as never;

    const result = await new DreService(prisma).compute(
      { orgId: 'org-1', userId: 'user-1', role: 'owner' },
      {
        storeId: 'store-1',
        from: new Date('2026-08-23T00:00:00.000Z'),
        to: new Date('2026-09-22T23:59:59.999Z'),
      },
    );

    expect(result.revenueSource).toBe('bank_statement');
    expect(result.grossRevenueCents).toBe(125_000);
    expect(result.netRevenueCents).toBe(125_000);
    expect(result.ordersCount).toBe(0);
  });
});
