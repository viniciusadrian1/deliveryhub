import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

/** Interpreta datas vindas dos filtros como dias civis de São Paulo. */
const localDay = (endOfDay = false) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00`;
      }
      return value;
    },
    z.coerce.date(),
  );

const periodSchema = z.object({
  storeId: z.string().uuid(),
  from: localDay(),
  to: localDay(true),
});

export const dashboardQuerySchema = periodSchema;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dailySeriesQuerySchema = periodSchema;
export type DailySeriesQuery = z.infer<typeof dailySeriesQuerySchema>;

export const topItemsQuerySchema = periodSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TopItemsQuery = z.infer<typeof topItemsQuerySchema>;

export const byPlatformQuerySchema = periodSchema;
export type ByPlatformQuery = z.infer<typeof byPlatformQuerySchema>;

// Payouts ===================================================

export const listPayoutsQuerySchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(['pending', 'partial', 'reconciled', 'mismatch']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>;

export const recomputePayoutsSchema = z.object({
  storeId: z.string().uuid(),
  platformCode: z.enum(PLATFORMS),
  from: z.coerce.date(),
  to: z.coerce.date(),
  expectedPayDate: z.coerce.date().optional(),
});
export type RecomputePayoutsInput = z.infer<typeof recomputePayoutsSchema>;

export const manualReconcileSchema = z.object({
  bankTransactionId: z.string().uuid(),
});
export type ManualReconcileInput = z.infer<typeof manualReconcileSchema>;

/** Import de repasses OFICIAIS direto da API da plataforma (iFood Financial). */
export const importPayoutsSchema = z.object({
  storeId: z.string().uuid(),
  platformCode: z.enum(PLATFORMS),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type ImportPayoutsInput = z.infer<typeof importPayoutsSchema>;

// Bank import ================================================

export const importBankCsvSchema = z.object({
  storeId: z.string().uuid(),
  csv: z.string().min(10).max(2_000_000),
});
export type ImportBankCsvInput = z.infer<typeof importBankCsvSchema>;

export const listBankTransactionsQuerySchema = z.object({
  storeId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  matched: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type ListBankTransactionsQuery = z.infer<typeof listBankTransactionsQuerySchema>;

// Reconciliation =============================================

export const runReconciliationSchema = z.object({
  storeId: z.string().uuid(),
  toleranceCents: z.number().int().min(0).max(10_000).default(100),
  dayWindow: z.number().int().min(1).max(15).default(5),
});
export type RunReconciliationInput = z.infer<typeof runReconciliationSchema>;
