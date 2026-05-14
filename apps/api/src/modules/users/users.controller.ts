import { Controller, Get, Logger } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

@Controller()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Get('me')
  async me(@CurrentUser() auth: AuthContext) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // Demonstra TenantPrismaService: o filtro por organizationId é injetado automaticamente.
    let stores = await this.tenantPrisma.tx.store.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    // Self-heal: contas criadas antes do fix de signup ficaram sem store,
    // o que trava a UI no empty state de Integracoes. Cria uma loja padrao
    // usando o nome da organizacao na primeira vez que /me e chamado sem
    // nenhuma loja. Idempotente — proximas chamadas ja encontram a loja.
    if (stores.length === 0) {
      const org = await this.prisma.organization.findUnique({
        where: { id: auth.orgId },
        select: { name: true },
      });
      if (org) {
        const created = await this.prisma.store.create({
          data: {
            organizationId: auth.orgId,
            name: org.name,
            timezone: 'America/Sao_Paulo',
          },
          select: { id: true, name: true },
        });
        stores = [created];
        this.logger.log(
          `Auto-created default store for org ${auth.orgId} (no stores found)`,
        );
      }
    }

    return {
      user,
      orgId: auth.orgId,
      role: auth.role,
      stores,
    };
  }

  @Get('owner-only')
  @Roles('owner')
  ownerOnly(@CurrentUser() auth: AuthContext) {
    return { message: 'restrito a owners', orgId: auth.orgId };
  }
}
