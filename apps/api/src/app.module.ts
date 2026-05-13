import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './common/audit/audit.module.js';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { EmailModule } from './common/email/email.module.js';
import { SentryInterceptor } from './common/observability/sentry.filter.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { TenantInterceptor } from './common/tenant/tenant.interceptor.js';
import { TenantModule } from './common/tenant/tenant.module.js';
import { VaultModule } from './common/vault/vault.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';
import { FinancialModule } from './modules/financial/financial.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { PausesModule } from './modules/pauses/pauses.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    CryptoModule,
    PrismaModule,
    AuditModule,
    EmailModule,
    VaultModule,
    TenantModule,
    HealthModule,
    AuthModule,
    ComplianceModule,
    NotificationsModule,
    OrganizationsModule,
    IntegrationsModule,
    MenuModule,
    OrdersModule,
    PausesModule,
    PricingModule,
    FinancialModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
