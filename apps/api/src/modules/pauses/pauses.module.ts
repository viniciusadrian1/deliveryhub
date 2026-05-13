import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PausesController } from './pauses.controller.js';
import { PausesScheduler } from './pauses.scheduler.js';
import { PausesService } from './pauses.service.js';

@Module({
  imports: [IntegrationsModule],
  controllers: [PausesController],
  providers: [PausesService, PausesScheduler],
  exports: [PausesService],
})
export class PausesModule {}
