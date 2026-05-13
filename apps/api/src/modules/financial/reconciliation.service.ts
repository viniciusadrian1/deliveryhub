import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { PayoutsService } from './payouts.service.js';

export interface ReconciliationReport {
  matched: number;
  partial: number;
  mismatched: number;
  unmatched: number;
  divergences: Array<{
    payoutId: string;
    expectedCents: number;
    bestMatchAmountCents: number | null;
    bestMatchDescription: string | null;
    diffCents: number | null;
  }>;
}

/**
 * Algoritmo de conciliação de repasses (MVP):
 *
 * 1. Para cada Payout `pending|partial|mismatch` da loja:
 *    a. Procura BankTransaction sem payout associado dentro da janela
 *       de [expectedPayDate - N, expectedPayDate + N] dias
 *    b. Dentre as candidatas, escolhe a mais próxima do valor esperado
 *       (preferindo casamento dentro da tolerância)
 *    c. Se houver match, atualiza payout.{bankTransactionId, received_*, status}
 *    d. Senão, registra na lista de divergências
 *
 * Limites do MVP: não trata pedaços de payout (split), não lida com
 * descrição/identificador da transação além de proximidade temporal.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutsService,
    private readonly audit: AuditLogService,
  ) {}

  async run(
    auth: AuthContext,
    storeId: string,
    toleranceCents = 100,
    dayWindow = 5,
  ): Promise<ReconciliationReport> {
    const pendingPayouts = await this.prisma.payout.findMany({
      where: {
        organizationId: auth.orgId,
        storeId,
        OR: [
          { status: 'pending' },
          { status: 'partial' },
          { status: 'mismatch' },
        ],
      },
      orderBy: { referencePeriodStart: 'desc' },
    });

    // BankTransactions ainda não vinculadas a nenhum payout daquela loja.
    const unlinkedBankTxns = await this.prisma.bankTransaction.findMany({
      where: {
        organizationId: auth.orgId,
        storeId,
        payouts: { none: {} },
      },
      orderBy: { date: 'desc' },
    });

    const tolerance = BigInt(toleranceCents);
    const dayWindowMs = dayWindow * 24 * 60 * 60 * 1000;

    let matched = 0;
    let partial = 0;
    let mismatched = 0;
    let unmatched = 0;
    const divergences: ReconciliationReport['divergences'] = [];

    const reservedTxnIds = new Set<string>();

    for (const payout of pendingPayouts) {
      const anchorDate =
        payout.expectedPayDate ?? payout.referencePeriodEnd;
      const anchorMs = anchorDate.getTime();

      // Filtra candidates dentro da janela temporal.
      const candidates = unlinkedBankTxns.filter(
        (tx) =>
          !reservedTxnIds.has(tx.id) &&
          Math.abs(tx.date.getTime() - anchorMs) <= dayWindowMs,
      );

      // Escolhe a com menor |diff| do esperado.
      let best: { tx: (typeof candidates)[number]; diff: bigint } | null = null;
      for (const tx of candidates) {
        const diff = tx.amountCents - payout.expectedAmountCents;
        const abs = diff < 0n ? -diff : diff;
        if (!best || abs < (best.diff < 0n ? -best.diff : best.diff)) {
          best = { tx, diff };
        }
      }

      if (!best) {
        unmatched++;
        divergences.push({
          payoutId: payout.id,
          expectedCents: Number(payout.expectedAmountCents),
          bestMatchAmountCents: null,
          bestMatchDescription: null,
          diffCents: null,
        });
        continue;
      }

      const status = this.payouts.classify(
        payout.expectedAmountCents,
        best.tx.amountCents,
        tolerance,
      );

      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          bankTransactionId: best.tx.id,
          receivedAmountCents: best.tx.amountCents,
          receivedAt: best.tx.date,
          status,
        },
      });

      reservedTxnIds.add(best.tx.id);

      if (status === 'reconciled') matched++;
      else if (status === 'partial') partial++;
      else mismatched++;

      if (status !== 'reconciled') {
        divergences.push({
          payoutId: payout.id,
          expectedCents: Number(payout.expectedAmountCents),
          bestMatchAmountCents: Number(best.tx.amountCents),
          bestMatchDescription: best.tx.description,
          diffCents: Number(best.diff),
        });
      }
    }

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'payout',
      action: 'update',
      diff: {
        reconciliation: { matched, partial, mismatched, unmatched, storeId },
      },
    });

    return { matched, partial, mismatched, unmatched, divergences };
  }
}
