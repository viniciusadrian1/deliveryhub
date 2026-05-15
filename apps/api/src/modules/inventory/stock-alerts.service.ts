import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Prisma } from '@deliveryhub/db';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

/** Janela de consumo histórico usada para calcular taxa diária. */
const CONSUMPTION_WINDOW_DAYS = 30;
/** Default de targetDays quando o ingrediente não define um. */
const DEFAULT_TARGET_DAYS = 7;
/** Cache anti-spam: só renotifica um ingrediente após N horas. */
const NOTIFICATION_COOLDOWN_HOURS = 24;

/**
 * Sumário do estoque de um ingrediente — saldo, consumo médio diário,
 * estado de alerta e sugestão de compra. Computado live (não persistido).
 */
export interface StockSummary {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  storeId: string;
  balance: Prisma.Decimal;
  /** Quanto o usuário definiu como mínimo. Null = sem regra. */
  minLevel: Prisma.Decimal | null;
  /** Consumo médio dos últimos N dias (na unidade-base, por dia). */
  avgDailyConsumption: Prisma.Decimal;
  /** Dias estimados que o saldo atual vai durar (∞ = consumo zero). */
  daysOfCover: number | null;
  /** True quando balance < minLevel. */
  belowMinimum: boolean;
  /** True quando saldo atual cobre menos que `targetDays`. */
  needsRestock: boolean;
  /** Quantidade sugerida pra comprar pra cobrir `targetDays`. */
  suggestedPurchase: Prisma.Decimal;
  /** Dias de cobertura configurados (ou DEFAULT). */
  targetDays: number;
}

