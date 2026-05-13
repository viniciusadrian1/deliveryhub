import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { ListPayoutsQuery } from './dto/financial.dto.js';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(auth: AuthContext, query: ListPayoutsQuery) {
    return this.prisma.payout.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        status: query.status ?? undefined,
        referencePeriodStart: query.from ? { gte: query.from } : undefined,
        referencePeriodEnd: query.to ? { lte: query.to } : undefined,
      },
      include: {
        platform: { select: { code: true, name: true, colorHex: true } },
        bankTransaction: true,
      },
      orderBy: { referencePeriodStart: 'desc' },
    });
  }

  /**
   * Calcula o repasse esperado para (store × platform × período) a partir
   * dos pedidos não-cancelados. `received` fica em null até a conciliação.
   * Upsert por unique(platformId, storeId, period).
   */
  async recompute(
    auth: AuthContext,
    storeId: string,
    platformCode: PlatformCode,
    from: Date,
    to: Date,
    expectedPayDate?: Date,
  ) {
    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const agg = await this.prisma.order.aggregate({
      where: {
        organizationId: auth.orgId,
        storeId,
        platformId: platform.id,
        status: { not: 'cancelled' },
        placedAt: { gte: from, lte: to },
      },
      _sum: { netCents: true },
      _count: { _all: true },
    });

    const expected = BigInt(agg._sum.netCents ?? 0);
    if (agg._count._all === 0) {
      throw new BadRequestException('no_orders_in_period');
    }

    const payout = await this.prisma.payout.upsert({
      where: {
        platformId_storeId_referencePeriodStart_referencePeriodEnd: {
          platformId: platform.id,
          storeId,
          referencePeriodStart: this.toDate(from),
          referencePeriodEnd: this.toDate(to),
        },
      },
      create: {
        organizationId: auth.orgId,
        storeId,
        platformId: platform.id,
        referencePeriodStart: this.toDate(from),
        referencePeriodEnd: this.toDate(to),
        expectedAmountCents: expected,
        expectedPayDate: expectedPayDate ? this.toDate(expectedPayDate) : null,
      },
      update: {
        expectedAmountCents: expected,
        expectedPayDate: expectedPayDate ? this.toDate(expectedPayDate) : undefined,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'payout',
      entityId: payout.id,
      action: 'update',
      diff: { recomputed: true, expectedCents: expected.toString(), orderCount: agg._count._all },
    });

    return this.serializePayout(payout);
  }

  async manualReconcile(auth: AuthContext, payoutId: string, bankTransactionId: string) {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, organizationId: auth.orgId },
    });
    if (!payout) throw new NotFoundException('payout_not_found');

    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, organizationId: auth.orgId },
    });
    if (!tx) throw new NotFoundException('bank_transaction_not_found');

    const status = this.classify(payout.expectedAmountCents, tx.amountCents);

    const updated = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        bankTransactionId: tx.id,
        receivedAmountCents: tx.amountCents,
        receivedAt: new Date(),
        status,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'payout',
      entityId: payout.id,
      action: 'update',
      diff: { manualReconcile: true, status },
    });

    return this.serializePayout(updated);
  }

  // Helpers ------------------------------------------------

  classify(expected: bigint, received: bigint, toleranceCents = 100n): 'partial' | 'reconciled' | 'mismatch' {
    const diff = received - expected;
    if (diff > toleranceCents) return 'mismatch';
    if (diff < -toleranceCents) return 'partial';
    return 'reconciled';
  }

  private toDate(d: Date): Date {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private serializePayout(p: {
    id: string;
    expectedAmountCents: bigint;
    receivedAmountCents: bigint | null;
    [k: string]: unknown;
  }) {
    return {
      ...p,
      expectedAmountCents: Number(p.expectedAmountCents),
      receivedAmountCents: p.receivedAmountCents !== null ? Number(p.receivedAmountCents) : null,
    };
  }
}
