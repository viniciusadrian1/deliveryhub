import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type {
  CreateModifierGroupInput,
  CreateModifierInput,
  UpdateModifierGroupInput,
  UpdateModifierInput,
} from './dto/modifier.dto.js';

@Injectable()
export class ModifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ========== Modifier groups ==========

  async listGroups(auth: AuthContext, menuItemId: string) {
    await this.assertMenuItem(auth.orgId, menuItemId);
    return this.prisma.modifierGroup.findMany({
      where: { organizationId: auth.orgId, menuItemId },
      orderBy: { sortOrder: 'asc' },
      include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createGroup(auth: AuthContext, input: CreateModifierGroupInput) {
    await this.assertMenuItem(auth.orgId, input.menuItemId);

    const created = await this.prisma.modifierGroup.create({
      data: {
        organizationId: auth.orgId,
        menuItemId: input.menuItemId,
        kind: input.kind,
        name: input.name,
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        required: input.required,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier_group',
      entityId: created.id,
      action: 'create',
      diff: { name: created.name, menuItemId: input.menuItemId },
    });

    return created;
  }

  async updateGroup(auth: AuthContext, id: string, input: UpdateModifierGroupInput) {
    const existing = await this.findGroupOrThrow(auth.orgId, id);
    // O refine do Zod só valida min<=max quando os DOIS campos vêm no payload.
    // Num PATCH parcial (só min ou só max) o outro lado sai do banco, então
    // cruzamos com o valor existente pra nunca persistir minSelect > maxSelect
    // (grupo contraditório vai parar no iFood via publishItem).
    const minSelect = input.minSelect ?? existing.minSelect;
    const maxSelect = input.maxSelect ?? existing.maxSelect;
    if (minSelect > maxSelect) {
      throw new BadRequestException('minSelect must be ≤ maxSelect');
    }
    const updated = await this.prisma.modifierGroup.update({
      where: { id },
      data: {
        kind: input.kind ?? undefined,
        name: input.name ?? undefined,
        minSelect,
        maxSelect,
        required: input.required ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier_group',
      entityId: id,
      action: 'update',
      diff: { before: existing, after: updated },
    });
    return updated;
  }

  async removeGroup(auth: AuthContext, id: string): Promise<void> {
    await this.findGroupOrThrow(auth.orgId, id);
    await this.prisma.modifierGroup.delete({ where: { id } });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier_group',
      entityId: id,
      action: 'delete',
    });
  }

  // ========== Modifiers ==========

  async createModifier(auth: AuthContext, input: CreateModifierInput) {
    await this.findGroupOrThrow(auth.orgId, input.modifierGroupId);
    // O FK linkedMenuItem aponta pra MenuItem global; sem checar a org o
    // modifier poderia linkar (e dar baixa de estoque pela receita de) um item
    // de outro tenant. Valida a posse antes de gravar.
    if (input.linkedMenuItemId) {
      await this.assertMenuItem(auth.orgId, input.linkedMenuItemId);
    }

    const created = await this.prisma.modifier.create({
      data: {
        organizationId: auth.orgId,
        modifierGroupId: input.modifierGroupId,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        costDeltaCents: input.costDeltaCents,
        linkedMenuItemId: input.linkedMenuItemId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier',
      entityId: created.id,
      action: 'create',
      diff: {
        name: created.name,
        modifierGroupId: input.modifierGroupId,
        costDeltaCents: created.costDeltaCents,
      },
    });

    return created;
  }

  async updateModifier(auth: AuthContext, id: string, input: UpdateModifierInput) {
    const existing = await this.findModifierOrThrow(auth.orgId, id);
    // Mesma checagem cross-tenant do create; `undefined` = "sem alteração",
    // então só validamos quando um id concreto é enviado.
    if (input.linkedMenuItemId) {
      await this.assertMenuItem(auth.orgId, input.linkedMenuItemId);
    }
    const updated = await this.prisma.modifier.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl,
        costDeltaCents: input.costDeltaCents ?? undefined,
        linkedMenuItemId:
          input.linkedMenuItemId === undefined ? undefined : input.linkedMenuItemId,
        sortOrder: input.sortOrder ?? undefined,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier',
      entityId: id,
      action: 'update',
      diff: { before: existing, after: updated },
    });
    return updated;
  }

  async removeModifier(auth: AuthContext, id: string): Promise<void> {
    await this.findModifierOrThrow(auth.orgId, id);
    await this.prisma.modifier.delete({ where: { id } });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'modifier',
      entityId: id,
      action: 'delete',
    });
  }

  // ========== helpers ==========

  private async assertMenuItem(orgId: string, menuItemId: string): Promise<void> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: orgId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
  }

  private async findGroupOrThrow(orgId: string, id: string) {
    const g = await this.prisma.modifierGroup.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!g) throw new NotFoundException('modifier_group_not_found');
    return g;
  }

  private async findModifierOrThrow(orgId: string, id: string) {
    const m = await this.prisma.modifier.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!m) throw new NotFoundException('modifier_not_found');
    return m;
  }
}
