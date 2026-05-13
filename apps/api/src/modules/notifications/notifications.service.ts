import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EmailService } from '../../common/email/email.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type {
  BulkUpdatePreferencesInput,
  ListNotificationsQuery,
  NotificationKind,
} from './dto/notification.dto.js';
import { NotificationsEmitter } from './notifications.emitter.js';

export interface CreateNotificationInput {
  userId: string;
  organizationId?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
  /** Quando preenchido, manda e-mail também se a preferência permitir. */
  email?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: NotificationsEmitter,
    private readonly email: EmailService,
  ) {}

  async create(input: CreateNotificationInput): Promise<void> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId_kind: { userId: input.userId, kind: input.kind } },
    });

    // Default: in-app ligado, e-mail desligado (a não ser que o usuário tenha optado).
    const channelInApp = prefs?.channelInApp ?? true;
    const channelEmail = prefs?.channelEmail ?? false;

    if (channelInApp) {
      const saved = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId ?? null,
          kind: input.kind,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl ?? null,
          metadata: (input.metadata as never) ?? undefined,
        },
      });

      this.emitter.emit({
        id: saved.id,
        organizationId: saved.organizationId,
        userId: saved.userId,
        kind: saved.kind,
        title: saved.title,
        body: saved.body,
        linkUrl: saved.linkUrl,
        createdAt: saved.createdAt,
      });
    }

    if (channelEmail && input.email) {
      try {
        await this.email.send({
          to: input.email,
          subject: input.title,
          text: input.body,
          html: `<p>${input.body}</p>${input.linkUrl ? `<p><a href="${input.linkUrl}">Ver detalhes</a></p>` : ''}`,
        });
      } catch (err) {
        this.logger.error({ err, kind: input.kind }, 'notification_email_failed');
      }
    }
  }

  async list(auth: AuthContext, query: ListNotificationsQuery) {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId: auth.userId,
        readAt: query.unreadOnly ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
    });
    return rows;
  }

  async unreadCount(auth: AuthContext): Promise<number> {
    return this.prisma.notification.count({
      where: { userId: auth.userId, readAt: null },
    });
  }

  async markRead(auth: AuthContext, id: string): Promise<void> {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true, readAt: true },
    });
    if (!n) throw new NotFoundException('notification_not_found');
    if (n.readAt) return;
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(auth: AuthContext): Promise<{ updated: number }> {
    const r = await this.prisma.notification.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  }

  // -------------- preferences --------------

  async listPreferences(auth: AuthContext) {
    return this.prisma.notificationPreference.findMany({
      where: { userId: auth.userId },
      orderBy: { kind: 'asc' },
    });
  }

  async updatePreferences(
    auth: AuthContext,
    input: BulkUpdatePreferencesInput,
  ): Promise<void> {
    await this.prisma.$transaction(
      input.preferences.map((p) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_kind: { userId: auth.userId, kind: p.kind } },
          create: {
            userId: auth.userId,
            kind: p.kind,
            channelInApp: p.channelInApp ?? true,
            channelEmail: p.channelEmail ?? false,
          },
          update: {
            channelInApp: p.channelInApp ?? undefined,
            channelEmail: p.channelEmail ?? undefined,
          },
        }),
      ),
    );
  }
}
