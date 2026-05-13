import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

@Controller()
export class UsersController {
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
    const stores = await this.tenantPrisma.tx.store.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

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
