import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'signup'
  | 'refresh'
  | 'pause'
  | 'resume'
  | 'price_change'
  | 'export'
  | 'consent';

export interface AuditEntry {
  organizationId?: string | null;
  userId?: string | null;
  entity: string;
  entityId?: string | null;
  action: AuditAction;
  diff?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          userId: entry.userId ?? null,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          action: entry.action,
          diff: (entry.diff as never) ?? undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      // Auditoria não pode quebrar fluxo de negócio — só logamos e seguimos.
      this.logger.error({ err, entry }, 'failed_to_persist_audit_log');
    }
  }
}
