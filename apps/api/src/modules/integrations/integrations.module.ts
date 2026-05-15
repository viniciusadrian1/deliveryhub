import { Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry.js';
import { DeliveryAreasController } from './delivery-areas.controller.js';
import { DeliveryAreasService } from './delivery-areas.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';

@Module({
  controllers: [IntegrationsController, DeliveryAreasController],
  providers: [AdapterRegistry, IntegrationsService, DeliveryAreasService],
  exports: [AdapterRegistry, IntegrationsService],
})
export class IntegrationsModule {}
