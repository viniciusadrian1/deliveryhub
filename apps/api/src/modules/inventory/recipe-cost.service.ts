import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

/** Limite duro de recursão na expansão de receitas — rede de segurança. */
const MAX_DEPTH = 10;

/**
 * Engine de custos:
 *
 *  - `computeRecipeCost`: calcula recursivamente o custo *total* (não unitário)
 *    de uma receita (lista de RecipeComponent) usando os custos atuais de
 *    cada componente. Sub-receitas são expandidas como filhos.
 *
 *  - `recomputeForMenuItem`: aplica o custo total como `costCents` do
 *    MenuItem (arredondado a inteiro). Só faz sentido em MenuItems com
 *    `costMode='recipe'`. Para MenuItems `costMode='manual'`, ignora.
 *
 *  - `recomputeForSubRecipe`: calcula `costPerUnit` da sub-receita como
 *    (custo total da receita) / batchYield. Atualiza Ingredient.costPerUnit.
 *
 *  - `propagateFromIngredient`: ponto de entrada das cascatas. Quando o
 *    custo de um Ingredient muda, percorre BFS na direção dos consumidores:
 *      raw -> sub-receitas que usam -> sub-receitas que usam aquelas -> ...
 *                                  \-> MenuItems que usam (em qualquer nível)
 *    Tudo em UMA transação Prisma. Anti-ciclo: visitedIngredients +
 *    MAX_DEPTH (na expansão de cada receita).
 *
 *  - `assertNoCycle`: chamado pelo RecipesService antes de salvar a receita
 *    de uma sub-receita, garantindo que ela não inclua a si mesma direta ou
 *    indiretamente.
 */
