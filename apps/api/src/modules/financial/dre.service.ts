import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { DreQuery } from './dto/expense.dto.js';

/**
 * Demonstrativo de Resultado do Exercício — simplificado pra restaurante.
 *
 * Estrutura clássica (BR):
 *
 *   Faturamento Bruto
 *   (−) Taxas das plataformas (iFood, Rappi, etc.)
 *   = Faturamento Líquido
 *   (−) CMV (Custo das Mercadorias Vendidas)
 *   = Margem Bruta
 *   (−) Despesas Operacionais (rateadas por categoria)
 *   = Resultado Operacional
 *
 *   % Margem bruta = Margem Bruta / Faturamento Líquido
 *   % Margem líquida = Resultado / Faturamento Líquido
 *
 * Premissas importantes:
 *  - Pedidos cancelados NÃO entram em faturamento.
 *  - CMV usa `menuItem.costCents` no momento do cálculo (preserva integridade
 *    histórica: se você reajustar o custo hoje, o DRE de um mês passado
 *    pode mudar — limitação aceita pra MVP).
 *  - Despesas recorrentes são "expandidas" no período: aluguel mensal de
 *    R$3.500 conta como 3.500 em cada mês que ele esteve ativo (entre
 *    occurredAt e endedAt).
 *  - Despesa one_time entra apenas se `occurredAt` cai no período.
 */
export interface DreLine {
  label: string;
  cents: number;
  /** Categoria/agrupamento para detalhamento. */
  category?: string;
}

export interface DreResult {
  period: { from: string; to: string };
  storeId: string;

  /** Faturamento bruto (total das ordens não-canceladas) */
  grossRevenueCents: number;
  /** Soma das taxas cobradas pelas plataformas */
  platformFeesCents: number;
  /** = grossRevenue − fees */
  netRevenueCents: number;

  /** Custo das mercadorias vendidas (sum item.costCents × qty) */
  cogsCents: number;
  /** = netRevenue − cogs */
  grossMarginCents: number;
  grossMarginPct: number;

  /** Despesas operacionais detalhadas por categoria */
  expenseLines: DreLine[];
  /** Soma das despesas operacionais no período */
  totalExpensesCents: number;

  /** = grossMargin − totalExpenses */
  operatingResultCents: number;
  /** Margem líquida sobre faturamento líquido */
  netMarginPct: number;

  /** Quantidade de pedidos no período (não cancelados) */
  ordersCount: number;
  /** Ticket médio em centavos */
  averageTicketCents: number;
}

@Injectable()
export class DreService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(auth: AuthContext, query: DreQuery): Promise<DreResult> {
    const { from, to } = resolvePeriod(query);

