import { Body, ConflictException, Controller, Delete, Get, HttpCode, Logger, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@deliveryhub/db';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.record(z.string(), z.unknown()).nullable().optional(),
  timezone: z.string().trim().min(3).max(80),
  logoUrl: z.string().max(2_000_000).nullable().optional(),
});

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
    const organization = await this.prisma.organization.findUnique({
      where: { id: auth.orgId },
      select: { name: true },
    });

    // Demonstra TenantPrismaService: o filtro por organizationId é injetado automaticamente.
    let stores = await this.tenantPrisma.tx.store.findMany({
      select: { id: true, name: true, address: true, timezone: true, logoUrl: true },
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
          select: { id: true, name: true, address: true, timezone: true, logoUrl: true },
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
      organizationName: organization?.name ?? '',
      role: auth.role,
      stores,
    };
  }

  @Post('stores')
  @Roles('owner')
  @HttpCode(201)
  createStore(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createStoreSchema)) body: z.infer<typeof createStoreSchema>,
  ) {
    return this.prisma.store.create({
      data: {
        organizationId: auth.orgId,
        name: body.name,
        timezone: 'America/Sao_Paulo',
      },
      select: { id: true, name: true },
    });
  }

  @Patch('stores/:id')
  @Roles('owner')
  updateStore(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStoreSchema)) body: z.infer<typeof updateStoreSchema>,
  ) {
    return this.prisma.store.updateMany({
      where: { id, organizationId: auth.orgId },
      data: {
        name: body.name,
        address: body.address === null ? Prisma.JsonNull : body.address as Prisma.InputJsonValue,
        timezone: body.timezone,
        logoUrl: body.logoUrl ?? null,
      },
    }).then(async (result) => {
      if (result.count === 0) throw new NotFoundException('store_not_found');
      return this.prisma.store.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, address: true, timezone: true, logoUrl: true },
      });
    });
  }

  @Delete('stores/:id')
  @Roles('owner')
  @HttpCode(204)
  async deleteStore(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    const count = await this.prisma.store.count({ where: { organizationId: auth.orgId } });
    if (count <= 1) throw new ConflictException('last_store_cannot_be_deleted');
    const result = await this.prisma.store.deleteMany({ where: { id, organizationId: auth.orgId } });
    if (result.count === 0) throw new NotFoundException('store_not_found');
  }

  @Get('owner-only')
  @Roles('owner')
  ownerOnly(@CurrentUser() auth: AuthContext) {
    return { message: 'restrito a owners', orgId: auth.orgId };
  }
}
