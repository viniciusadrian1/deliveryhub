import { randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { EmailService } from '../../common/email/email.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { loadEnv } from '../../config/env.js';
import { PasswordService } from './password.service.js';
import { TokensService } from './tokens.service.js';

const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

interface SessionContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
    private readonly audit: AuditLogService,
  ) {}

  /** Sempre retorna 204 — não revela se o e-mail existe. */
  async requestReset(email: string, session: SessionContext = {}): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { take: 1 } },
    });

    if (!user) {
      this.logger.warn({ email }, 'password_reset_unknown_email');
      return;
    }

    const plainToken = randomBytes(32).toString('base64url');
    const tokenHash = this.tokens.hashRefreshToken(plainToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: session.ip ?? null,
        userAgent: session.userAgent ?? null,
      },
    });

    const link = `${this.env.WEB_BASE_URL}/auth/reset-password?token=${encodeURIComponent(plainToken)}`;
    await this.email.send({
      to: email,
      subject: 'Recupere sua senha — DeliveryHub',
      text:
        `Olá ${user.name},\n\nVocê pediu para recuperar sua senha no DeliveryHub.\n\n` +
        `Use este link nas próximas 1 hora:\n${link}\n\n` +
        `Se você não solicitou, ignore este e-mail.\n\nDeliveryHub`,
      html:
        `<p>Olá ${user.name},</p>` +
        `<p>Você pediu para recuperar sua senha no <strong>DeliveryHub</strong>.</p>` +
        `<p><a href="${link}">Redefinir senha</a> (válido por 1 hora)</p>` +
        `<p>Se você não solicitou, ignore este e-mail.</p>`,
    });

    await this.audit.record({
      organizationId: user.memberships[0]?.organizationId,
      userId: user.id,
      entity: 'password_reset_token',
      action: 'create',
      ip: session.ip,
      userAgent: session.userAgent,
    });
  }

  async resetPassword(
    plainToken: string,
    newPassword: string,
    session: SessionContext = {},
  ): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(plainToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { memberships: { take: 1 } } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('invalid_reset_token');
    }

    const newHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoga todos os refresh tokens ativos do usuário (forças logout em todos os devices).
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      organizationId: record.user.memberships[0]?.organizationId,
      userId: record.userId,
      entity: 'user',
      entityId: record.userId,
      action: 'update',
      diff: { passwordChanged: true },
      ip: session.ip,
      userAgent: session.userAgent,
    });
  }
}
