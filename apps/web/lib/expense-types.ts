/**
 * Despesas + DRE — espelha os DTOs do backend (financial/expenses).
 */

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'payroll'
  | 'ingredients_misc'
  | 'marketing'
  | 'taxes'
  | 'equipment'
  | 'software'
  | 'fuel'
  | 'packaging'
  | 'cleaning'
  | 'other';

export type ExpenseRecurrence = 'one_time' | 'monthly' | 'weekly' | 'daily';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Aluguel',
  utilities: 'Água/Luz/Gás/Internet',
  payroll: 'Salários',
  ingredients_misc: 'Insumos avulsos',
  marketing: 'Marketing',
  taxes: 'Impostos',
  equipment: 'Equipamento',
  software: 'Software/SaaS',
  fuel: 'Combustível',
  packaging: 'Embalagem',
  cleaning: 'Limpeza',
  other: 'Outras',
};

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  one_time: 'Única',
  monthly: 'Mensal',
  weekly: 'Semanal',
  daily: 'Diária',
};

export interface Expense {
  id: string;
  organizationId: string;
  storeId: string;
  name: string;
  category: ExpenseCategory;
  amountCents: number;
  recurrence: ExpenseRecurrence;
  dueDay: number | null;
  occurredAt: string;
  endedAt: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
}

export interface DreLine {
  label: string;
  cents: number;
  category?: string;
}

export interface DreReport {
  period: { from: string; to: string };
  storeId: string;
  grossRevenueCents: number;
  platformFeesCents: number;
  netRevenueCents: number;
  cogsCents: number;
  grossMarginCents: number;
  grossMarginPct: number;
  expenseLines: DreLine[];
  totalExpensesCents: number;
  operatingResultCents: number;
  netMarginPct: number;
  ordersCount: number;
  averageTicketCents: number;
}
