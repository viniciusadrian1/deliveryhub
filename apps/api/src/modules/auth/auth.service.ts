import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  ConsentService,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../compliance/consent.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { LoginInput } from './dto/login.dto.js';
import type { SignupInput } from './dto/signup.dto.js';
import { PasswordService } from './password.service.js';
import { TokensService } from './tokens.service.js';

export interface AuthResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
  role: string;
}

interface AuthSessionContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  // Hash argon2id fixo de uma string aleatória. Usado no login quando o e-mail não
  // existe, para que o verify rode nos dois caminhos e o tempo de resposta não revele
  // se a conta existe (proteção contra enumeração por timing).
  private static readonly DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=19456,t=2,p=1$/mdKThYCQZr52TihCH/q3Q$w5hTu1V6HlOeo2CsvEFD/F5xuLPXShT4MV0lXz1UhyE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly consent: ConsentService,
  ) {}

  async signup(input: SignupInput, session: AuthSessionContext = {}): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('email_already_in_use');
    }

    const passwordHash = await this.passwords.hash(input.password);

    const { user, membership, organization } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName },
      });

      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });

      const membership = await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner' },
      });

      // Cria a loja padrao com o mesmo nome da organizacao. O campo "Nome da loja"
      // do formulario de signup mapeia pra `organizationName` no schema, entao o
      // usuario espera ter uma loja com esse nome ja pronta.
      await tx.store.create({
        data: {
          organizationId: organization.id,
          name: input.organizationName,
          timezone: 'America/Sao_Paulo',
        },
      });

      return { user, membership, organization };
    });

    await this.audit.record({
      organizationId: organization.id,
      userId: user.id,
      entity: 'user',
      entityId: user.id,
      action: 'signup',
      ip: session.ip,
      userAgent: session.userAgent,
    });

    // Registra consentimento implícito de Termos e Privacidade.
    // Versão por data — cada deploy que altera o documento bumpa a constante.
    await Promise.all([
      this.consent.record({
        subjectKind: 'user',
        subjectId: user.id,
        kind: 'terms',
        version: CURRENT_TERMS_VERSION,
        accepted: true,
        ip: session.ip,
        userAgent: session.userAgent,
      }),
      this.consent.record({
        subjectKind: 'user',
        subjectId: user.id,
        kind: 'privacy',
        version: CURRENT_PRIVACY_VERSION,
        accepted: true,
        ip: session.ip,
        userAgent: session.userAgent,
      }),
    ]);

    await this.notifications.create({
      userId: user.id,
      organizationId: organization.id,
      kind: 'welcome',
      title: `Bem-vindo ao DeliveryHub, ${user.name}`,
      body: `Sua organização "${organization.name}" foi criada. Próximo passo: conecte sua primeira plataforma de delivery.`,
      linkUrl: '/integrations',
      email: user.email,
    });

    return this.issueSessionTokens(user, membership, organization, session);
  }

  async login(input: LoginInput, session: AuthSessionContext = {}): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      // orderBy determinístico: usuários multi-org caem sempre na org mais antiga
      // (a primeira que criaram/entraram), não numa membership arbitrária.
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    // Sempre roda um verify — contra um hash fixo quando o e-mail não existe — para
    // que ambos os caminhos gastem o mesmo tempo de CPU (anti-enumeração por timing).
    const valid = await this.passwords.verify(
      user?.passwordHash ?? AuthService.DUMMY_PASSWORD_HASH,
      input.password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('invalid_credentials');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('no_organization');
    }

    await this.audit.record({
      organizationId: membership.organizationId,
      userId: user.id,
      entity: 'user',
      entityId: user.id,
      action: 'login',
      ip: session.ip,
      userAgent: session.userAgent,
    });

    return this.issueSessionTokens(user, membership, membership.organization, session);
  }

  async refresh(plainRefreshToken: string, session: AuthSessionContext = {}): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(plainRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            // Mesmo orderBy determinístico do login (org mais antiga primeiro).
            memberships: {
              include: { organization: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('invalid_refresh_token');
    }

    const membership = stored.user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('no_organization');
    }

    // Rotation: revoga o antigo, emite novo par. Tudo em uma transação para evitar reuso.
    return this.prisma.$transaction(async (tx) => {
      // Revoga condicionalmente (revokedAt: null): sob Read Committed, dois refresh
      // concorrentes com o mesmo token não geram dois tokens vivos — só o primeiro
      // commit casa a linha; o segundo vê revokedAt já setado e aborta (count === 0).
      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) {
        throw new UnauthorizedException('invalid_refresh_token');
      }

      return this.issueSessionTokens(
        stored.user,
        membership,
        membership.organization,
        session,
        tx,
      );
    });
  }

  async logout(plainRefreshToken: string, session: AuthSessionContext = {}): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(plainRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, user: { include: { memberships: { take: 1 } } } },
    });

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (stored) {
      await this.audit.record({
        organizationId: stored.user.memberships[0]?.organizationId,
        userId: stored.userId,
        entity: 'refresh_token',
        entityId: stored.id,
        action: 'logout',
        ip: session.ip,
        userAgent: session.userAgent,
      });
    }
  }

  private async issueSessionTokens(
    user: { id: string; email: string; name: string },
    membership: { role: string },
    organization: { id: string; name: string },
    session: AuthSessionContext,
    tx?: Pick<PrismaService, 'refreshToken'>,
  ): Promise<AuthResult> {
    const accessPayload = { sub: user.id, orgId: organization.id, role: membership.role };
    const access = await this.tokens.signAccessToken(accessPayload);
    const refresh = this.tokens.issueRefreshToken();

    const client = tx ?? this.prisma;
    await client.refreshToken.create({
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
      organization: { id: organization.id, name: organization.name },
      role: membership.role,
    };
  }
}
