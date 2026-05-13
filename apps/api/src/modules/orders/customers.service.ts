import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface CustomerUpsertInput {
  organizationId: string;
  name: string;
  phone?: string;
  document?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert por hash de telefone/documento. Mantém apenas UMA linha por
   * (org × telefone) — pedidos subsequentes do mesmo cliente em qualquer
   * plataforma agregam ao mesmo `customer_id`.
   *
   * `phone`/`document` ficam cifrados em repouso pela PII extension;
   * `phone_hash`/`document_hash` são usados para a consulta determinística.
   */
  async upsert(input: CustomerUpsertInput): Promise<{ id: string }> {
    const phoneHash = input.phone ? hashDigits(input.phone) : null;
    const documentHash = input.document ? hashDigits(input.document) : null;

    // Tenta achar por phone primeiro, depois document.
    let existing = null;
    if (phoneHash) {
      existing = await this.prisma.customer.findUnique({
        where: { organizationId_phoneHash: { organizationId: input.organizationId, phoneHash } },
        select: { id: true },
      });
    }
    if (!existing && documentHash) {
      existing = await this.prisma.customer.findUnique({
        where: {
          organizationId_documentHash: {
            organizationId: input.organizationId,
            documentHash,
          },
        },
        select: { id: true },
      });
    }

    if (existing) {
      await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          lastSeenAt: new Date(),
          // Preserva campos novos vindos do pedido se ainda não existiam.
          phone: input.phone ?? undefined,
          phoneHash: phoneHash ?? undefined,
          document: input.document ?? undefined,
          documentHash: documentHash ?? undefined,
        },
      });
      return existing;
    }

    const created = await this.prisma.customer.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        phone: input.phone ?? null,
        phoneHash,
        document: input.document ?? null,
        documentHash,
      },
      select: { id: true },
    });
    return created;
  }
}

function hashDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return createHash('sha256').update(digits).digest('hex');
}
