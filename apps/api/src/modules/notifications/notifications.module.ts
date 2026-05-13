import { Global, Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsEmitter } from './notifications.emitter.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEmitter, NotificationsGateway],
  exports: [NotificationsService, NotificationsEmitter],
})
export class NotificationsModule {}
