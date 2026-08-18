import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { PrismaService } from '../../common/prisma/prisma.service.js';

const MAX_DEPTH = 10;

/**
 * Baixa de estoque por pedido entregue.
 *
 * Para cada item de pedido, expandimos a receita recursivamente até insumos
 * folha (kind=raw) e criamos UM `stock_movement` por raw consumido.
 *
 * **Idempotência**:
 *   - Antes de qualquer escrita, fazemos pre-check em `stock_movement` por
 *     `(refType='order', refId=orderId)`. Se já houver registros, assumimos
 *     que a baixa já ocorreu e retornamos `{ skipped: true }`.
 *   - O UNIQUE INDEX (ref_type, ref_id, ingredient_id) na tabela é nossa
 *     defesa final caso o pre-check falhe sob concorrência.
 *
 * **Erros não bloqueiam o pedido**: se a baixa falhar (ex.: item sem
 * receita, recursão muito profunda), apenas logamos e retornamos — a
 * transição do pedido pra delivered continua.
 *
 * **storeId**: derivado do `Order`. Insumos só descontam se pertencem à
 * mesma `store` do pedido (segurança defensiva contra cross-tenant via dados
 * malformados).
 */
@Injectable()
export class StockConsumptionService {
  private readonly logger = new Logger(StockConsumptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consome estoque para um pedido entregue. Não lança — falhas viram
   * warnings nos logs.
   *
   * @returns informação de auditoria; o caller normalmente ignora.
   */
  async consumeForOrder(orderId: string): Promise<{
    skipped: boolean;
    movementsCreated: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          organizationId: true,
          storeId: true,
          status: true,
          items: {
            select: {
              id: true,
              menuItemId: true,
              qty: true,
            },
          },
        },
      });
      if (!order) {
        this.logger.warn({ orderId }, 'stock_consume_order_not_found');
        return { skipped: false, movementsCreated: 0, warnings: ['order_not_found'] };
      }

      // Idempotência: já consumiu antes?
      const existingMovementCount = await this.prisma.stockMovement.count({
        where: { refType: 'order', refId: orderId },
      });
      if (existingMovementCount > 0) {
        return {
          skipped: true,
          movementsCreated: 0,
          warnings: ['already_consumed'],
        };
      }

      // Agrega total de cada insumo folha (raw) consumido pelo pedido.
      const totals = new Map<string, Prisma.Decimal>();

      for (const item of order.items) {
        if (!item.menuItemId) continue;
        try {
          // Expande primeiro o item: se for combo, vira N MenuItems single;
          // cada um vai pra accumulateLeafConsumption pra expandir a receita.
          const expanded = await this.expandToSingleItems(
            order.organizationId,
            item.menuItemId,
            new Prisma.Decimal(item.qty),
            warnings,
          );
          for (const e of expanded) {
            await this.accumulateLeafConsumption(
              order.organizationId,
              e.menuItemId,
              e.qty,
              totals,
              warnings,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown_error';
          warnings.push(`item:${item.id}:${msg}`);
          this.logger.warn(
            { err, orderId, orderItemId: item.id },
            'stock_consume_item_failed',
          );
        }
      }

      if (totals.size === 0) {
        return { skipped: false, movementsCreated: 0, warnings };
      }

      // Validação extra: garantir que todos os ingredientes pertencem à store do pedido.
      const ingredientIds = [...totals.keys()];
      const ingredients = await this.prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true, storeId: true, organizationId: true },
      });
      const validIds = new Set(
        ingredients
          .filter(
            (i) =>
              i.organizationId === order.organizationId && i.storeId === order.storeId,
          )
          .map((i) => i.id),
      );

      let movementsCreated = 0;
      await this.prisma.$transaction(async (tx) => {
        for (const [ingId, qty] of totals) {
          if (!validIds.has(ingId)) {
            warnings.push(`ingredient:${ingId}:store_mismatch_or_missing`);
            continue;
          }
          if (qty.lessThanOrEqualTo(0)) continue;
          try {
            await tx.stockMovement.create({
              data: {
                organizationId: order.organizationId,
                storeId: order.storeId,
                ingredientId: ingId,
                quantity: qty.negated(), // saída => negativo
                reason: 'recipe_consumption',
                refType: 'order',
                refId: orderId,
                createdById: null,
              },
            });
            movementsCreated++;
          } catch (err) {
            // Possível P2002 (UNIQUE violation): outro processo já criou
            // — ok, idempotência mantida.
            const code = (err as { code?: string }).code;
            if (code === 'P2002') {
              warnings.push(`ingredient:${ingId}:duplicate_skipped`);
            } else {
              throw err;
            }
          }
        }
      });

      return { skipped: false, movementsCreated, warnings };
    } catch (err) {
      this.logger.error({ err, orderId }, 'stock_consume_unexpected_failure');
      return {
        skipped: false,
        movementsCreated: 0,
        warnings: ['unexpected_failure'],
      };
    }
  }

  /**
   * Se o MenuItem é combo, expande para seus componentes (single). Se é
   * single, devolve ele mesmo. Não é recursivo (combos-de-combos não são
   * suportados — o ComboService rejeita).
   */
  private async expandToSingleItems(
    organizationId: string,
    menuItemId: string,
    qty: Prisma.Decimal,
    warnings: string[],
  ): Promise<{ menuItemId: string; qty: Prisma.Decimal }[]> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId },
      select: { id: true, productKind: true },
    });
    if (!item) {
      warnings.push(`menu_item_not_found:${menuItemId}`);
      return [];
    }
    if (item.productKind !== 'combo') {
      return [{ menuItemId: item.id, qty }];
    }
    const components = await this.prisma.comboComponent.findMany({
      where: { comboMenuItemId: menuItemId, organizationId },
      select: { componentMenuItemId: true, quantity: true },
    });
    if (components.length === 0) {
      warnings.push(`combo_without_components:${menuItemId}`);
      return [];
    }
    return components.map((c) => ({
      menuItemId: c.componentMenuItemId,
      qty: qty.mul(c.quantity),
    }));
  }

  /**
   * Expande recursivamente a receita de um MenuItem (ou sub-receita) até
   * insumos raw, acumulando quantidades por ingredientId no map `totals`.
   *
   * @param multiplier  Quantas vezes o "produto" sendo expandido foi vendido.
   *                    Multiplicado por cada componente.
   * @param depth       Controle de recursão (anti-ciclo por caminho: `path`).
   */
  private async accumulateLeafConsumption(
    organizationId: string,
    rootId: string,
    rootQty: Prisma.Decimal,
    totals: Map<string, Prisma.Decimal>,
    warnings: string[],
  ): Promise<void> {
    // `path` = ancestrais (sub-receitas) do frame atual. Detecção de ciclo é
    // por-caminho, não um "seen" global: uma sub-receita compartilhada por dois
    // ramos (diamante) precisa ser expandida em cada ramo, senão descontamos
    // metade do consumo real.
    type Frame = {
      kind: 'menuItem' | 'subRecipe';
      id: string;
      qty: Prisma.Decimal;
      depth: number;
      path: Set<string>;
    };
    const stack: Frame[] = [
      { kind: 'menuItem', id: rootId, qty: rootQty, depth: 0, path: new Set() },
    ];

    while (stack.length > 0) {
      const frame = stack.pop()!;
      if (frame.depth > MAX_DEPTH) {
        warnings.push(`depth_exceeded_at:${frame.id}`);
        continue;
      }

      const components =
        frame.kind === 'menuItem'
          ? await this.prisma.recipeComponent.findMany({
              where: { menuItemId: frame.id, organizationId },
              include: {
                ingredient: {
                  select: { id: true, kind: true, batchYield: true },
                },
              },
            })
          : await this.prisma.recipeComponent.findMany({
              where: { parentIngredientId: frame.id, organizationId },
              include: {
                ingredient: {
                  select: { id: true, kind: true, batchYield: true },
                },
              },
            });

      if (components.length === 0) {
        if (frame.kind === 'menuItem') {
          warnings.push(`menu_item_without_recipe:${frame.id}`);
        }
        continue;
      }

      for (const c of components) {
        const ing = c.ingredient;
        // Quantidade *bruta* requerida deste componente:
        // qty do frame × qty da linha de receita.
        const required = frame.qty.mul(c.quantity);
        if (ing.kind === 'raw') {
          const prev = totals.get(ing.id) ?? new Prisma.Decimal(0);
          totals.set(ing.id, prev.add(required));
        } else {
          // sub-receita: expandir recursivamente. Normalizar pela batchYield:
          // "preciso de X gramas do molho, e cada execução da receita produz Y g —
          // logo executei a receita X/Y vezes."
          // Ciclo real = a sub-receita aparece entre seus próprios ancestrais.
          if (frame.path.has(ing.id)) {
            warnings.push(`cycle_in_recipe:${ing.id}`);
            continue;
          }
          const yieldVal = ing.batchYield ?? new Prisma.Decimal(1);
          const recipeRuns = required.div(yieldVal);
          stack.push({
            kind: 'subRecipe',
            id: ing.id,
            qty: recipeRuns,
            depth: frame.depth + 1,
            path: new Set(frame.path).add(ing.id),
          });
        }
      }
    }
  }
}
