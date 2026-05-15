import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from './dto/inventory.dto.js';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(auth: AuthContext, opts: { includeArchived?: boolean } = {}) {
    return this.tenantPrisma.tx.supplier.findMany({
      where: opts.includeArchived ? {} : { archivedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const supplier = await this.tenantPrisma.tx.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('supplier_not_found');
    return supplier;
  }

  async create(auth: AuthContext, input: CreateSupplierInput) {
    const created = await this.tenantPrisma.tx.supplier.create({
      data: {
        organizationId: auth.orgId,
        name: input.name,
        document: input.document ?? null,
        email: input.email && input.email.length > 0 ? input.email : null,
        phone: input.phone ?? null,
        address: (input.address as never) ?? undefined,
        notes: input.notes ?? null,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'supplier',
      entityId: created.id,
      action: 'create',
      diff: { name: created.name, document: created.document },
    });
    return created;
  }

  async update(auth: AuthContext, id: string, input: UpdateSupplierInput) {
    const existing = await this.findOne(auth, id);
    const updated = await this.tenantPrisma.tx.supplier.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        document: input.document ?? undefined,
        email:
          input.email === undefined
            ? undefined
            : input.email && input.email.length > 0
              ? input.email
              : null,
        phone: input.phone ?? undefined,
        address: input.address === undefined ? undefined : (input.address as never),
        notes: input.notes ?? undefined,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'supplier',
      entityId: id,
      action: 'update',
      diff: diffFields(existing, updated, ['name', 'document', 'email', 'phone', 'notes']),
    });
    return updated;
  }

  async archive(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.tenantPrisma.tx.supplier.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'supplier',
      entityId: id,
      action: 'delete',
      diff: { archived: true },
    });
  }
}

function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: (keyof T)[],
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  for (const f of fields) {
    if (before[f] !== after[f]) {
      out[String(f)] = { before: before[f], after: after[f] };
    }
  }
  return out;
}
