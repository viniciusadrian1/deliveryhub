import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import type { Role } from '@deliveryhub/shared';

/**
 * Hierarquia de papéis. Um usuário só pode convidar alguém com papel de rank
 * MENOR OU IGUAL ao seu — impede um manager de cunhar owners (escalação).
 * staff e financial são pares (sem poder de convite acima de si).
 */
const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  manager: 2,
  staff: 1,
  financial: 1,
};

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { EmailService } from '../../common/email/email.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import { loadEnv } from '../../config/env.js';
import type { AuthResult } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { TokensService } from '../auth/tokens.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

interface SessionContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    organizationId: string,
    invitedByUserId: string,
    inviterRole: Role,
    email: string,
    role: Role,
    session: SessionContext = {},
  ): Promise<{ id: string; expiresAt: Date }> {
    // Anti-escalação: ninguém convida acima do próprio papel.
    if (ROLE_RANK[role] > ROLE_RANK[inviterRole]) {
      throw new ForbiddenException('cannot_invite_higher_role');
    }

    // Já é membro?
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { organizationId } } },
    });
    if (existingUser?.memberships.length) {
      throw new ConflictException('already_a_member');
    }

    // Convite pendente?
    const pending = await this.prisma.invitation.findFirst({
      where: { organizationId, email, acceptedAt: null, revokedAt: null },
    });
    if (pending && pending.expiresAt > new Date()) {
      throw new ConflictException('pending_invitation_exists');
    }

    const plainToken = randomBytes(32).toString('base64url');
    const tokenHash = this.tokens.hashRefreshToken(plainToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_SECONDS * 1000);

    // Use o cliente tenant-scoped — organizationId é injetado, mas precisamos forçar o valor aqui
    // por causa do convidador. Como o JwtAuthGuard já populou o contexto, organizationId vai bater.
    const created = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        role,
        tokenHash,
        expiresAt,
        invitedByUserId,
      },
    });

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });

    const link = `${this.env.WEB_BASE_URL}/auth/invitations/accept?token=${encodeURIComponent(plainToken)}`;

    await this.email.send({
      to: email,
      subject: `Convite para ${org.name} — DeliveryHub`,
      text:
        `Olá!\n\nVocê foi convidado para entrar na organização "${org.name}" no DeliveryHub` +
        ` com o papel ${role}.\n\nAceite o convite (válido por 7 dias):\n${link}\n\n` +
        `Se você não esperava este convite, ignore este e-mail.\n\nDeliveryHub`,
      html:
        `<p>Olá!</p>` +
        `<p>Você foi convidado para entrar na organização <strong>${org.name}</strong> no DeliveryHub com o papel <strong>${role}</strong>.</p>` +
        `<p><a href="${link}">Aceitar convite</a> (válido por 7 dias)</p>` +
        `<p>Se você não esperava este convite, ignore este e-mail.</p>`,
    });

    await this.audit.record({
      organizationId,
      userId: invitedByUserId,
      entity: 'invitation',
      entityId: created.id,
      action: 'create',
      diff: { email, role },
      ip: session.ip,
      userAgent: session.userAgent,
    });

    return { id: created.id, expiresAt };
  }

  async accept(
    plainToken: string,
    name: string | undefined,
    password: string | undefined,
    session: SessionContext = {},
  ): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(plainToken);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('invalid_invitation_token');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    // Hash de senha é CPU-bound — computa FORA da transação (só p/ usuário novo).
    let passwordHash: string | undefined;
    if (!existing) {
      if (!name || !password) {
        throw new BadRequestException('new_user_requires_name_and_password');
      }
      passwordHash = await this.passwords.hash(password);
    }

    // Cria usuário (se novo), membership e carimba o convite atomicamente. Antes o
    // user.create rodava FORA da transação: se ela falhasse depois, sobrava um User
    // órfão sem membership, travando login e re-registro do e-mail para sempre.
    const { user, membership } = await this.prisma
      .$transaction(async (tx) => {
        const person =
          existing ??
          (await tx.user.create({
            data: { email: invitation.email, passwordHash: passwordHash!, name: name! },
          }));
        const m = await tx.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: person.id,
            role: invitation.role,
          },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedByUserId: person.id },
        });
        return { user: person, membership: m };
      })
      .catch((err) => {
        // Double-accept concorrente do mesmo token colide no @@unique da membership
        // (P2002) — devolve token usado em vez de 500 cru.
        if (err?.code === 'P2002') {
          throw new UnauthorizedException('invalid_invitation_token');
        }
        throw err;
      });

    await this.audit.record({
      organizationId: invitation.organizationId,
      userId: user.id,
      entity: 'invitation',
      entityId: invitation.id,
      action: 'consent',
      diff: { role: invitation.role },
      ip: session.ip,
      userAgent: session.userAgent,
    });

    // Notifica quem convidou.
    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedByUserId },
      select: { id: true, email: true },
    });
    if (inviter) {
      await this.notifications.create({
        userId: inviter.id,
        organizationId: invitation.organizationId,
        kind: 'invitation_accepted',
        title: 'Convite aceito',
        body: `${user.name} aceitou seu convite para entrar como ${invitation.role}.`,
        linkUrl: '/settings/team',
        email: inviter.email,
      });
    }

    const access = await this.tokens.signAccessToken({
      sub: user.id,
      orgId: invitation.organizationId,
      role: membership.role,
    });
    const refresh = this.tokens.issueRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        userAgent: session.userAgent ?? null,
        ip: session.ip ?? null,
        expiresAt: refresh.expiresAt,
      },
    });

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.plainToken,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: invitation.organization.id, name: invitation.organization.name },
      role: membership.role,
    };
  }
}
