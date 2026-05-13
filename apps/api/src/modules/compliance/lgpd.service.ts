import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

export interface UserDataExport {
  exportedAt: string;
  profile: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    joinedAt: Date;
  }>;
  notifications: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    createdAt: Date;
    readAt: Date | null;
  }>;
  notificationPreferences: Array<{
    kind: string;
    channelInApp: boolean;
    channelEmail: boolean;
  }>;
  consents: Array<{ kind: string; version: string; accepted: boolean; at: Date }>;
  recentAuditEvents: Array<{
    entity: string;
    entityId: string | null;
    action: string;
    at: Date;
    ip: string | null;
    userAgent: string | null;
  }>;
  activeSessions: Array<{
    id: string;
    userAgent: string | null;
    ip: string | null;
    expiresAt: Date;
    createdAt: Date;
  }>;
}

interface SessionContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class LgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Exporta todos os dados pessoais do usuário em uma estrutura JSON.
   * MVP: resposta síncrona (sem ZIP/arquivo) — payload tipicamente < 1MB.
   * Cumpre LGPD art. 18, II (portabilidade dos dados).
   */
  async exportUserData(auth: AuthContext, session: SessionContext = {}): Promise<UserDataExport> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      include: {
        memberships: { include: { organization: { select: { id: true, name: true } } } },
        notifications: { take: 500, orderBy: { createdAt: 'desc' } },
        notificationPreferences: true,
        refreshTokens: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, userAgent: true, ip: true, expiresAt: true, createdAt: true },
        },
      },
    });

    const consents = await this.prisma.consentLog.findMany({
      where: { subjectKind: 'user', subjectId: auth.userId },
      orderBy: { at: 'desc' },
    });

    const recentAudits = await this.prisma.auditLog.findMany({
      where: { userId: auth.userId },
      take: 1000,
      orderBy: { at: 'desc' },
      select: {
        entity: true,
        entityId: true,
        action: true,
        at: true,
        ip: true,
        userAgent: true,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'user',
      entityId: auth.userId,
      action: 'export',
      ip: session.ip,
      userAgent: session.userAgent,
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      notifications: user.notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      notificationPreferences: user.notificationPreferences.map((p) => ({
        kind: p.kind,
        channelInApp: p.channelInApp,
        channelEmail: p.channelEmail,
      })),
      consents: consents.map((c) => ({
        kind: c.kind,
        version: c.version,
        accepted: c.accepted,
        at: c.at,
      })),
      recentAuditEvents: recentAudits,
      activeSessions: user.refreshTokens,
    };
  }

  /**
   * Anonimiza o usuário em vez de hard-delete. Razão: muitos audit_logs e
   * pedidos referenciam user_id e a destruição quebraria a integridade
   * histórica. Anonimização preserva o trail sem expor PII.
   *
   * Operação irreversível:
   * - email → deleted-{id8}@anon.local (mantém UNIQUE)
   * - name → "Conta removida (LGPD)"
   * - phone → null
   * - passwordHash → impossível de logar
   * - refresh tokens revogados
   * - notification_preference deletadas (não há razão pra manter)
   * - consent_log permanece (prova de compliance)
   *
   * Recusa quando o usuário é o único `owner` de alguma org com outras
   * memberships — a org ficaria órfã. Operador deve transferir antes.
   */
  async anonymizeUser(auth: AuthContext, session: SessionContext = {}): Promise<void> {
    // Verifica orgs onde é único owner com outros membros
    const ownedOrgs = await this.prisma.membership.findMany({
      where: { userId: auth.userId, role: 'owner' },
      select: { organizationId: true },
    });

    for (const m of ownedOrgs) {
      const ownerCount = await this.prisma.membership.count({
        where: { organizationId: m.organizationId, role: 'owner' },
      });
      const memberCount = await this.prisma.membership.count({
        where: { organizationId: m.organizationId },
      });
      if (ownerCount === 1 && memberCount > 1) {
        throw new BadRequestException({
          message: 'sole_owner_of_active_organization',
          organizationId: m.organizationId,
          hint: 'Transfira o ownership antes de remover sua conta.',
        });
      }
    }

    const anonEmail = `deleted-${auth.userId.slice(0, 8)}@anon.local`;
    const unusablePasswordHash =
      '$argon2id$v=19$m=19456,t=2,p=1$ZGVsZXRlZA$ZGVsZXRlZA';

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: auth.userId },
        data: {
          email: anonEmail,
          name: 'Conta removida (LGPD)',
          phone: null,
          passwordHash: unusablePasswordHash,
          emailVerifiedAt: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: auth.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.notificationPreference.deleteMany({
        where: { userId: auth.userId },
      }),
    ]);

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'user',
      entityId: auth.userId,
      action: 'delete',
      diff: { anonymized: true },
      ip: session.ip,
      userAgent: session.userAgent,
    });
  }
}
