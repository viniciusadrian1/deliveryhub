import { Injectable, NotFoundException } from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { UpsertPlatformConfigInput } from './dto/menu-platform-config.dto.js';

@Injectable()
export class MenuPlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listForItem(auth: AuthContext, menuItemId: string) {
    await this.assertMenuItem(auth.orgId, menuItemId);
    return this.prisma.menuItemPlatformConfig.findMany({
      where: { organizationId: auth.orgId, menuItemId },
      include: { platform: { select: { code: true, name: true, colorHex: true } } },
      orderBy: { platform: { code: 'asc' } },
    });
  }

  async upsert(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
    input: UpsertPlatformConfigInput,
  ) {
    await this.assertMenuItem(auth.orgId, menuItemId);
    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const existing = await this.prisma.menuItemPlatformConfig.findUnique({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
    });

    const updated = await this.prisma.menuItemPlatformConfig.upsert({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
      create: {
        organizationId: auth.orgId,
        menuItemId,
        platformId: platform.id,
        sellingPriceCents: input.sellingPriceCents ?? 0,
        isPublished: input.isPublished ?? true,
        isAvailable: input.isAvailable ?? true,
        externalId: input.externalId ?? null,
        externalCategoryId: input.externalCategoryId ?? null,
      },
      update: {
        sellingPriceCents: input.sellingPriceCents ?? undefined,
        isPublished: input.isPublished ?? undefined,
        isAvailable: input.isAvailable ?? undefined,
        externalId: input.externalId === undefined ? undefined : input.externalId,
        externalCategoryId:
          input.externalCategoryId === undefined ? undefined : input.externalCategoryId,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item_platform_config',
      entityId: updated.id,
      action: existing ? 'update' : 'create',
      diff: existing ? { before: existing, after: updated } : { created: updated },
    });

    return updated;
  }

  async remove(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
  ): Promise<void> {
    await this.assertMenuItem(auth.orgId, menuItemId);
    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const existing = await this.prisma.menuItemPlatformConfig.findUnique({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
    });
    if (!existing) throw new NotFoundException('platform_config_not_found');

    await this.prisma.menuItemPlatformConfig.delete({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item_platform_config',
      entityId: existing.id,
      action: 'delete',
    });
  }

  private async assertMenuItem(orgId: string, id: string): Promise<void> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');
  }
}
