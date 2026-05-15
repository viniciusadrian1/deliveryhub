import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type SetMenuItemRecipeInput,
  type SetSubRecipeInput,
} from './dto/inventory.dto.js';
import { RecipeCostService } from './recipe-cost.service.js';

/**
 * CRUD de receitas (componentes). Operação principal é "replace all":
 * cliente envia o array final de componentes, o service substitui
 * atomicamente.
 *
 * Ao final de cada save:
 *   - Para MenuItem em modo `recipe`: recalcula `costCents`.
 *   - Para sub-receita: recalcula `costPerUnit` da sub-receita e cascateia
 *     para qualquer consumer (MenuItems e outras sub-receitas).
 *
 * Anti-ciclo é checado ANTES de gravar para sub-receitas.
 */
@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly recipeCost: RecipeCostService,
  ) {}

  async getMenuItemRecipe(auth: AuthContext, menuItemId: string) {
    const item = await this.tenantPrisma.tx.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, costMode: true, costCents: true },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
    const components = await this.tenantPrisma.tx.recipeComponent.findMany({
      where: { menuItemId },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, kind: true, costPerUnit: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return { menuItemId: item.id, costMode: item.costMode, costCents: item.costCents, components };
  }

  async getSubRecipe(auth: AuthContext, subRecipeIngredientId: string) {
    const ing = await this.tenantPrisma.tx.ingredient.findUnique({
      where: { id: subRecipeIngredientId },
      select: {
        id: true,
        kind: true,
        name: true,
        unit: true,
        batchYield: true,
        costPerUnit: true,
      },
    });
    if (!ing) throw new NotFoundException('ingredient_not_found');
    if (ing.kind !== 'sub_recipe') {
      throw new BadRequestException('not_a_sub_recipe');
    }
    const components = await this.tenantPrisma.tx.recipeComponent.findMany({
      where: { parentIngredientId: subRecipeIngredientId },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, kind: true, costPerUnit: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      batchYield: ing.batchYield?.toString() ?? null,
      costPerUnit: ing.costPerUnit.toString(),
      components,
    };
  }

  async setMenuItemRecipe(
    auth: AuthContext,
    menuItemId: string,
    input: SetMenuItemRecipeInput,
  ) {
    const item = await this.tenantPrisma.tx.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, costMode: true },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');

    await this.validateComponentIngredients(auth, input.components);

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeComponent.deleteMany({ where: { menuItemId } });
      if (input.components.length > 0) {
        await tx.recipeComponent.createMany({
          data: input.components.map((c, idx) => ({
            organizationId: auth.orgId,
            menuItemId,
            parentIngredientId: null,
            ingredientId: c.ingredientId,
            quantity: new Prisma.Decimal(c.quantity),
            sortOrder: c.sortOrder ?? idx,
          })),
        });
      }
      // Em recipe mode: recalcula custo. Em manual: ignora.
      await this.recipeCost.recomputeForMenuItem(tx, menuItemId);
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item_recipe',
      entityId: menuItemId,
      action: 'update',
      diff: { componentCount: input.components.length },
    });

    return this.getMenuItemRecipe(auth, menuItemId);
  }

  async setSubRecipe(
    auth: AuthContext,
    subRecipeIngredientId: string,
    input: SetSubRecipeInput,
  ) {
    const ing = await this.tenantPrisma.tx.ingredient.findUnique({
      where: { id: subRecipeIngredientId },
      select: { id: true, kind: true, batchYield: true },
    });
    if (!ing) throw new NotFoundException('ingredient_not_found');
    if (ing.kind !== 'sub_recipe') {
      throw new BadRequestException('not_a_sub_recipe');
    }
    if (!ing.batchYield) {
      throw new BadRequestException('sub_recipe_missing_batch_yield');
    }

    await this.validateComponentIngredients(auth, input.components);
    // Anti-ciclo: nenhum componente pode referenciar (direta ou
    // indiretamente) a própria sub-receita.
    await this.recipeCost.assertNoCycle(
      subRecipeIngredientId,
      input.components.map((c) => c.ingredientId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeComponent.deleteMany({
        where: { parentIngredientId: subRecipeIngredientId },
      });
      if (input.components.length > 0) {
        await tx.recipeComponent.createMany({
          data: input.components.map((c, idx) => ({
            organizationId: auth.orgId,
            menuItemId: null,
            parentIngredientId: subRecipeIngredientId,
            ingredientId: c.ingredientId,
            quantity: new Prisma.Decimal(c.quantity),
            sortOrder: c.sortOrder ?? idx,
          })),
        });
      }
      // Recalcula custo unitário da sub-receita E cascateia para
      // consumidores (MenuItems e sub-receitas que usam ela).
      const result = await this.recipeCost.recomputeForSubRecipe(
        tx,
        subRecipeIngredientId,
      );
      if (result.changed) {
        // Reutiliza o BFS: faz como se a sub-receita fosse o "ingrediente
        // raiz" que mudou — vai cascatear para quem a consome.
        // (chamada interna não cria nova transação; reaproveita esta.)
        await this.propagateInTx(tx, subRecipeIngredientId);
      }
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'sub_recipe',
      entityId: subRecipeIngredientId,
      action: 'update',
      diff: { componentCount: input.components.length },
    });

    return this.getSubRecipe(auth, subRecipeIngredientId);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /** Garante que todos os ingredientes referenciados existem na org. */
  private async validateComponentIngredients(
    auth: AuthContext,
    components: { ingredientId: string }[],
  ): Promise<void> {
    if (components.length === 0) return;
    const ids = [...new Set(components.map((c) => c.ingredientId))];
    const found = await this.tenantPrisma.tx.ingredient.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length) {
      throw new BadRequestException('component_ingredient_not_found');
    }
  }

  /**
   * Versão de cascata reentrante (dentro de uma transação já aberta).
   * Mirror do `RecipeCostService.propagateFromIngredient`, mas reusando
   * o `tx` em vez de abrir nova transação.
   */
  private async propagateInTx(
    tx: Prisma.TransactionClient,
    startingIngredientId: string,
  ): Promise<void> {
    const MAX_DEPTH = 10;
    const visited = new Set<string>([startingIngredientId]);
    const queue: string[] = [startingIngredientId];
    let level = 0;

    while (queue.length > 0 && level <= MAX_DEPTH) {
      const currentLevel = queue.splice(0, queue.length);
      const usages = await tx.recipeComponent.findMany({
        where: { ingredientId: { in: currentLevel } },
        select: { menuItemId: true, parentIngredientId: true },
      });
      const menuItems = new Set<string>();
      const subRecipes = new Set<string>();
      for (const u of usages) {
        if (u.menuItemId) menuItems.add(u.menuItemId);
        if (u.parentIngredientId) subRecipes.add(u.parentIngredientId);
      }
      for (const mid of menuItems) {
        await this.recipeCost.recomputeForMenuItem(tx, mid);
      }
      for (const sid of subRecipes) {
        if (visited.has(sid)) continue;
        visited.add(sid);
        const r = await this.recipeCost.recomputeForSubRecipe(tx, sid);
        if (r.changed) queue.push(sid);
      }
      level++;
    }
  }
}
