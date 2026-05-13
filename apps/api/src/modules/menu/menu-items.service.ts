import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type {
  CreateMenuItemInput,
  ListMenuItemsQuery,
  UpdateMenuItemInput,
} from './dto/menu-item.dto.js';

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(auth: AuthContext, query: ListMenuItemsQuery) {
    await this.assertStoreInOrg(auth.orgId, query.storeId);
    return this.prisma.menuItem.findMany({
      where: {
        organizationId: auth.orgId,
        storeId: query.storeId,
        categoryId: query.categoryId ?? undefined,
        archivedAt: query.archived === true ? { not: null } : null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: auth.orgId },
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
    return item;
  }

  async create(auth: AuthContext, input: CreateMenuItemInput) {
    await this.assertStoreInOrg(auth.orgId, input.storeId);
    if (input.categoryId) {
      await this.assertCategoryInStore(auth.orgId, input.storeId, input.categoryId);
    }

    const created = await this.prisma.menuItem.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        prepTimeMinutes: input.prepTimeMinutes ?? null,
        costCents: input.costCents ?? 0,
        allergens: input.allergens ?? [],
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: created.id,
      action: 'create',
      diff: { name: created.name, storeId: input.storeId, costCents: created.costCents },
    });

    return created;
  }

  async update(auth: AuthContext, id: string, input: UpdateMenuItemInput) {
    const existing = await this.findOneOrThrow(auth, id);

    if (input.categoryId) {
      await this.assertCategoryInStore(auth.orgId, existing.storeId, input.categoryId);
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: input.categoryId === undefined ? undefined : input.categoryId,
        name: input.name ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl,
        prepTimeMinutes:
          input.prepTimeMinutes === undefined ? undefined : input.prepTimeMinutes,
        costCents: input.costCents ?? undefined,
        allergens: input.allergens ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: id,
      action: 'update',
      diff: this.diff(existing, updated),
    });

    return updated;
  }

  async archive(auth: AuthContext, id: string) {
    const existing = await this.findOneOrThrow(auth, id);
    if (existing.archivedAt) throw new BadRequestException('already_archived');

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: id,
      action: 'update',
      diff: { archivedAt: updated.archivedAt },
    });

    return updated;
  }

  async unarchive(auth: AuthContext, id: string) {
    const existing = await this.findOneOrThrow(auth, id);
    if (!existing.archivedAt) throw new BadRequestException('not_archived');

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { archivedAt: null },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: id,
      action: 'update',
      diff: { archivedAt: null },
    });

    return updated;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.findOneOrThrow(auth, id);
    await this.prisma.menuItem.delete({ where: { id } });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: id,
      action: 'delete',
    });
  }

  private async findOneOrThrow(auth: AuthContext, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: auth.orgId },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
    return item;
  }

  private async assertStoreInOrg(orgId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('store_not_found');
  }

  private async assertCategoryInStore(
    orgId: string,
    storeId: string,
    categoryId: string,
  ): Promise<void> {
    const c = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId: orgId, storeId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('category_not_found_in_store');
  }

  private diff<T extends Record<string, unknown>>(
    before: T,
    after: T,
  ): Record<string, { before: unknown; after: unknown }> {
    const out: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(after)) {
      if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) {
        out[key] = { before: before[key], after: after[key] };
      }
    }
    return out;
  }
}
