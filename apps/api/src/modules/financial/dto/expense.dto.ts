import { z } from 'zod';

const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'payroll',
  'ingredients_misc',
  'marketing',
  'taxes',
  'equipment',
  'software',
  'fuel',
  'packaging',
  'cleaning',
  'other',
] as const;

const EXPENSE_RECURRENCES = ['one_time', 'monthly', 'weekly', 'daily'] as const;

export const createExpenseSchema = z
  .object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(200).trim(),
    category: z.enum(EXPENSE_CATEGORIES),
    amountCents: z.number().int().min(0),
    recurrence: z.enum(EXPENSE_RECURRENCES).default('one_time'),
    /**
     * Dia do mês (1-28) para monthly OU dia da semana (0-6) para weekly.
     * Ignorado para one_time e daily.
     */
    dueDay: z.number().int().min(0).max(28).nullable().optional(),
    occurredAt: z.coerce.date().optional(),
    paymentMethod: z.string().max(40).trim().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.recurrence !== 'monthly' ||
      d.dueDay === undefined ||
      d.dueDay === null ||
      (d.dueDay >= 1 && d.dueDay <= 28),
    { message: 'dueDay must be 1..28 for monthly', path: ['dueDay'] },
  );

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amountCents: z.number().int().min(0).optional(),
  recurrence: z.enum(EXPENSE_RECURRENCES).optional(),
  dueDay: z.number().int().min(0).max(28).nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  /** Marcar como encerrado (rescindiu, parou de pagar). */
  endedAt: z.coerce.date().nullable().optional(),
  paymentMethod: z.string().max(40).trim().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const listExpensesQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  recurrence: z.enum(EXPENSE_RECURRENCES).optional(),
  /** "Despesas ativas no período" — inclui recorrentes que se aplicam. */
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

export const dreQuerySchema = z.object({
  storeId: z.string().uuid(),
  /** Início do período (inclusivo). Default = primeiro dia do mês corrente. */
  from: z.coerce.date().optional(),
  /** Fim do período (inclusivo). Default = agora. */
  to: z.coerce.date().optional(),
});

export type DreQuery = z.infer<typeof dreQuerySchema>;
