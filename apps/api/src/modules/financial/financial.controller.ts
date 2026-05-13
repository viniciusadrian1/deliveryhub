import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { BankImportService } from './bank-import.service.js';
import {
  type ByPlatformQuery,
  byPlatformQuerySchema,
  type DailySeriesQuery,
  dailySeriesQuerySchema,
  type DashboardQuery,
  dashboardQuerySchema,
  type ImportBankCsvInput,
  importBankCsvSchema,
  type ListBankTransactionsQuery,
  listBankTransactionsQuerySchema,
  type ListPayoutsQuery,
  listPayoutsQuerySchema,
  type ManualReconcileInput,
  manualReconcileSchema,
  type RecomputePayoutsInput,
  recomputePayoutsSchema,
  type RunReconciliationInput,
  runReconciliationSchema,
  type TopItemsQuery,
  topItemsQuerySchema,
} from './dto/financial.dto.js';
import { FinancialDashboardService } from './financial-dashboard.service.js';
import { PayoutsService } from './payouts.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Controller()
export class FinancialController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: FinancialDashboardService,
    private readonly bank: BankImportService,
    private readonly payouts: PayoutsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  // ===== Dashboard =====

  @Get('financial/summary')
  summary(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) q: DashboardQuery,
  ) {
    return this.dashboard.summary(auth, q.storeId, q.from, q.to);
  }

  @Get('financial/daily')
  daily(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(dailySeriesQuerySchema)) q: DailySeriesQuery,
  ) {
    return this.dashboard.dailySeries(auth, q.storeId, q.from, q.to);
  }

  @Get('financial/top-items')
  topItems(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(topItemsQuerySchema)) q: TopItemsQuery,
  ) {
    return this.dashboard.topItemsByMargin(auth, q.storeId, q.from, q.to, q.limit);
  }

  @Get('financial/by-platform')
  byPlatform(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(byPlatformQuerySchema)) q: ByPlatformQuery,
  ) {
    return this.dashboard.revenueByPlatform(auth, q.storeId, q.from, q.to);
  }

  // ===== Bank =====

  @Post('bank/import')
  @Roles('owner', 'manager', 'financial')
  @HttpCode(200)
  importBank(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(importBankCsvSchema)) body: ImportBankCsvInput,
  ) {
    return this.bank.importCsv(auth, body.storeId, body.csv);
  }

  @Get('bank/transactions')
  listBank(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listBankTransactionsQuerySchema)) q: ListBankTransactionsQuery,
  ) {
    // Quando matched=true filtra só linhas com payouts vinculados.
    return this.prisma.bankTransaction.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: q.storeId,
        date: q.from && q.to ? { gte: q.from, lte: q.to } : undefined,
        payouts:
          q.matched === true
            ? { some: {} }
            : q.matched === false
              ? { none: {} }
              : undefined,
      },
      orderBy: { date: 'desc' },
      include: { payouts: { select: { id: true, status: true } } },
      take: 200,
    });
  }

  // ===== Payouts =====

  @Get('payouts')
  listPayouts(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listPayoutsQuerySchema)) q: ListPayoutsQuery,
  ) {
    return this.payouts.list(auth, q);
  }

  @Post('payouts/recompute')
  @Roles('owner', 'manager', 'financial')
  @HttpCode(200)
  recompute(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(recomputePayoutsSchema)) body: RecomputePayoutsInput,
  ) {
    return this.payouts.recompute(
      auth,
      body.storeId,
      body.platformCode,
      body.from,
      body.to,
      body.expectedPayDate,
    );
  }

  @Post('payouts/:id/reconcile')
  @Roles('owner', 'manager', 'financial')
  @HttpCode(200)
  manualReconcile(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(manualReconcileSchema)) body: ManualReconcileInput,
  ) {
    return this.payouts.manualReconcile(auth, id, body.bankTransactionId);
  }

  // ===== Reconciliation =====

  @Post('reconciliation/run')
  @Roles('owner', 'manager', 'financial')
  @HttpCode(200)
  runReconciliation(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(runReconciliationSchema)) body: RunReconciliationInput,
  ) {
    return this.reconciliation.run(auth, body.storeId, body.toleranceCents, body.dayWindow);
  }
}
