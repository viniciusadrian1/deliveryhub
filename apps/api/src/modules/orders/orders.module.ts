import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { CustomersService } from './customers.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersEmitter } from './orders.emitter.js';
import { OrdersGateway } from './orders.gateway.js';
import { OrdersPoller } from './orders.poller.js';
import { OrdersService } from './orders.service.js';
import { PlatformActionRequestsController } from './platform-action-requests.controller.js';
import { PlatformActionRequestsService } from './platform-action-requests.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [IntegrationsModule, InventoryModule],
  controllers: [OrdersController, WebhooksController, PlatformActionRequestsController],
  providers: [
    OrdersService,
    CustomersService,
    OrdersEmitter,
    OrdersGateway,
    OrdersPoller,
    PlatformActionRequestsService,
  ],
  exports: [OrdersService, OrdersEmitter],
})
export class OrdersModule {}