@Injectable()
export class RecipeCostService {
  private readonly logger = new Logger(RecipeCostService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // Cálculo de custo (consultas em modo leitura — usadas para preview)
  // -------------------------------------------------------------------

  /**
   * Calcula o custo *total* da receita (somatório de quantity × costPerUnit
   * de cada componente, expandindo sub-receitas). Não escreve no banco.
   */
  async computeRecipeCost(
    auth: AuthContext,
    parent: { menuItemId?: string; parentIngredientId?: string },
  ): Promise<Prisma.Decimal> {
    return this.computeRecipeCostTx(this.prisma, parent, 0, new Set());
  }

  private async computeRecipeCostTx(
    tx: Prisma.TransactionClient | PrismaService,
    parent: { menuItemId?: string; parentIngredientId?: string },
    depth: number,
    visitedSubRecipes: Set<string>,
  ): Promise<Prisma.Decimal> {
    if (depth > MAX_DEPTH) {
      throw new BadRequestException('recipe_depth_exceeded');
    }
    const components = await tx.recipeComponent.findMany({
      where: parent.menuItemId
        ? { menuItemId: parent.menuItemId }
        : { parentIngredientId: parent.parentIngredientId },
      include: {
        ingredient: {
          select: { id: true, kind: true, costPerUnit: true, batchYield: true },
        },
      },
    });

    let total = new Prisma.Decimal(0);
    for (const c of components) {
      const qty = c.quantity;
      const ing = c.ingredient;
      if (ing.kind === 'raw') {
        total = total.add(qty.mul(ing.costPerUnit));
      } else {
        // sub-receita: usa o costPerUnit já calculado. (Cascata garante
        // que esteja atualizado antes de chegar aqui.)
        if (visitedSubRecipes.has(ing.id)) {
          throw new BadRequestException('recipe_cycle_detected');
        }
        visitedSubRecipes.add(ing.id);
        total = total.add(qty.mul(ing.costPerUnit));
        visitedSubRecipes.delete(ing.id);
      }
    }
    return total;
  }

  // -------------------------------------------------------------------
  // Escrita: aplicar custo calculado em MenuItem / Ingredient(sub_recipe)
  // -------------------------------------------------------------------

  /**
   * Recalcula `MenuItem.costCents` a partir da receita. Se `costMode='manual'`,
   * sai silencioso (manual sobrescreve receita). Roda em transação dada.
   */
  async recomputeForMenuItem(
    tx: Prisma.TransactionClient,
    menuItemId: string,
  ): Promise<{ changed: boolean; oldCostCents: number; newCostCents: number }> {
    const item = await tx.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, costMode: true, costCents: true },
    });
    if (!item || item.costMode !== 'recipe') {
      return { changed: false, oldCostCents: item?.costCents ?? 0, newCostCents: item?.costCents ?? 0 };
    }
    const totalCost = await this.computeRecipeCostTx(
      tx,
      { menuItemId },
      0,
      new Set(),
    );
    // Receita -> centavos: arredondamento bancário (round-half-even via JS round).
    const newCostCents = Math.round(totalCost.mul(100).toNumber());
    if (newCostCents === item.costCents) {
      return { changed: false, oldCostCents: item.costCents, newCostCents };
    }
    await tx.menuItem.update({
      where: { id: menuItemId },
      data: { costCents: newCostCents },
    });
    return { changed: true, oldCostCents: item.costCents, newCostCents };
  }

  /**
   * Recalcula `Ingredient.costPerUnit` para uma sub-receita:
   * custo unitário = (custo total da receita) / batchYield.
   */
  async recomputeForSubRecipe(
    tx: Prisma.TransactionClient,
    subRecipeId: string,
  ): Promise<{ changed: boolean }> {
    const ing = await tx.ingredient.findUnique({
      where: { id: subRecipeId },
      select: { id: true, kind: true, batchYield: true, costPerUnit: true },
    });
    if (!ing || ing.kind !== 'sub_recipe' || !ing.batchYield) {
      return { changed: false };
    }
    const totalCost = await this.computeRecipeCostTx(
      tx,
      { parentIngredientId: subRecipeId },
      0,
      new Set(),
    );
    const newCostPerUnit = totalCost.div(ing.batchYield);
    if (newCostPerUnit.equals(ing.costPerUnit)) {
      return { changed: false };
    }
    await tx.ingredient.update({
      where: { id: subRecipeId },
      data: { costPerUnit: newCostPerUnit },
    });
    return { changed: true };
  }

  // -------------------------------------------------------------------
  // Cascata: ingrediente mudou de custo, propaga para todos os consumidores
  // -------------------------------------------------------------------

  /**
   * BFS sobre "quem consome quem". Tudo em UMA transação — sistema nunca
   * fica com CMV parcialmente atualizado.
   *
   * 1. Encontra todos os RecipeComponent que apontam para `ingredientId`.
   *    Cada um tem um pai: MenuItem (caso A) ou Ingredient sub_recipe (caso B).
   * 2. Para cada MenuItem afetado: recomputeForMenuItem
   * 3. Para cada sub_recipe afetada:
   *      a. recomputeForSubRecipe (custo unitário muda)
   *      b. se mudou, agenda a sub_recipe para o próximo nível de cascata
   *         (porque outras sub-receitas / MenuItems podem usar ela)
   * 4. Repete até a fila esvaziar OU MAX_DEPTH níveis.
   */
  async propagateFromIngredient(
    auth: AuthContext,
    ingredientId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const visited = new Set<string>([ingredientId]);
      const queue: string[] = [ingredientId];
      let level = 0;

      while (queue.length > 0) {
        if (level > MAX_DEPTH) {
          this.logger.warn(
            { ingredientId, level },
            'recipe_cascade_max_depth_reached',
          );
          break;
        }
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

        for (const menuItemId of menuItems) {
          await this.recomputeForMenuItem(tx, menuItemId);
        }

        for (const subId of subRecipes) {
          if (visited.has(subId)) continue;
          visited.add(subId);
          const result = await this.recomputeForSubRecipe(tx, subId);
          if (result.changed) {
            queue.push(subId);
          }
        }
        level++;
      }
    });
  }

  // -------------------------------------------------------------------
  // Anti-ciclo
  // -------------------------------------------------------------------

  /**
   * Garante que ao salvar a receita de `parentSubRecipeId`, nenhum
   * componente (direto ou via expansão recursiva) seja a própria
   * `parentSubRecipeId`. Sobe a árvore "quem usa quem" para validar.
   *
   * Algorithm: dado um conjunto de componentes propostos, expande
   * recursivamente todos os ingredientes que são sub_recipe e checa
   * se algum bate em `parentSubRecipeId`.
   */
  async assertNoCycle(
    parentSubRecipeId: string,
    componentIngredientIds: string[],
  ): Promise<void> {
    if (componentIngredientIds.includes(parentSubRecipeId)) {
      throw new BadRequestException('recipe_self_reference');
    }
    const visited = new Set<string>(componentIngredientIds);
    const queue = [...componentIngredientIds];
    let depth = 0;

    while (queue.length > 0) {
      if (depth > MAX_DEPTH) {
        throw new BadRequestException('recipe_depth_exceeded');
      }
      const currentIds = queue.splice(0, queue.length);
      const subs = await this.prisma.ingredient.findMany({
        where: { id: { in: currentIds }, kind: 'sub_recipe' },
        select: {
          id: true,
          recipeOf: { select: { ingredientId: true } },
        },
      });
      for (const s of subs) {
        for (const child of s.recipeOf) {
          if (child.ingredientId === parentSubRecipeId) {
            throw new BadRequestException('recipe_cycle_detected');
          }
          if (!visited.has(child.ingredientId)) {
            visited.add(child.ingredientId);
            queue.push(child.ingredientId);
          }
        }
      }
      depth++;
    }
  }
}
