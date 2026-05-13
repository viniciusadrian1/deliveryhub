import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { PlatformAdapter, StoredTokens } from '@deliveryhub/ifood';
import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreatePauseInput, ListPausesQuery } from './dto/pauses.dto.js';

interface SessionContext {
  userAgent?: string;
  ip?: string;
}

interface ResolvedConnection {
  connectionId: string;
  platformCode: PlatformCode;
  externalMerchantId: string;
  adapter: PlatformAdapter;
  tokens: StoredTokens;
}

@Injectable()
export class PausesService {
  private readonly logger = new Logger(PausesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly integrations: IntegrationsService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  // ========= Leitura =========

  async listActive(auth: AuthContext, storeId: string) {
    const now = new Date();
    return this.prisma.pause.findMany({
      where: {
        organizationId: auth.orgId,
        storeId,
        startsAt: { lte: now },
        cancelledAt: null,
        reopenedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        menuItem: { select: { id: true, name: true } },
      },
    });
  }

  async list(auth: AuthContext, query: ListPausesQuery) {
    if (query.status === 'active') {
      return this.listActive(auth, query.storeId);
    }
    return this.prisma.pause.findMany({
      where: { organizationId: auth.orgId, storeId: query.storeId },
      orderBy: { startsAt: 'desc' },
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      include: {
        category: { select: { id: true, name: true } },
        menuItem: { select: { id: true, name: true } },
      },
    });
  }

  // ========= Escrita =========

  async create(auth: AuthContext, input: CreatePauseInput, session: SessionContext = {}) {
    await this.assertStore(auth.orgId, input.storeId);
    if (input.scope === 'category' && input.categoryId) {
      await this.assertCategoryInStore(auth.orgId, input.storeId, input.categoryId);
    }
    if (input.scope === 'item' && input.menuItemId) {
      await this.assertMenuItemInStore(auth.orgId, input.storeId, input.menuItemId);
    }

    const startsAt = new Date();
    const endsAt = input.durationMinutes
      ? new Date(startsAt.getTime() + input.durationMinutes * 60_000)
      : (input.endsAt ?? null);

    // Resolve plataformas conectadas. Se platformCodes não veio, aplica em todas as ativas.
    const connections = await this.resolveTargetConnections(
      auth.orgId,
      input.storeId,
      input.platformCodes,
    );

    const platformIds = connections.map((c) => c.platformId);

    const pause = await this.prisma.pause.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        scope: input.scope,
        categoryId: input.scope === 'category' ? input.categoryId! : null,
        menuItemId: input.scope === 'item' ? input.menuItemId! : null,
        platformIds,
        startsAt,
        endsAt,
        reason: input.reason,
        reasonNote: input.reasonNote ?? null,
        createdByUserId: auth.userId,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'pause',
      entityId: pause.id,
      action: 'pause',
      diff: {
        scope: input.scope,
        platforms: connections.map((c) => c.platformCode),
        endsAt,
        reason: input.reason,
      },
      ip: session.ip,
      userAgent: session.userAgent,
    });

    const errors = await this.propagate(pause.id, connections, /* paused */ true, endsAt, input.reason);

    if (errors.length === 0) {
      await this.prisma.pause.update({
        where: { id: pause.id },
        data: { appliedAt: new Date() },
      });
    } else {
      await this.prisma.pause.update({
        where: { id: pause.id },
        data: { errorMessage: errors.join('; ').slice(0, 500) },
      });
      // Notifica owners/managers sobre falha parcial.
      await this.notifyManagersOfError(auth.orgId, pause.id, errors);
    }

