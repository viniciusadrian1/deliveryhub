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

export interface PublishItemResult extends SyncOpResult {
  externalId?: string;
}

export interface PublishAllSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ menuItemId: string; name: string; ok: boolean; error?: string }>;
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
          // Codigo externo real (EAN/SKU) da plataforma — necessario p/ promocoes
          // casarem itens IMPORTADOS via pull (bug #12).
          externalCode: ri.externalCode,
          externalCategoryId: ri.externalCategoryId,
          sellingPriceCents: ri.sellingPriceCents,
          isPublished: ri.isPublished,
          isAvailable: ri.isAvailable,
          lastSyncAt: new Date(),
        },
        update: {
          externalId: ri.externalId,
          externalCode: ri.externalCode,
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
      // Mesmo guard do publishItem: nunca empurra preço <= 0 (item sairia de
      // graça na plataforma). O config pode ter sellingPriceCents=0 e um
      // externalId válido, então o push de preço precisa checar aqui também.
      if (cfg.sellingPriceCents <= 0) {
        throw new BadRequestException('item_has_no_price_for_platform');
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

  /**
   * Publica um item COMPLETO (produto + complementos + imagem) na plataforma
   * — Catalog API. Cria a categoria na plataforma se ainda não existe mapa,
   * sobe a imagem quando houver, e grava externalId/externalCategoryId no
   * config pra que os pushes pontuais (preço/disponibilidade) funcionem.
   */
  async publishItem(
    auth: AuthContext,
    menuItemId: string,
    platformCode: PlatformCode,
  ): Promise<PublishItemResult> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: auth.orgId },
      include: {
        category: true,
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!item) throw new NotFoundException('menu_item_not_found');

    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) throw new NotFoundException('platform_not_found');

    const cfg = await this.prisma.menuItemPlatformConfig.findUnique({
      where: { menuItemId_platformId: { menuItemId, platformId: platform.id } },
    });
    if (!cfg) throw new NotFoundException('platform_config_not_found');
    if (cfg.sellingPriceCents <= 0) {
      throw new BadRequestException('item_has_no_price_for_platform');
    }

    const { connection, adapter, tokens } = await this.resolveConnection(
      auth,
      item.storeId,
      platformCode,
    );
    if (!adapter.pushItem || !adapter.fetchCatalogs) {
      throw new BadRequestException('catalog_publish_unsupported');
    }

    try {
      // 1. Catálogo alvo — contexto DEFAULT (delivery) ou o primeiro.
      const catalogs = await adapter.fetchCatalogs(tokens, connection.externalMerchantId!);
      const catalog = catalogs.find((c) => c.context.includes('DEFAULT')) ?? catalogs[0];
      if (!catalog) throw new BadRequestException('platform_has_no_catalog');

      // 2. Garante a categoria na plataforma.
      let externalCategoryId = cfg.externalCategoryId;
      if (!externalCategoryId) {
        if (!item.categoryId || !item.category) {
          throw new BadRequestException('item_has_no_category');
        }
        // Reusa o mapeamento de outro item da mesma categoria local.
        const sibling = await this.prisma.menuItemPlatformConfig.findFirst({
          where: {
            platformId: platform.id,
            externalCategoryId: { not: null },
            menuItem: { categoryId: item.categoryId },
          },
        });
        externalCategoryId = sibling?.externalCategoryId ?? null;
        if (!externalCategoryId) {
          if (!adapter.pushCategory) {
            throw new BadRequestException('category_publish_unsupported');
          }
          const created = await adapter.pushCategory(
            tokens,
            connection.externalMerchantId!,
            catalog.catalogId,
            { name: item.category.name, sortOrder: item.category.sortOrder },
          );
          externalCategoryId = created.externalId;
          // Persiste JÁ: se o push do item falhar adiante, o retry (ou o
          // próximo item da mesma categoria) reusa esta categoria em vez de
          // criar uma duplicada no iFood a cada tentativa.
          await this.prisma.menuItemPlatformConfig.update({
            where: { id: cfg.id },
            data: { externalCategoryId },
          });
        }
      }

      // 3. Imagem — sobe pro storage da plataforma. Falha aqui não bloqueia
      //    a publicação (item sem foto é válido).
      let imagePath: string | undefined;
      if (item.imageUrl && adapter.uploadImage) {
        try {
          const dataUri = await this.fetchImageAsDataUri(item.imageUrl);
          imagePath = await adapter.uploadImage(
            tokens,
            connection.externalMerchantId!,
            dataUri,
          );
        } catch (err) {
          this.logger.warn({ err, menuItemId, imageUrl: item.imageUrl }, 'publish_image_failed');
        }
      }

      // 4. Push completo.
      const result = await adapter.pushItem(
        tokens,
        connection.externalMerchantId!,
        catalog.catalogId,
        {
          externalId: cfg.externalId ?? undefined,
          externalCategoryId,
          name: item.name,
          description: item.description ?? undefined,
          sellingPriceCents: cfg.sellingPriceCents,
          isAvailable: cfg.isAvailable,
          imagePath,
          externalCode: item.id,
          sortOrder: item.sortOrder,
          modifierGroups: item.modifierGroups.map((g) => ({
            externalId: g.id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            sortOrder: g.sortOrder,
            options: g.modifiers.map((m) => ({
              externalId: m.id,
              name: m.name,
              // ponytail: costDeltaCents é o delta cobrado do cliente; se um
              // dia separarmos custo de preço do complemento, trocar aqui.
              priceCents: Math.max(0, m.costDeltaCents),
              isAvailable: true,
              sortOrder: m.sortOrder,
            })),
          })),
        },
      );

      const syncedAt = new Date();
      await this.prisma.menuItemPlatformConfig.update({
        where: { id: cfg.id },
        data: {
          externalId: result.externalId,
          externalCategoryId: result.externalCategoryId,
          // externalCode = o codigo que enviamos ao publicar (item.id) — e o que a
          // plataforma conhece p/ casar promocoes com este item (bug #12).
          externalCode: item.id,
          lastSyncAt: syncedAt,
          lastSyncError: null,
        },
      });
      return { ok: true, syncedAt, externalId: result.externalId };
    } catch (err) {
      // Erros de validação (categoria faltando etc.) sobem pro cliente;
      // erro da API da plataforma vira lastSyncError sem derrubar a conexão.
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      const message = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error({ err, menuItemId, platformCode }, 'menu_publish_failed');
      await this.prisma.menuItemPlatformConfig.update({
        where: { id: cfg.id },
        data: { lastSyncError: message.slice(0, 500) },
      });
      return { ok: false, syncedAt: new Date(), error: message };
    }
  }

  /**
   * Publica o cardápio inteiro (itens não-arquivados com config marcado
   * como publicado) na plataforma, item a item, sequencial — a Catalog API
   * do iFood não tem bulk e o sequencial evita rate limit.
   */
  async publishAll(
    auth: AuthContext,
    storeId: string,
    platformCode: PlatformCode,
  ): Promise<PublishAllSummary> {
    const items = await this.prisma.menuItem.findMany({
      where: {
        organizationId: auth.orgId,
        storeId,
        archivedAt: null,
        platformConfigs: {
          some: { platform: { code: platformCode }, isPublished: true },
        },
      },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });

    const results: PublishAllSummary['results'] = [];
    for (const it of items) {
      try {
        const r = await this.publishItem(auth, it.id, platformCode);
        results.push({ menuItemId: it.id, name: it.name, ok: r.ok, error: r.error });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown_error';
        results.push({ menuItemId: it.id, name: it.name, ok: false, error: message });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item',
      entityId: storeId,
      action: 'update',
      diff: { publishAll: { platformCode, total: items.length, succeeded } },
    });

    return { total: items.length, succeeded, failed: items.length - succeeded, results };
  }

  // ---------- helpers ----------

  /** Baixa a imagem pública (R2) e converte pra data URI base64. */
  private async fetchImageAsDataUri(imageUrl: string): Promise<string> {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`image_fetch_failed_${res.status}`);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    // iFood recusa >5MB (HTTP 413) — corta aqui com erro claro.
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error('image_too_large_5mb');
    return `data:${contentType};base64,${buf.toString('base64')}`;
  }

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
      // Erros de validação (item sem externalId/preço) sobem pro cliente sem
      // tocar a conexão — igual publishItem faz. Uma falha de push por item
      // NUNCA deve derrubar a PlatformConnection: status='error' pararia o
      // poller de pedidos (orders.poller.ts filtra status:'active'), matando
      // toda a ingestão da loja por causa de um toggle. Status da conexão fica
      // reservado a falhas de auth/refresh; falha real da API vira apenas
      // lastSyncError no config.
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      const message = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error({ err, menuItemId, platformCode }, 'menu_push_failed');
      await this.prisma.menuItemPlatformConfig.update({
        where: { id: cfg.id },
        data: { lastSyncError: message.slice(0, 500) },
      });
      return { ok: false, syncedAt: new Date(), error: message };
    }
  }
}
