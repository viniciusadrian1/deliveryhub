import {
  BadRequestException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';

import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateIngredientInput,
  type UpdateIngredientInput,
} from './dto/inventory.dto.js';
import { RecipeCostService } from './recipe-cost.service.js';

@Injectable()
export class IngredientsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    /** circular: ingredient update -> RecipeCostService -> queries ingredients. */
    @Inject(forwardRef(() => RecipeCostService))
    private readonly recipeCost: RecipeCostService,
  ) {}

  async list(
    auth: AuthContext,
    opts: { storeId?: string; kind?: 'raw' | 'sub_recipe'; includeArchived?: boolean } = {},
  ) {
    return this.tenantPrisma.tx.ingredient.findMany({
      where: {
        archivedAt: opts.includeArchived ? undefined : null,
        storeId: opts.storeId,
        kind: opts.kind,
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const ing = await this.tenantPrisma.tx.ingredient.findUnique({ where: { id } });
    if (!ing) throw new NotFoundException('ingredient_not_found');
    return ing;
  }

  async create(auth: AuthContext, input: CreateIngredientInput) {
    if (input.kind === 'sub_recipe' && !input.batchYield) {
      throw new BadRequestException('sub_recipe_requires_batch_yield');
    }
    if (input.kind === 'raw' && input.batchYield) {
      throw new BadRequestException('raw_ingredient_must_not_have_batch_yield');
    }

    const created = await this.tenantPrisma.tx.ingredient.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        kind: input.kind,
        name: input.name,
        unit: input.unit,
        // sub_recipe começa com costPerUnit=0; será calculado quando alguém
        // definir a receita via RecipesService.
        costPerUnit:
          input.kind === 'sub_recipe'
            ? new Prisma.Decimal(0)
            : new Prisma.Decimal(input.costPerUnit ?? '0'),
        batchYield: input.batchYield ? new Prisma.Decimal(input.batchYield) : null,
        minLevel: input.minLevel ? new Prisma.Decimal(input.minLevel) : null,
        targetDays: input.targetDays ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'ingredient',
      entityId: created.id,
      action: 'create',
      diff: {
        name: created.name,
        kind: created.kind,
        unit: created.unit,
        costPerUnit: created.costPerUnit.toString(),
      },
    });
    return created;
  }

  async update(auth: AuthContext, id: string, input: UpdateIngredientInput) {
    const existing = await this.findOne(auth, id);

    // Em sub_recipe, custo unitário é gerenciado pela engine de receita —
    // ignoramos qualquer costPerUnit vindo do cliente.
    const newCost =
      existing.kind === 'sub_recipe'
        ? undefined
        : input.costPerUnit !== undefined
          ? new Prisma.Decimal(input.costPerUnit)
          : undefined;

    const updated = await this.tenantPrisma.tx.ingredient.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        unit: input.unit ?? undefined,
        costPerUnit: newCost,
        batchYield:
          existing.kind === 'sub_recipe' && input.batchYield !== undefined
            ? new Prisma.Decimal(input.batchYield)
            : undefined,
        minLevel:
          input.minLevel === undefined
            ? undefined
            : input.minLevel === null
              ? null
              : new Prisma.Decimal(input.minLevel),
        targetDays:
          input.targetDays === undefined ? undefined : input.targetDays,
        notes: input.notes ?? undefined,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'ingredient',
      entityId: id,
      action: 'update',
      diff: {
        before: { name: existing.name, costPerUnit: existing.costPerUnit.toString() },
        after: { name: updated.name, costPerUnit: updated.costPerUnit.toString() },
      },
    });

    // Se o custo (raw) mudou, dispara cascata. sub_recipe não chega aqui por
    // ter costPerUnit ignorado acima.
    const costChanged =
      newCost !== undefined && !existing.costPerUnit.equals(updated.costPerUnit);
    if (costChanged) {
      await this.recipeCost.propagateFromIngredient(auth, id);
    }

    return updated;
  }

  async archive(auth: AuthContext, id: string) {
    const existing = await this.findOne(auth, id);

    // Não permite arquivar se o ingrediente é usado em alguma receita ativa.
    const usageCount = await this.tenantPrisma.tx.recipeComponent.count({
      where: { ingredientId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException('ingredient_in_use_by_recipe');
    }

    await this.tenantPrisma.tx.ingredient.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'ingredient',
      entityId: id,
      action: 'delete',
      diff: { archived: true, name: existing.name },
    });
  }
}
