import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';

export const CURRENT_TERMS_VERSION = '2026-05-13';
export const CURRENT_PRIVACY_VERSION = '2026-05-13';

export interface ConsentRecordInput {
  subjectKind: 'user' | 'customer';
  subjectId: string;
  kind: 'terms' | 'privacy' | 'marketing';
  version: string;
  accepted: boolean;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: ConsentRecordInput): Promise<void> {
    await this.prisma.consentLog.create({
      data: {
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        kind: input.kind,
        version: input.version,
        accepted: input.accepted,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /** Lê o histórico de consentimentos de um usuário/cliente. */
  async historyFor(subjectKind: 'user' | 'customer', subjectId: string) {
    return this.prisma.consentLog.findMany({
      where: { subjectKind, subjectId },
      orderBy: { at: 'desc' },
    });
  }
}
