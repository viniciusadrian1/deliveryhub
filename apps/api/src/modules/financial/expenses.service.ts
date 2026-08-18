import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@deliveryhub/db';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateExpenseInput,
  type ListExpensesQuery,
  type UpdateExpenseInput,
} from './dto/expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(auth: AuthContext, query: ListExpensesQuery) {
    // "Despesas ativas no período" (contrato do DTO): one_time entra se occurredAt
    // cai no período; recorrentes entram se já começaram (occurredAt <= periodEnd)
    // e ainda não encerraram antes dele (endedAt nulo OU >= periodStart). Para
    // recorrentes occurredAt é a data de INÍCIO, não a ocorrência no período —
    // por isso não dá pra filtrar por occurredAt >= periodStart. Espelha DreService.
    const periodFilter: Prisma.ExpenseWhereInput =
      query.periodStart || query.periodEnd
        ? {
            OR: [
              {
                recurrence: 'one_time',
                occurredAt: { gte: query.periodStart, lte: query.periodEnd },
              },
              {
                recurrence: { in: ['monthly', 'weekly', 'daily'] },
                occurredAt: query.periodEnd ? { lte: query.periodEnd } : undefined,
                AND: [
                  {
                    OR: [
                      { endedAt: null },
                      query.periodStart ? { endedAt: { gte: query.periodStart } } : {},
                    ],
                  },
                ],
              },
            ],
          }
        : {};

    return this.tenantPrisma.tx.expense.findMany({
      where: {
        storeId: query.storeId,
        category: query.category,
        recurrence: query.recurrence,
        ...periodFilter,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: query.limit,
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const expense = await this.tenantPrisma.tx.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('expense_not_found');
    return expense;
  }

  async create(auth: AuthContext, input: CreateExpenseInput) {
    const created = await this.tenantPrisma.tx.expense.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        name: input.name,
        category: input.category,
        amountCents: input.amountCents,
        recurrence: input.recurrence,
        dueDay: input.dueDay ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes ?? null,
        createdById: auth.userId,
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'expense',
      entityId: created.id,
      action: 'create',
      diff: {
        name: created.name,
        category: created.category,
        amountCents: created.amountCents,
        recurrence: created.recurrence,
      },
    });

    return created;
  }

  async update(auth: AuthContext, id: string, input: UpdateExpenseInput) {
    const existing = await this.findOne(auth, id);
    const updated = await this.tenantPrisma.tx.expense.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        category: input.category ?? undefined,
        amountCents: input.amountCents ?? undefined,
        recurrence: input.recurrence ?? undefined,
        dueDay: input.dueDay === undefined ? undefined : input.dueDay,
        occurredAt: input.occurredAt ?? undefined,
        endedAt: input.endedAt === undefined ? undefined : input.endedAt,
        paymentMethod:
          input.paymentMethod === undefined ? undefined : input.paymentMethod,
        notes: input.notes === undefined ? undefined : input.notes,
      },
    });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'expense',
      entityId: id,
      action: 'update',
      diff: {
        before: { name: existing.name, amountCents: existing.amountCents },
        after: { name: updated.name, amountCents: updated.amountCents },
      },
    });
    return updated;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.findOne(auth, id);
    await this.tenantPrisma.tx.expense.delete({ where: { id } });
    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'expense',
      entityId: id,
      action: 'delete',
    });
  }
}
