import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreatePurchaseInput,
  type ListPurchasesQuery,
} from './dto/inventory.dto.js';
import { RecipeCostService } from './recipe-cost.service.js';

/**
 * Compras de insumos.
 *
 * Cada compra:
 *   1. Cria registro em ingredient_purchase
 *   2. Cria stock_movement (+quantity, reason='purchase', refType='purchase', refId=purchase.id)
 *   3. Atualiza ingredient.costPerUnit usando média ponderada *com saldo atual*:
 *        novoCusto = (saldoAtual * custoAtual + qtdComprada * unitCost) / (saldoAtual + qtdComprada)
 *      Se saldoAtual <= 0, novoCusto = unitCost (compra zera o "histórico" anterior).
 *   4. Dispara cascata de custo (RecipeCostService.propagateFromIngredient)
 *
 * Tudo em uma única transação para garantir consistência.
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    @Inject(forwardRef(() => RecipeCostService))
    private readonly recipeCost: RecipeCostService,
  ) {}

  async list(auth: AuthContext, query: ListPurchasesQuery) {
    return this.tenantPrisma.tx.ingredientPurchase.findMany({
      where: {
        storeId: query.storeId,
        ingredientId: query.ingredientId,
        supplierId: query.supplierId,
        purchasedAt:
          query.from || query.to
            ? { gte: query.from, lte: query.to }
            : undefined,
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { purchasedAt: 'desc' },
      take: query.limit,
    });
  }

  async create(auth: AuthContext, input: CreatePurchaseInput) {
    const ingredient = await this.tenantPrisma.tx.ingredient.findUnique({
      where: { id: input.ingredientId },
      select: { id: true, kind: true, costPerUnit: true, storeId: true },
    });
    if (!ingredient) throw new NotFoundException('ingredient_not_found');
    if (ingredient.kind === 'sub_recipe') {
      throw new BadRequestException('cannot_purchase_sub_recipe');
    }
    if (ingredient.storeId !== input.storeId) {
      throw new BadRequestException('ingredient_store_mismatch');
    }

    const qty = new Prisma.Decimal(input.quantity);
    const unitCost = new Prisma.Decimal(input.unitCost);
    const totalCost = qty.mul(unitCost);

    const result = await this.prisma.$transaction(async (tx) => {
      // Trava a linha do ingrediente (FOR UPDATE) para serializar compras
      // concorrentes do mesmo insumo: a 2ª transação bloqueia até a 1ª
      // commitar e então lê saldo+custo já atualizados, evitando que dois
      // save simultâneos (ou duplo-clique) corrompam a média ponderada.
      const [locked] = await tx.$queryRaw<{ cost_per_unit: Prisma.Decimal }[]>`
        SELECT cost_per_unit FROM ingredient WHERE id = ${ingredient.id} FOR UPDATE
      `;
      const currentCost = locked?.cost_per_unit ?? ingredient.costPerUnit;

      // Saldo lido DENTRO da transação, depois da trava — nunca de um snapshot
      // obsoleto lido antes do $transaction.
      const balanceRow = await tx.stockMovement.aggregate({
        where: { ingredientId: ingredient.id, storeId: input.storeId },
        _sum: { quantity: true },
      });
      const currentBalance = balanceRow._sum.quantity ?? new Prisma.Decimal(0);

      const newCost = computeWeightedAverageCost(
        currentBalance,
        currentCost,
        qty,
        unitCost,
      );

      const purchase = await tx.ingredientPurchase.create({
        data: {
          organizationId: auth.orgId,
          storeId: input.storeId,
          ingredientId: input.ingredientId,
          supplierId: input.supplierId ?? null,
          quantity: qty,
          unitCost,
          totalCost,
          invoiceNumber: input.invoiceNumber ?? null,
          purchasedAt: input.purchasedAt ?? new Date(),
          notes: input.notes ?? null,
          createdById: auth.userId,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId: auth.orgId,
          storeId: input.storeId,
          ingredientId: input.ingredientId,
          quantity: qty,
          reason: 'purchase',
          refType: 'purchase',
          refId: purchase.id,
          notes: null,
          createdById: auth.userId,
        },
      });

      // Atualiza custo do ingrediente se mudou de fato (epsilon = 1e-8)
      const costChanged = !newCost.equals(currentCost);
      if (costChanged) {
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: { costPerUnit: newCost },
        });
      }

      return { purchase, costChanged };
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'ingredient_purchase',
      entityId: result.purchase.id,
      action: 'create',
      diff: {
        ingredientId: input.ingredientId,
        quantity: input.quantity,
        unitCost: input.unitCost,
        totalCost: totalCost.toString(),
      },
    });

    if (result.costChanged) {
      await this.recipeCost.propagateFromIngredient(auth, ingredient.id);
    }

    return result.purchase;
  }
}

/**
 * Custo médio ponderado. Em uma operação de compra:
 *   - se saldo atual > 0: pondera (saldo, custo atual) com (qtdComprada, unitCost)
 *   - se saldo <= 0: o lote comprado define o custo (não tem com o que ponderar)
 *
 * Mantemos a precisão Decimal — arredondamento só ocorre no MenuItem.costCents.
 */
export function computeWeightedAverageCost(
  currentBalance: Prisma.Decimal,
  currentCost: Prisma.Decimal,
  purchasedQty: Prisma.Decimal,
  purchasedUnitCost: Prisma.Decimal,
): Prisma.Decimal {
  if (currentBalance.lessThanOrEqualTo(0)) {
    return purchasedUnitCost;
  }
  const totalValueBefore = currentBalance.mul(currentCost);
  const totalValueAdded = purchasedQty.mul(purchasedUnitCost);
  const newBalance = currentBalance.add(purchasedQty);
  return totalValueBefore.add(totalValueAdded).div(newBalance);
}
