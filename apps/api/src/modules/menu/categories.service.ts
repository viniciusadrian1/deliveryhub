import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './dto/category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(auth: AuthContext, storeId: string) {
    await this.assertStoreInOrg(auth.orgId, storeId);
    return this.prisma.category.findMany({
      where: { organizationId: auth.orgId, storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(auth: AuthContext, input: CreateCategoryInput) {
    await this.assertStoreInOrg(auth.orgId, input.storeId);

    // organizationId é passado explicitamente; TenantPrismaService atua
    // como rede de segurança em runtime.
    const created = await this.prisma.category.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'category',
      entityId: created.id,
      action: 'create',
      diff: { name: created.name, storeId: input.storeId },
    });

    return created;
  }

  async update(auth: AuthContext, id: string, input: UpdateCategoryInput) {
    const existing = await this.findOneOrThrow(auth, id);

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        sortOrder: input.sortOrder ?? undefined,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'category',
      entityId: id,
      action: 'update',
      diff: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.findOneOrThrow(auth, id);

    await this.prisma.category.delete({ where: { id } });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'category',
      entityId: id,
      action: 'delete',
    });
  }

  async reorder(auth: AuthContext, storeId: string, order: string[]): Promise<void> {
    await this.assertStoreInOrg(auth.orgId, storeId);

    const owned = await this.prisma.category.findMany({
      where: { id: { in: order }, organizationId: auth.orgId, storeId },
      select: { id: true },
    });
    if (owned.length !== order.length) {
      throw new NotFoundException('some_categories_not_found_in_store');
    }

    await this.prisma.$transaction(
      order.map((id, idx) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder: idx } }),
      ),
    );

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'category',
      action: 'update',
      diff: { reorder: order, storeId },
    });
  }

  private async findOneOrThrow(auth: AuthContext, id: string) {
    const c = await this.prisma.category.findFirst({
      where: { id, organizationId: auth.orgId },
    });
    if (!c) throw new NotFoundException('category_not_found');
    return c;
  }

  private async assertStoreInOrg(orgId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('store_not_found');
  }
}
