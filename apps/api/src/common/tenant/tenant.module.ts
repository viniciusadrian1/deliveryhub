import { Global, Module } from '@nestjs/common';

import { TenantContextService } from './tenant-context.service.js';
import { TenantInterceptor } from './tenant.interceptor.js';
import { TenantPrismaService } from './tenant-prisma.service.js';

@Global()
@Module({
  providers: [TenantContextService, TenantInterceptor, TenantPrismaService],
  exports: [TenantContextService, TenantInterceptor, TenantPrismaService],
})
export class TenantModule {}
