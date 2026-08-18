import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [IntegrationsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}
