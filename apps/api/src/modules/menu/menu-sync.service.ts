import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';

export interface InitialSyncSummary {
  importedCategories: number;
  importedItems: number;
  matchedExistingItems: number;
}

export interface SyncOpResult {
  ok: boolean;
  syncedAt: Date;
  error?: string;
}

@Injectable()
export class MenuSyncService {
  private readonly logger = new Logger(MenuSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly registry: AdapterRegistry,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Sincronização inicial: baixa categorias e itens da plataforma e cria
   * o que ainda não existe localmente. Itens já existentes (por nome) recebem
   * apenas o `externalId`/`externalCategoryId` no `menu_item_platform_config`,
   * preservando CMV e demais dados locais.
   */
  async pullInitial(
    auth: AuthContext,
    storeId: string,
    platformCode: PlatformCode,
  ): Promise<InitialSyncSummary> {
    const { connection, adapter, tokens } = await this.resolveConnection(
      auth,
      storeId,
      platformCode,
    );

    const remote = await adapter.fetchMenu(tokens, connection.externalMerchantId!);

    let importedCategories = 0;
    const categoryMap = new Map<string, string>(); // externalCategoryId → localCategoryId

    for (const rc of remote.categories) {
      const existing = await this.prisma.category.findFirst({
        where: { organizationId: auth.orgId, storeId, name: rc.name },
      });
      if (existing) {
        categoryMap.set(rc.externalId, existing.id);
      } else {
        const created = await this.prisma.category.create({
          data: {
            organizationId: auth.orgId,
            storeId,
            name: rc.name,
            sortOrder: rc.sortOrder ?? 0,
          },
        });
        categoryMap.set(rc.externalId, created.id);
        importedCategories++;
      }
    }

    let importedItems = 0;
    let matchedExistingItems = 0;

    for (const ri of remote.items) {
      const localCategoryId = ri.externalCategoryId
        ? categoryMap.get(ri.externalCategoryId)
        : null;

      const existing = await this.prisma.menuItem.findFirst({
        where: { organizationId: auth.orgId, storeId, name: ri.name },
      });

      const itemId = existing
        ? existing.id
        : (
            await this.prisma.menuItem.create({
              data: {
                organizationId: auth.orgId,
                storeId,
                categoryId: localCategoryId ?? null,
                name: ri.name,
                description: ri.description ?? null,
                imageUrl: ri.imageUrl ?? null,
                costCents: 0, // CMV é dado da loja, não da plataforma
              },
            })
          ).id;

      if (existing) matchedExistingItems++;
      else importedItems++;

      // Vincula o config por plataforma com externalId.
      await this.prisma.menuItemPlatformConfig.upsert({
        where: {
          menuItemId_platformId: { menuItemId: itemId, platformId: connection.platformId },
        },
        create: {
          organizationId: auth.orgId,
          menuItemId: itemId,
          platformId: connection.platformId,
          externalId: ri.externalId,
          externalCategoryId: ri.externalCategoryId,
          sellingPriceCents: ri.sellingPriceCents,
          isPublished: ri.isPublished,
          isAvailable: ri.isAvailable,
          lastSyncAt: new Date(),
        },
        update: {
          externalId: ri.externalId,
          externalCategoryId: ri.externalCategoryId,
          sellingPriceCents: ri.sellingPriceCents,
          isAvailable: ri.isAvailable,
          isPublished: ri.isPublished,
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });
    }

    await this.prisma.platformConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'platform_connection',
      entityId: connection.id,
      action: 'update',
      diff: {
        initialSync: { importedCategories, importedItems, matchedExistingItems },
      },
    });

    return { importedCategories, importedItems, matchedExistingItems };
  }

  async pushItemPrice(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
  ): Promise<SyncOpResult> {
    return this.runItemOp(auth, menuItemId, platformCode, async (adapter, tokens, conn, cfg) => {
      if (!cfg.externalId) {
        throw new BadRequestException('item_not_yet_synced_with_platform');
      }
      await adapter.pushItemPrice(
        tokens,
        conn.externalMerchantId!,
        cfg.externalId,
        cfg.sellingPriceCents,
      );
    });
  }

  async pushItemAvailability(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
  ): Promise<SyncOpResult> {
    return this.runItemOp(auth, menuItemId, platformCode, async (adapter, tokens, conn, cfg) => {
      if (!cfg.externalId) {
        throw new BadRequestException('item_not_yet_synced_with_platform');
      }
      await adapter.pushItemAvailability(
        tokens,
        conn.externalMerchantId!,
        cfg.externalId,
        cfg.isAvailable,
      );
    });
  }

  // ---------- helpers ----------

  private async resolveConnection(
    auth: AuthContext,
    storeId: string,
    platformCode: PlatformCode,
  ) {
    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const connection = await this.prisma.platformConnection.findFirst({
      where: { organizationId: auth.orgId, storeId, platformId: platform.id },
    });
    if (!connection) throw new NotFoundException('platform_connection_not_found');
    if (connection.status !== 'active') {
      throw new BadRequestException('connection_not_active');
    }
    if (!connection.externalMerchantId) {
      throw new BadRequestException('connection_missing_merchant_id');
    }

    const tokens = await this.integrations.getTokens(connection.id);
    if (!tokens) throw new BadRequestException('connection_tokens_missing');

    const adapter = this.registry.get(platformCode);
    return { connection, adapter, tokens };
  }

  private async runItemOp(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
    op: (
      adapter: ReturnType<AdapterRegistry['get']>,
      tokens: NonNullable<Awaited<ReturnType<IntegrationsService['getTokens']>>>,
      conn: NonNullable<Awaited<ReturnType<PrismaService['platformConnection']['findFirst']>>>,
      cfg: NonNullable<
        Awaited<ReturnType<PrismaService['menuItemPlatformConfig']['findUnique']>>
      >,
    ) => Promise<void>,
  ): Promise<SyncOpResult> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: auth.orgId },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');

    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const cfg = await this.prisma.menuItemPlatformConfig.findUnique({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
    });
    if (!cfg) throw new NotFoundException('platform_config_not_found');

    const { connection, adapter, tokens } = await this.resolveConnection(
      auth,
      item.storeId,
      platformCode,
    );

    try {
      await op(adapter, tokens, connection, cfg);
      const syncedAt = new Date();
      await this.prisma.menuItemPlatformConfig.update({
        where: { id: cfg.id },
        data: { lastSyncAt: syncedAt, lastSyncError: null },
      });
      return { ok: true, syncedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error({ err, menuItemId, platformCode }, 'menu_push_failed');
      await this.prisma.menuItemPlatformConfig.update({
        where: { id: cfg.id },
        data: { lastSyncError: message.slice(0, 500) },
      });
      await this.prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: message.slice(0, 500),
          status: 'error',
        },
      });
      return { ok: false, syncedAt: new Date(), error: message };
    }
  }
}
