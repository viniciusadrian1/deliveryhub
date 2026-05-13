import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module.js';
import { CustomersService } from './customers.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersEmitter } from './orders.emitter.js';
import { OrdersGateway } from './orders.gateway.js';
import { OrdersService } from './orders.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [IntegrationsModule],
  controllers: [OrdersController, WebhooksController],
  providers: [OrdersService, CustomersService, OrdersEmitter, OrdersGateway],
  exports: [OrdersService, OrdersEmitter],
})
export class OrdersModule {}
