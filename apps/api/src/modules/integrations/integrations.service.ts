import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AdapterApiError, ConnectionPendingError, type StoredTokens } from '@deliveryhub/ifood';
import { KeetaAdapter } from '@deliveryhub/keeta';
import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import { VaultService } from '../../common/vault/vault.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AdapterRegistry } from './adapter.registry.js';

interface SessionContext {
  userAgent?: string;
  ip?: string;
}

export interface StartConnectionResponse {
  connectionId: string;
  platformCode: PlatformCode;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresAt: Date;
  isMock: boolean;
}

const PENDING_VAULT_PREFIX = 'pending';
const ACTIVE_VAULT_PREFIX = 'platform-tokens';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly vault: VaultService,
    private readonly registry: AdapterRegistry,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async listConnections(auth: AuthContext): Promise<
    {
      id: string;
      platformCode: PlatformCode;
      platformName: string;
      storeId: string;
      status: string;
      externalMerchantId: string | null;
      lastSyncAt: Date | null;
      lastErrorAt: Date | null;
      lastErrorMessage: string | null;
    }[]
  > {
    const conns = await this.tenantPrisma.tx.platformConnection.findMany({
      where: { organizationId: auth.orgId },
      include: { platform: true },
      orderBy: { createdAt: 'desc' },
    });
    return conns.map((c) => ({
      id: c.id,
      platformCode: c.platform.code as PlatformCode,
      platformName: c.platform.name,
      storeId: c.storeId,
      status: c.status,
      externalMerchantId: c.externalMerchantId,
      lastSyncAt: c.lastSyncAt,
      lastErrorAt: c.lastErrorAt,
      lastErrorMessage: c.lastErrorMessage,
    }));
  }

  async startConnection(
    auth: AuthContext,
    platformCode: PlatformCode,
    storeId: string,
    session: SessionContext = {},
  ): Promise<StartConnectionResponse> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: auth.orgId },
    });
    if (!store) throw new NotFoundException('store_not_found');

    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform || !platform.active) {
      throw new BadRequestException('platform_not_available');
    }

    const adapter = this.registry.get(platformCode);
    const started = await adapter.startConnection();

    // Cria ou atualiza connection em status `pending`. Se já havia uma ativa, ela permanece —
    // só ativaremos a nova em finalize. Aqui usamos UPSERT por (store_id, platform_id).
    const connection = await this.prisma.platformConnection.upsert({
      where: { storeId_platformId: { storeId, platformId: platform.id } },
      update: {
        status: 'pending',
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      create: {
        organizationId: auth.orgId,
        storeId,
        platformId: platform.id,
        status: 'pending',
      },
    });

    await this.vault.write(
      `${PENDING_VAULT_PREFIX}:${connection.id}`,
      { pendingHandle: started.pendingHandle, expiresAt: started.expiresAt.toISOString() },
      { kind: 'pending_handle', platform: platformCode },
    );

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'platform_connection',
      entityId: connection.id,
      action: 'create',
      diff: { platform: platformCode, storeId, status: 'pending' },
      ip: session.ip,
      userAgent: session.userAgent,
    });

    return {
      connectionId: connection.id,
      platformCode,
      userCode: started.userCode,
      verificationUrl: started.verificationUrl,
      verificationUrlComplete: started.verificationUrlComplete,
      expiresAt: started.expiresAt,
      isMock: this.registry.isMock(platformCode),
    };
  }

  async finalizeConnection(
    auth: AuthContext,
    connectionId: string,
    authorizationCode?: string,
    session: SessionContext = {},
  ): Promise<{ status: string; externalMerchantId: string | null }> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!conn) throw new NotFoundException('connection_not_found');
    if (conn.status === 'active') {
      return { status: conn.status, externalMerchantId: conn.externalMerchantId };
    }

    const pending = await this.vault.read<{ pendingHandle: string }>(
      `${PENDING_VAULT_PREFIX}:${conn.id}`,
    );
    if (!pending) throw new BadRequestException('pending_handle_missing');

    const adapter = this.registry.get(conn.platform.code as PlatformCode);

    try {
      const result = await adapter.finalizeConnection(pending.pendingHandle, authorizationCode);

      await this.vault.write(
        `${ACTIVE_VAULT_PREFIX}:${conn.id}`,
        {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.expiresAt.toISOString(),
        },
        { kind: 'platform_tokens', platform: conn.platform.code },
      );
      await this.vault.delete(`${PENDING_VAULT_PREFIX}:${conn.id}`);

      const updated = await this.prisma.platformConnection.update({
        where: { id: conn.id },
        data: {
          status: 'active',
          vaultRef: `${ACTIVE_VAULT_PREFIX}:${conn.id}`,
          externalMerchantId: result.externalMerchantId,
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await this.audit.record({
        organizationId: auth.orgId,
        userId: auth.userId,
        entity: 'platform_connection',
        entityId: conn.id,
        action: 'update',
        diff: { status: 'active', externalMerchantId: result.externalMerchantId },
        ip: session.ip,
        userAgent: session.userAgent,
      });

      return { status: updated.status, externalMerchantId: updated.externalMerchantId };
    } catch (err) {
      // ---- Erros RECUPERÁVEIS pelo usuário: 400 com mensagem clara, SEM
      // marcar a conexão como erro nem notificar managers (não é falha de
      // sistema, é o usuário refazer/completar a autorização). ----
      if (err instanceof ConnectionPendingError) {
        throw new BadRequestException('connection_still_pending');
      }
      if (err instanceof AdapterApiError && err.message.includes('authorization_code_required')) {
        throw new BadRequestException('authorization_code_required');
      }
      // 400/401 do /oauth/token = código inválido/expirado ou ainda não
      // autorizado. Recuperável: usuário confere o código e tenta de novo.
      if (err instanceof AdapterApiError && (err.status === 400 || err.status === 401)) {
        throw new BadRequestException('authorization_invalid_or_expired');
      }

      // ---- Erro inesperado (rede, 5xx da plataforma): aí sim marca e notifica. ----
      const message = err instanceof Error ? err.message : 'unknown_error';
      await this.prisma.platformConnection.update({
        where: { id: conn.id },
        data: {
          status: 'error',
          lastErrorAt: new Date(),
          lastErrorMessage: message.slice(0, 500),
        },
      });
      this.logger.error({ err, connectionId: conn.id }, 'finalize_failed');
      await this.notifyOrgManagers(auth.orgId, {
        kind: 'integration_error',
        title: `Falha ao conectar ${conn.platform.name}`,
        body: message.slice(0, 240),
        linkUrl: '/integrations',
      });

      // Nunca re-lança o erro cru (vira 500) — devolve BadGateway com mensagem.
      throw new BadRequestException(message.slice(0, 200));
    }
  }

  private async notifyOrgManagers(
    organizationId: string,
    payload: {
      kind: 'integration_error' | 'platform_disconnected';
      title: string;
      body: string;
      linkUrl?: string;
    },
  ): Promise<void> {
    const targets = await this.prisma.membership.findMany({
      where: { organizationId, role: { in: ['owner', 'manager'] } },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const t of targets) {
      await this.notifications.create({
        userId: t.userId,
        organizationId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        email: t.user.email,
      });
    }
  }

  async disconnect(
    auth: AuthContext,
    connectionId: string,
    session: SessionContext = {},
  ): Promise<void> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, organizationId: auth.orgId },
    });
    if (!conn) throw new NotFoundException('connection_not_found');

    await this.vault.delete(`${ACTIVE_VAULT_PREFIX}:${conn.id}`);
    await this.vault.delete(`${PENDING_VAULT_PREFIX}:${conn.id}`);

    await this.prisma.platformConnection.update({
      where: { id: conn.id },
      data: {
        status: 'revoked',
        vaultRef: null,
        externalMerchantId: null,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'platform_connection',
      entityId: conn.id,
      action: 'delete',
      ip: session.ip,
      userAgent: session.userAgent,
    });

    await this.notifyOrgManagers(auth.orgId, {
      kind: 'platform_disconnected',
      title: 'Plataforma desconectada',
      body: `A integração foi revogada. Você não receberá pedidos por este canal até reconectar.`,
      linkUrl: '/integrations',
    });
  }

  /**
   * Webhook Event 1 do Keeta (Standard): a loja autorizou e a Keeta mandou um
   * `code`. Trocamos o code por tokens PER-MERCHANT (90d), listamos as lojas
   * (base/authorized/resource/get) e ATIVAMOS a(s) conexão(ões) Keeta.
   *
   * Correlação: o webhook é a nível de APP (não traz nossa org). Se já existe
   * conexão com esse shopId, atualiza; senão anexa à conexão Keeta PENDENTE
   * mais recente. Suficiente pra 1 loja por vez; multi-tenant concorrente exige
   * propagar um `state` na URL de autorização (Keeta teria que ecoá-lo) — follow-up.
   */
  async handleKeetaAuthorization(code: string): Promise<void> {
    let adapter;
    try {
      adapter = this.registry.get('keeta');
    } catch {
      this.logger.warn('keeta_not_registered');
      return;
    }
    if (!(adapter instanceof KeetaAdapter)) {
      this.logger.warn('keeta_authorization_no_real_adapter');
      return;
    }
    const platform = await this.prisma.platform.findUnique({ where: { code: 'keeta' } });
    if (!platform) return;

    // Standard: uma troca de code → tokens per-merchant + lojas do merchant.
    const { tokens, merchants } = await adapter.exchangeAuthorizationCode(code);
    if (merchants.length === 0) {
      this.logger.warn('keeta_authorization_no_merchants');
      return;
    }

    for (const m of merchants) {
      const existing = await this.prisma.platformConnection.findFirst({
        where: { platformId: platform.id, externalMerchantId: m.merchantId },
      });
      const target =
        existing ??
        (await this.prisma.platformConnection.findFirst({
          where: { platformId: platform.id, status: 'pending' },
          orderBy: { createdAt: 'desc' },
        }));
      if (!target) {
        this.logger.warn({ merchantId: m.merchantId }, 'keeta_authorization_no_pending_connection');
        continue;
      }

      await this.vault.write(
        `${ACTIVE_VAULT_PREFIX}:${target.id}`,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt.toISOString(),
        },
        { kind: 'platform_tokens', platform: 'keeta' },
      );
      await this.prisma.platformConnection.update({
        where: { id: target.id },
        data: {
          status: 'active',
          vaultRef: `${ACTIVE_VAULT_PREFIX}:${target.id}`,
          externalMerchantId: m.merchantId,
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
      this.logger.log(
        { merchantId: m.merchantId, connectionId: target.id },
        'keeta_connection_activated',
      );
    }
  }

  /** Webhook 1302 do Keeta: loja revogou a autorização → marca `revoked`. */
  async handleKeetaDeauthorization(merchantId?: string): Promise<void> {
    if (!merchantId) return;
    const platform = await this.prisma.platform.findUnique({ where: { code: 'keeta' } });
    if (!platform) return;
    const res = await this.prisma.platformConnection.updateMany({
      where: { platformId: platform.id, externalMerchantId: merchantId, status: 'active' },
      data: {
        status: 'revoked',
        lastErrorAt: new Date(),
        lastErrorMessage: 'Desautorizado na Keeta',
      },
    });
    this.logger.log({ merchantId, count: res.count }, 'keeta_connection_revoked');
  }

  /**
   * Helper para outros services obterem tokens descriptografados de uma conexão.
   */
  async getTokens(connectionId: string): Promise<StoredTokens | null> {
    const data = await this.vault.read<{
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }>(`${ACTIVE_VAULT_PREFIX}:${connectionId}`);
    if (!data) return null;
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date(data.expiresAt),
    };
  }

  /**
   * Resolve a conexão ATIVA de uma loja numa plataforma e devolve os
   * tokens decifrados. Usado por ações que precisam chamar o adapter
   * fora do fluxo de transição de pedido (ex.: confirmar dinheiro,
   * responder pedido de cancelamento/reembolso).
   */
  async getActiveConnectionWithTokens(
    organizationId: string,
    storeId: string,
    platformId: string,
  ): Promise<{ connectionId: string; externalMerchantId: string; tokens: StoredTokens } | null> {
    const connection = await this.prisma.platformConnection.findFirst({
      where: { organizationId, storeId, platformId, status: 'active' },
    });
    if (!connection?.externalMerchantId) return null;
    const tokens = await this.getTokens(connection.id);
    if (!tokens) return null;
    return {
      connectionId: connection.id,
      externalMerchantId: connection.externalMerchantId,
      tokens,
    };
  }

  /**
   * Persiste novos tokens (usado pelo poller após `adapter.refreshAuth`).
   */
  async saveTokens(connectionId: string, tokens: StoredTokens): Promise<void> {
    await this.vault.write(`${ACTIVE_VAULT_PREFIX}:${connectionId}`, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });
  }
}
