import { Global, Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service.js';

@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
