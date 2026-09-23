import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@deliveryhub/db';
import { StockAlertsService } from './stock-alerts.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

function service(balance: number, minimum: number | null, consumed = 0) {
  const prisma = {
    ingredient: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: 'ingredient',
            name: 'Farinha',
            unit: 'gram',
            storeId: 'store',
            minLevel: minimum === null ? null : new Prisma.Decimal(minimum),
            targetDays: 7,
          },
        ]),
    },
    stockMovement: {
      groupBy: vi
        .fn()
        .mockResolvedValueOnce([
          { ingredientId: 'ingredient', _sum: { quantity: new Prisma.Decimal(balance) } },
        ])
        .mockResolvedValueOnce([
          { ingredientId: 'ingredient', _sum: { quantity: new Prisma.Decimal(-consumed) } },
        ]),
    },
  };
  return new StockAlertsService(prisma as unknown as PrismaService, {} as NotificationsService);
}
describe('stock replenishment', () => {
  it('recommends reaching the minimum even without sales history', async () => {
    const [s] = await service(3, 10).summarize('org', 'store');
    expect(s?.needsRestock).toBe(true);
    expect(s?.belowMinimum).toBe(true);
    expect(s?.suggestedPurchase.toNumber()).toBe(7);
  });
  it.each([10, 11])('does not alert at or above minimum: %s', async (balance) => {
    const [s] = await service(balance, 10).summarize('org', 'store');
    expect(s?.needsRestock).toBe(false);
  });
  it('uses consumption coverage without rounding away a deficit', async () => {
    const [s] = await service(69, 10, 300).summarize('org', 'store');
    expect(s?.needsRestock).toBe(true);
    expect(s?.suggestedPurchase.toNumber()).toBe(1);
  });
});
