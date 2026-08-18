import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { type SetComboComponentsInput } from './dto/combo.dto.js';

/**
 * Combos: MenuItem composto de outros MenuItems.
 *
 * Regras:
 *  - O combo (parent) precisa ter productKind='combo'.
 *  - Componentes precisam ser productKind='single' (sem combos de combos
 *    por simplicidade — pode ser permitido depois com anti-ciclo, igual
 *    sub-receitas).
 *  - CMV do combo = soma de (componente.costCents × qty). Recalculado a
 *    cada save.
 *  - DB: CHECK no banco proíbe self-reference; UNIQUE em (combo, component)
 *    impede duplicatas.
 */
@Injectable()
export class CombosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async getCombo(auth: AuthContext, menuItemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: auth.orgId },
      select: {
        id: true,
        productKind: true,
        costCents: true,
      },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
    if (item.productKind !== 'combo') {
      throw new BadRequestException('not_a_combo');
    }
    const components = await this.prisma.comboComponent.findMany({
      where: { comboMenuItemId: menuItemId, organizationId: auth.orgId },
      include: {
        componentItem: {
          select: { id: true, name: true, costCents: true, imageUrl: true, salesKind: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return { menuItemId: item.id, costCents: item.costCents, components };
  }

  async setComponents(
    auth: AuthContext,
    menuItemId: string,
    input: SetComboComponentsInput,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: auth.orgId },
      select: { id: true, productKind: true, storeId: true },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
    if (item.productKind !== 'combo') {
      throw new BadRequestException('not_a_combo');
    }

    // Anti self-ref e validação: todos os componentes existem na mesma store
    // e são single (não-combo).
    const componentIds = [...new Set(input.components.map((c) => c.componentMenuItemId))];
    if (componentIds.includes(menuItemId)) {
      throw new BadRequestException('combo_self_reference');
    }
    const components = await this.prisma.menuItem.findMany({
      where: { id: { in: componentIds }, organizationId: auth.orgId },
      select: { id: true, storeId: true, productKind: true, costCents: true },
    });
    if (components.length !== componentIds.length) {
      throw new BadRequestException('component_not_found');
    }
    for (const c of components) {
      if (c.storeId !== item.storeId) {
        throw new BadRequestException('component_store_mismatch');
      }
      if (c.productKind !== 'single') {
        throw new BadRequestException('combo_components_must_be_single');
      }
    }

    // Recalcula CMV do combo = sum(component.costCents * qty).
    const costById = new Map(components.map((c) => [c.id, c.costCents]));
    const totalCost = input.components.reduce((sum, c) => {
      const unit = costById.get(c.componentMenuItemId) ?? 0;
      return sum + unit * c.quantity;
    }, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.comboComponent.deleteMany({
        where: { comboMenuItemId: menuItemId },
      });
      await tx.comboComponent.createMany({
        data: input.components.map((c, idx) => ({
          organizationId: auth.orgId,
          comboMenuItemId: menuItemId,
          componentMenuItemId: c.componentMenuItemId,
          quantity: c.quantity,
          sortOrder: c.sortOrder ?? idx,
        })),
      });
      await tx.menuItem.update({
        where: { id: menuItemId },
        data: { costCents: totalCost },
      });
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'combo',
      entityId: menuItemId,
      action: 'update',
      diff: { componentCount: input.components.length, totalCost },
    });

    return this.getCombo(auth, menuItemId);
  }

  /**
   * Recalcula o CMV (`costCents`) de todo combo que contém qualquer um dos
   * `changedMenuItemIds` como componente.
   *
   * A cascata de custos de receita (RecipeCostService.propagateFromIngredient /
   * RecipesService.propagateInTx) atualiza o `costCents` dos itens `single`
   * quando o custo de um insumo muda, mas não conhece ComboComponent — então o
   * CMV dos combos ficava velho até alguém re-salvar o combo. Esta helper é
   * chamada AO FINAL daquelas cascatas, dentro da MESMA transação, com o
   * conjunto de MenuItems que tiveram o custo recalculado.
   *
   * Combos de combos são proibidos (componentes precisam ser `single`), então
   * um único passo basta — sem recursão.
   *
   * ponytail: espelha o cálculo de setComponents (sum(component.costCents*qty));
   * se o custo do combo virar receita própria um dia, unificar com aquele path.
   */
  async recomputeCombosContaining(
    tx: Prisma.TransactionClient,
    changedMenuItemIds: Iterable<string>,
  ): Promise<void> {
    const ids = [...new Set(changedMenuItemIds)];
    if (ids.length === 0) return;

    const links = await tx.comboComponent.findMany({
      where: { componentMenuItemId: { in: ids } },
      select: { comboMenuItemId: true },
    });
    const comboIds = [...new Set(links.map((l) => l.comboMenuItemId))];

    for (const comboId of comboIds) {
      // Soma sobre TODOS os componentes atuais do combo (não só os que
      // mudaram), lendo o costCents já atualizado de cada componente.
      const components = await tx.comboComponent.findMany({
        where: { comboMenuItemId: comboId },
        include: { componentItem: { select: { costCents: true } } },
      });
      const totalCost = components.reduce(
        (sum, c) => sum + c.componentItem.costCents * c.quantity,
        0,
      );
      await tx.menuItem.update({
        where: { id: comboId },
        data: { costCents: totalCost },
      });
    }
  }
}
