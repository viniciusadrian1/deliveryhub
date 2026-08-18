import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import type { ListPayoutsQuery } from './dto/financial.dto.js';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly integrations: IntegrationsService,
    private readonly registry: AdapterRegistry,
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

  /**
   * Importa os repasses OFICIAIS direto da API da plataforma (Financial API
   * — hoje só iFood). Diferente do `recompute` (estimativa por SUM dos
   * pedidos), aqui o valor vem do que a plataforma declarou que vai pagar —
   * a conciliação bancária passa a bater contra o número real.
   *
   * Repasses de closingItems no MESMO período de cálculo são somados
   * (um período pode ter mais de um movimento REPASSE).
   */
  async importFromPlatform(
    auth: AuthContext,
    storeId: string,
    platformCode: PlatformCode,
    from: Date,
    to: Date,
  ) {
    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      storeId,
      platform.id,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(platformCode);
    if (!adapter.fetchSettlements) {
      throw new BadRequestException('settlement_import_unsupported');
    }

    const settlements = await adapter.fetchSettlements(
      conn.tokens,
      conn.externalMerchantId,
      from,
      to,
    );

    // Agrupa por período de cálculo (chave do upsert) somando os valores.
    const byPeriod = new Map<
      string,
      { periodStart: Date; periodEnd: Date; amountCents: number; expectedPayDate?: Date }
    >();
    for (const s of settlements) {
      const start = this.toDate(s.periodStart);
      const end = this.toDate(s.periodEnd);
      const key = `${start.toISOString()}|${end.toISOString()}`;
      const acc = byPeriod.get(key);
      if (acc) {
        acc.amountCents += s.amountCents;
        if (!acc.expectedPayDate && s.expectedPayDate) acc.expectedPayDate = s.expectedPayDate;
      } else {
        byPeriod.set(key, {
          periodStart: start,
          periodEnd: end,
          amountCents: s.amountCents,
          expectedPayDate: s.expectedPayDate,
        });
      }
    }

    const payouts = [];
    for (const p of byPeriod.values()) {
      const key = {
        platformId: platform.id,
        storeId,
        referencePeriodStart: p.periodStart,
        referencePeriodEnd: p.periodEnd,
      };
      const existing = await this.prisma.payout.findUnique({
        where: { platformId_storeId_referencePeriodStart_referencePeriodEnd: key },
      });

      const expected = BigInt(p.amountCents);
      const payout = existing
        ? await this.prisma.payout.update({
            where: { id: existing.id },
            data: {
              expectedAmountCents: expected,
              expectedPayDate: p.expectedPayDate ? this.toDate(p.expectedPayDate) : undefined,
              notes: `oficial ${platformCode}`,
              // Já conciliado? Re-classifica contra o valor oficial novo —
              // senão um payout 'reconciled' ficaria congelado mesmo com
              // o esperado mudando por baixo.
              ...(existing.receivedAmountCents !== null
                ? { status: this.classify(expected, existing.receivedAmountCents) }
                : {}),
            },
          })
        : await this.prisma.payout.create({
            data: {
              organizationId: auth.orgId,
              ...key,
              expectedAmountCents: expected,
              expectedPayDate: p.expectedPayDate ? this.toDate(p.expectedPayDate) : null,
              notes: `oficial ${platformCode}`,
            },
          });
      payouts.push(this.serializePayout(payout));
    }

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'payout',
      entityId: storeId,
      action: 'update',
      diff: {
        importedFromPlatform: platformCode,
        settlements: settlements.length,
        payouts: payouts.length,
      },
    });

    return { imported: payouts.length, payouts };
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