/**
 * StockAlertsService:
 *
 *  - `summarize(storeId)`: gera StockSummary[] para todos os ingredientes
 *    ativos de uma loja. Usado pela UI (/inventory aba Alertas).
 *
 *  - `runDailyCheck()`: cron diário (08:00). Pra cada org com pelo
 *    menos uma loja, computa summary e dispara notificação `stock_low`
 *    pros owners/managers de cada ingrediente em estado `belowMinimum`.
 *    Anti-spam via dedup por (userId, ingredientId) nas últimas 24h.
 *
 * Consumo médio é calculado a partir do histórico de StockMovement
 * (apenas movimentos NEGATIVOS na janela — exclui ajustes positivos e
 * compras). Esse cálculo NÃO sofre com retroatividade: se uma compra
 * grande entrou ontem, não infla o consumo médio.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async summarize(
    organizationId: string,
    storeId: string,
  ): Promise<StockSummary[]> {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { organizationId, storeId, archivedAt: null },
      select: {
        id: true,
        name: true,
        unit: true,
        storeId: true,
        minLevel: true,
        targetDays: true,
      },
    });
    if (ingredients.length === 0) return [];

    // Saldo atual de cada ingrediente (SUM stockMovement.quantity)
    const balances = await this.prisma.stockMovement.groupBy({
      by: ['ingredientId'],
      where: {
        ingredientId: { in: ingredients.map((i) => i.id) },
        storeId,
      },
      _sum: { quantity: true },
    });
    const balanceByIngId = new Map(
      balances.map((b) => [b.ingredientId, b._sum.quantity ?? new Prisma.Decimal(0)]),
    );

    // Consumo dos últimos N dias (movimentos negativos apenas).
    const windowStart = new Date(Date.now() - CONSUMPTION_WINDOW_DAYS * 24 * 3600 * 1000);
    const consumption = await this.prisma.stockMovement.groupBy({
      by: ['ingredientId'],
      where: {
        ingredientId: { in: ingredients.map((i) => i.id) },
        storeId,
        createdAt: { gte: windowStart },
        quantity: { lt: 0 },
      },
      _sum: { quantity: true },
    });
    const consumedByIngId = new Map(
      consumption.map((c) => [
        c.ingredientId,
        // quantity é negativa; pega o valor absoluto pra trabalhar
        (c._sum.quantity ?? new Prisma.Decimal(0)).abs(),
      ]),
    );

    return ingredients.map((ing) => {
      const balance = balanceByIngId.get(ing.id) ?? new Prisma.Decimal(0);
      const consumed = consumedByIngId.get(ing.id) ?? new Prisma.Decimal(0);
      const avgDailyConsumption = consumed.div(CONSUMPTION_WINDOW_DAYS);
      const targetDays = ing.targetDays ?? DEFAULT_TARGET_DAYS;

      const daysOfCover = avgDailyConsumption.greaterThan(0)
        ? Math.round(balance.div(avgDailyConsumption).toNumber())
        : null;

      const belowMinimum = ing.minLevel
        ? balance.lessThan(ing.minLevel)
        : false;

      const needsRestock =
        (ing.minLevel && belowMinimum) ||
        (daysOfCover !== null && daysOfCover < targetDays);

      // Sugestão = (consumoDiário × targetDays) − saldo atual.
      // Mínimo zero (não sugerimos negativo se já tem demais).
      const targetAmount = avgDailyConsumption.mul(targetDays);
      const suggestedPurchase = targetAmount.greaterThan(balance)
        ? targetAmount.sub(balance)
        : new Prisma.Decimal(0);

      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        storeId: ing.storeId,
        balance,
        minLevel: ing.minLevel,
        avgDailyConsumption,
        daysOfCover,
        belowMinimum,
        needsRestock: Boolean(needsRestock),
        suggestedPurchase,
        targetDays,
      };
    });
  }

  /**
   * Cron diário 08:00 — varre organizações, dispara notificação pros
   * usuários owner/manager de cada org sobre ingredientes abaixo do mínimo.
   */
  @Cron('0 0 8 * * *')
  async runDailyCheck(): Promise<void> {
    this.logger.log('stock_alerts_daily_check_started');

    const orgs = await this.prisma.organization.findMany({
      select: { id: true, stores: { select: { id: true } } },
    });

    let totalNotificationsFired = 0;
    for (const org of orgs) {
      for (const store of org.stores) {
        try {
          const summary = await this.summarize(org.id, store.id);
          const lowItems = summary.filter((s) => s.belowMinimum);
          if (lowItems.length === 0) continue;

          // Quem recebe: owners e managers da org.
          const targets = await this.prisma.membership.findMany({
            where: {
              organizationId: org.id,
              role: { in: ['owner', 'manager'] },
            },
            select: { userId: true, user: { select: { email: true } } },
          });

          for (const target of targets) {
            const recentlySent = await this.wasRecentlyNotified(
              target.userId,
              store.id,
            );
            if (recentlySent) continue;

            await this.notifications.create({
              userId: target.userId,
              organizationId: org.id,
              kind: 'stock_low',
              title: `Estoque baixo: ${lowItems.length} ${
                lowItems.length === 1 ? 'insumo' : 'insumos'
              }`,
              body: lowItems
                .slice(0, 3)
                .map((i) => `${i.ingredientName} (${i.balance.toFixed(2)} ${i.unit})`)
                .join(' · ') + (lowItems.length > 3 ? `…e mais ${lowItems.length - 3}` : ''),
              linkUrl: '/inventory',
              metadata: { storeId: store.id, count: lowItems.length },
            });
            totalNotificationsFired++;
          }
        } catch (err) {
          this.logger.error(
            { err, orgId: org.id, storeId: store.id },
            'stock_alert_failed',
          );
        }
      }
    }

    this.logger.log(
      { totalNotificationsFired },
      'stock_alerts_daily_check_done',
    );
  }

  /** Verifica se já mandamos notificação `stock_low` pra esse user/store nas últimas 24h. */
  private async wasRecentlyNotified(userId: string, storeId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - NOTIFICATION_COOLDOWN_HOURS * 3600 * 1000);
    const recent = await this.prisma.notification.findFirst({
      where: {
        userId,
        kind: 'stock_low',
        createdAt: { gte: cutoff },
        // metadata é Json — Prisma suporta filtro JSON path
        metadata: { path: ['storeId'], equals: storeId },
      },
      select: { id: true },
    });
    return !!recent;
  }
}

// Re-uso com CronExpression conhecido por completude — mas usamos string explícito acima.
export const STOCK_ALERTS_CRON = CronExpression.EVERY_DAY_AT_8AM;