    return this.findOneOrThrow(auth, pause.id);
  }

  async cancel(auth: AuthContext, id: string, session: SessionContext = {}) {
    const existing = await this.findOneOrThrow(auth, id);
    if (existing.cancelledAt || existing.reopenedAt) {
      throw new BadRequestException('pause_already_closed');
    }

    const connections = await this.resolveConnectionsByPlatformIds(
      auth.orgId,
      existing.storeId,
      existing.platformIds,
    );

    const updated = await this.prisma.pause.update({
      where: { id },
      data: { cancelledAt: new Date(), cancelledByUserId: auth.userId },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'pause',
      entityId: id,
      action: 'resume',
      ip: session.ip,
      userAgent: session.userAgent,
    });

    await this.propagate(id, connections, /* paused */ false);

    return updated;
  }

  /**
   * Cron — chamado pelo `PausesScheduler` a cada minuto.
   * Reabre pausas vencidas (ends_at <= now) que ainda não foram canceladas
   * nem reabertas, propagando "resume" às plataformas.
   */
  async reopenExpired(): Promise<{ reopened: number; errors: number }> {
    const now = new Date();
    const expired = await this.prisma.pause.findMany({
      where: {
        cancelledAt: null,
        reopenedAt: null,
        endsAt: { not: null, lte: now },
      },
      take: 100, // batch limit por execução
    });

    let reopened = 0;
    let errors = 0;

    for (const p of expired) {
      try {
        const connections = await this.resolveConnectionsByPlatformIds(
          p.organizationId,
          p.storeId,
          p.platformIds,
        );
        await this.propagate(p.id, connections, false);
        await this.prisma.pause.update({
          where: { id: p.id },
          data: { reopenedAt: now },
        });
        await this.audit.record({
          organizationId: p.organizationId,
          entity: 'pause',
          entityId: p.id,
          action: 'resume',
          diff: { auto: true },
        });
        reopened++;
      } catch (err) {
        errors++;
        this.logger.error({ err, pauseId: p.id }, 'auto_reopen_failed');
      }
    }

    return { reopened, errors };
  }

  // ========= Helpers =========

  private async findOneOrThrow(auth: AuthContext, id: string) {
    const p = await this.prisma.pause.findFirst({
      where: { id, organizationId: auth.orgId },
      include: {
        category: { select: { id: true, name: true } },
        menuItem: { select: { id: true, name: true } },
      },
    });
    if (!p) throw new NotFoundException('pause_not_found');
    return p;
  }

  private async assertStore(orgId: string, storeId: string): Promise<void> {
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

  private async assertMenuItemInStore(
    orgId: string,
    storeId: string,
    menuItemId: string,
  ): Promise<void> {
    const m = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: orgId, storeId },
      select: { id: true },
    });
    if (!m) throw new NotFoundException('menu_item_not_found_in_store');
  }

  private async resolveTargetConnections(
    orgId: string,
    storeId: string,
    platformCodes?: PlatformCode[],
  ): Promise<Array<ResolvedConnection & { platformId: string }>> {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      storeId,
      status: 'active',
    };
    if (platformCodes && platformCodes.length > 0) {
      where.platform = { code: { in: platformCodes } };
    }

    const connections = await this.prisma.platformConnection.findMany({
      where,
      include: { platform: true },
    });

    if (connections.length === 0) {
      throw new BadRequestException('no_active_connections');
    }

    const resolved: Array<ResolvedConnection & { platformId: string }> = [];
    for (const c of connections) {
      const tokens = await this.integrations.getTokens(c.id);
      if (!tokens) continue;
      if (!c.externalMerchantId) continue;
      resolved.push({
        connectionId: c.id,
        platformId: c.platformId,
        platformCode: c.platform.code as PlatformCode,
        externalMerchantId: c.externalMerchantId,
        adapter: this.registry.get(c.platform.code as PlatformCode),
        tokens,
      });
    }
    return resolved;
  }

  private async resolveConnectionsByPlatformIds(
    orgId: string,
    storeId: string,
    platformIds: string[],
  ): Promise<ResolvedConnection[]> {
    if (platformIds.length === 0) return [];
    const connections = await this.prisma.platformConnection.findMany({
      where: {
        organizationId: orgId,
        storeId,
        platformId: { in: platformIds },
        status: 'active',
      },
      include: { platform: true },
    });

    const resolved: ResolvedConnection[] = [];
    for (const c of connections) {
      if (!c.externalMerchantId) continue;
      const tokens = await this.integrations.getTokens(c.id);
      if (!tokens) continue;
      resolved.push({
        connectionId: c.id,
        platformCode: c.platform.code as PlatformCode,
        externalMerchantId: c.externalMerchantId,
        adapter: this.registry.get(c.platform.code as PlatformCode),
        tokens,
      });
    }
    return resolved;
  }

  /**
   * Propagação síncrona — escolhe a operação certa por escopo:
   * - store: adapter.pushStorePause
   * - category: adapter.pushItemAvailability para cada item da categoria
   * - item: adapter.pushItemAvailability para o item específico
   */
  private async propagate(
    pauseId: string,
    connections: ResolvedConnection[],
    paused: boolean,
    until?: Date | null,
    reason?: string,
  ): Promise<string[]> {
    if (connections.length === 0) return [];

    const pause = await this.prisma.pause.findUnique({
      where: { id: pauseId },
      include: {
        category: { include: { menuItems: { include: { platformConfigs: true } } } },
        menuItem: { include: { platformConfigs: true } },
      },
    });
    if (!pause) return ['pause_disappeared'];

    const errors: string[] = [];
    for (const conn of connections) {
      try {
        if (pause.scope === 'store') {
          await conn.adapter.pushStorePause(
            conn.tokens,
            conn.externalMerchantId,
            paused,
            until ?? undefined,
            reason,
          );
        } else if (pause.scope === 'category' && pause.category) {
          for (const item of pause.category.menuItems) {
            const cfg = item.platformConfigs.find((c) => c.platformId === conn.connectionId);
            // Procura externalId da config dessa plataforma.
            const externalId = item.platformConfigs.find(
              (c) => c.externalId && c.platformId === conn.connectionId,
            )?.externalId;
            const ext = cfg?.externalId ?? externalId;
            if (!ext) continue;
            await conn.adapter.pushItemAvailability(
              conn.tokens,
              conn.externalMerchantId,
              ext,
              /* available */ !paused,
            );
          }
        } else if (pause.scope === 'item' && pause.menuItem) {
          const ext = pause.menuItem.platformConfigs.find(
            (c) => c.externalId,
          )?.externalId;
          if (!ext) continue;
          await conn.adapter.pushItemAvailability(
            conn.tokens,
            conn.externalMerchantId,
            ext,
            !paused,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        errors.push(`${conn.platformCode}:${message.slice(0, 100)}`);
        this.logger.error({ err, pauseId, platform: conn.platformCode }, 'pause_push_failed');
      }
    }
    return errors;
  }

  private async notifyManagersOfError(
    orgId: string,
    pauseId: string,
    errors: string[],
  ): Promise<void> {
    const targets = await this.prisma.membership.findMany({
      where: { organizationId: orgId, role: { in: ['owner', 'manager'] } },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const t of targets) {
      await this.notifications.create({
        userId: t.userId,
        organizationId: orgId,
        kind: 'integration_error',
        title: 'Falha ao propagar pausa',
        body: `Pausa ${pauseId.slice(0, 8)} aplicada localmente mas teve erro em: ${errors.join(', ')}`,
        linkUrl: '/pause',
        email: t.user.email,
      });
    }
  }
}
