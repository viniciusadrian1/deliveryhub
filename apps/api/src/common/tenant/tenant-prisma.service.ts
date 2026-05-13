import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { TenantContextService } from './tenant-context.service.js';

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

const CREATE_OPS = new Set(['create', 'createMany']);

/**
 * Models que possuem `organizationId` e são automaticamente escopados pelo tenant.
 * Adicionar aqui qualquer novo model com `organizationId` para manter o filtro.
 */
const TENANT_MODELS = [
  'Store',
  'Membership',
  'Invitation',
  'PlatformConnection',
  'PlatformFeeProfile',
  'Category',
  'MenuItem',
  'ModifierGroup',
  'Modifier',
  'MenuItemPlatformConfig',
  'Customer',
  'Order',
  'Pause',
] as const;

function injectOrgIdIntoData(data: unknown, orgId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((entry) => ({ ...entry, organizationId: orgId }));
  }
  if (data && typeof data === 'object') {
    return { ...(data as Record<string, unknown>), organizationId: orgId };
  }
  return data;
}

function buildTenantQueryConfig(tenantContext: TenantContextService) {
  const handler = {
    async $allOperations({
      operation,
      args,
      query,
    }: {
      operation: string;
      args: Record<string, unknown>;
      query: (args: Record<string, unknown>) => Promise<unknown>;
    }) {
      const ctx = tenantContext.getOrThrow();
      const next = { ...args };

      if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
        const where = (next.where as Record<string, unknown> | undefined) ?? {};
        next.where = { ...where, organizationId: ctx.orgId };
      }

      if (CREATE_OPS.has(operation)) {
        next.data = injectOrgIdIntoData(next.data, ctx.orgId);
      }

      if (operation === 'upsert') {
        next.create = injectOrgIdIntoData(next.create, ctx.orgId);
      }

      return query(next);
    },
  };

  return Object.fromEntries(TENANT_MODELS.map((m) => [m.toLowerCase(), handler]));
}

export type TenantClient = ReturnType<TenantPrismaService['buildClient']>;

@Injectable()
export class TenantPrismaService {
  readonly tx: TenantClient;

  constructor(
    private readonly base: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.tx = this.buildClient();
  }

  private buildClient() {
    return this.base.$extends({
      name: 'tenant-scope',
      query: buildTenantQueryConfig(this.tenantContext) as never,
    });
  }
}
