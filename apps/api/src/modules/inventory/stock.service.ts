import { Injectable } from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateStockAdjustmentInput,
  type ListMovementsQuery,
} from './dto/inventory.dto.js';

/**
 * Service de estoque: ajustes manuais + queries de saldo + histórico.
 *
 * Entradas automáticas de compra são feitas em PurchasesService (registra
 * a compra + cria StockMovement com reason='purchase' atomicamente).
 *
 * Baixas automáticas por pedido são feitas em StockConsumptionService
 * (idempotente via UNIQUE em (refType, refId, ingredientId)).
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Saldo agregado por ingrediente (SUM(quantity) em stock_movement). */
  async balanceByIngredient(
    auth: AuthContext,
    opts: { storeId: string; ingredientId?: string },
  ) {
    const rows = await this.tenantPrisma.tx.stockMovement.groupBy({
      by: ['ingredientId'],
      where: { storeId: opts.storeId, ingredientId: opts.ingredientId },
      _sum: { quantity: true },
    });

    // Junta com ingrediente para devolver nome/unidade/kind.
    const ingredientIds = rows.map((r) => r.ingredientId);
    const ingredients = ingredientIds.length
      ? await this.tenantPrisma.tx.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          select: { id: true, name: true, unit: true, kind: true, costPerUnit: true },
        })
      : [];
    const byId = new Map(ingredients.map((i) => [i.id, i]));

    return rows
      .map((r) => {
        const ing = byId.get(r.ingredientId);
        if (!ing) return null;
        const balance = r._sum.quantity ?? new Prisma.Decimal(0);
        const valueCents = Math.round(
          balance.mul(ing.costPerUnit).mul(100).toNumber(),
        );
        return {
          ingredientId: r.ingredientId,
          name: ing.name,
          unit: ing.unit,
          kind: ing.kind,
          balance: balance.toString(),
          /** Valor monetário do saldo atual (saldo × custo). */
          valueCents,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  async listMovements(auth: AuthContext, query: ListMovementsQuery) {
    return this.tenantPrisma.tx.stockMovement.findMany({
      where: {
        storeId: query.storeId,
        ingredientId: query.ingredientId,
        reason: query.reason,
        createdAt:
          query.from || query.to
            ? { gte: query.from, lte: query.to }
            : undefined,
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  async createAdjustment(auth: AuthContext, input: CreateStockAdjustmentInput) {
    const movement = await this.tenantPrisma.tx.stockMovement.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        ingredientId: input.ingredientId,
        quantity: new Prisma.Decimal(input.quantity),
        reason: input.reason,
        refType: 'adjustment',
        // Manual adjustment não tem um refId externo; o próprio movimento é a fonte.
        refId: null,
        notes: input.notes ?? null,
        createdById: auth.userId,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'stock_movement',
      entityId: movement.id,
      action: 'create',
      diff: {
        ingredientId: input.ingredientId,
        quantity: input.quantity,
        reason: input.reason,
      },
    });
    return movement;
  }
}