    // ----- Receitas + taxas + CMV (em uma query agregada) -----
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        status: { not: 'cancelled' },
        placedAt: { gte: from, lte: to },
      },
      select: {
        totalCents: true,
        platformFeeCents: true,
        processingFeeCents: true,
        flatFeeCents: true,
        items: {
          select: {
            qty: true,
            menuItem: { select: { costCents: true } },
          },
        },
      },
    });

    let grossRevenueCents = 0;
    let platformFeesCents = 0;
    let cogsCents = 0;
    for (const o of orders) {
      grossRevenueCents += o.totalCents;
      platformFeesCents +=
        o.platformFeeCents + o.processingFeeCents + o.flatFeeCents;
      for (const item of o.items) {
        // qty é Int no schema; menuItem opcional (pedidos que não bateram com cardápio têm null)
        const unitCost = item.menuItem?.costCents ?? 0;
        cogsCents += unitCost * item.qty;
      }
    }
    const netRevenueCents = grossRevenueCents - platformFeesCents;
    const grossMarginCents = netRevenueCents - cogsCents;
    const grossMarginPct =
      netRevenueCents > 0 ? grossMarginCents / netRevenueCents : 0;

    // ----- Despesas no período (incluindo recorrências expandidas) -----
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        // Filtra pelo que pode se aplicar no período:
        // - one_time: occurredAt dentro do período
        // - recorrentes: occurredAt <= to (já começou) E (endedAt nulo OU endedAt >= from)
        OR: [
          {
            recurrence: 'one_time',
            occurredAt: { gte: from, lte: to },
          },
          {
            recurrence: { in: ['monthly', 'weekly', 'daily'] },
            occurredAt: { lte: to },
            AND: [{ OR: [{ endedAt: null }, { endedAt: { gte: from } }] }],
          },
        ],
      },
    });

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      const occurrences = countOccurrencesInPeriod(e, from, to);
      const total = e.amountCents * occurrences;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + total);
    }
    const expenseLines: DreLine[] = Array.from(byCategory.entries())
      .map(([category, cents]) => ({
        label: humanizeCategory(category),
        category,
        cents,
      }))
      .sort((a, b) => b.cents - a.cents);

    const totalExpensesCents = expenseLines.reduce((s, l) => s + l.cents, 0);
    const operatingResultCents = grossMarginCents - totalExpensesCents;
    const netMarginPct =
      netRevenueCents > 0 ? operatingResultCents / netRevenueCents : 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      storeId: query.storeId,
      grossRevenueCents,
      platformFeesCents,
      netRevenueCents,
      cogsCents,
      grossMarginCents,
      grossMarginPct,
      expenseLines,
      totalExpensesCents,
      operatingResultCents,
      netMarginPct,
      ordersCount: orders.length,
      averageTicketCents:
        orders.length > 0 ? Math.round(grossRevenueCents / orders.length) : 0,
    };
  }
}

// =====================================================================
// Helpers
// =====================================================================

function resolvePeriod(q: { from?: Date; to?: Date }): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const from = q.from ?? defaultFrom;
  const to = q.to ?? now;
  return { from, to };
}

interface ExpenseRow {
  recurrence: 'one_time' | 'monthly' | 'weekly' | 'daily';
  occurredAt: Date;
  endedAt: Date | null;
}

/**
 * Conta quantas vezes uma despesa "ocorre" dentro do período. Para
 * one_time é sempre 1 (já filtrado antes). Para recorrentes, conta o
 * número de períodos completos dentro de [from, to] respeitando a
 * janela ativa da despesa (occurredAt ... endedAt).
 *
 * Aproximações intencionais (MVP):
 *  - monthly: conta meses calendários sobrepostos
 *  - weekly: conta semanas (períodos de 7 dias)
 *  - daily: conta dias
 */
function countOccurrencesInPeriod(
  expense: ExpenseRow,
  from: Date,
  to: Date,
): number {
  if (expense.recurrence === 'one_time') return 1;

  const activeFrom = new Date(
    Math.max(expense.occurredAt.getTime(), from.getTime()),
  );
  const activeTo = new Date(
    Math.min(
      expense.endedAt ? expense.endedAt.getTime() : to.getTime(),
      to.getTime(),
    ),
  );
  if (activeTo < activeFrom) return 0;

  const ms = activeTo.getTime() - activeFrom.getTime();

  switch (expense.recurrence) {
    case 'monthly': {
      // (anos × 12 + meses) + 1 (período de pelo menos 1 mês conta como 1)
      const yearsDiff = activeTo.getFullYear() - activeFrom.getFullYear();
      const monthsDiff = activeTo.getMonth() - activeFrom.getMonth();
      return Math.max(1, yearsDiff * 12 + monthsDiff + 1);
    }
    case 'weekly':
      return Math.max(1, Math.ceil(ms / (7 * 24 * 3600 * 1000)));
    case 'daily':
      return Math.max(1, Math.ceil(ms / (24 * 3600 * 1000)));
    default:
      return 1;
  }
}

function humanizeCategory(c: string): string {
  const map: Record<string, string> = {
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
  return map[c] ?? c;
}
