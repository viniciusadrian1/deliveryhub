import { Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';

@Module({
  controllers: [IntegrationsController],
  providers: [AdapterRegistry, IntegrationsService],
  exports: [AdapterRegistry, IntegrationsService],
})
export class IntegrationsModule {}
