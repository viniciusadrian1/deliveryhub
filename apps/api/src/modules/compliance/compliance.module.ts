import { Global, Module } from '@nestjs/common';

import { ComplianceController } from './compliance.controller.js';
import { ConsentService } from './consent.service.js';
import { LgpdService } from './lgpd.service.js';

@Global()
@Module({
  controllers: [ComplianceController],
  providers: [ConsentService, LgpdService],
  exports: [ConsentService, LgpdService],
})
export class ComplianceModule {}
