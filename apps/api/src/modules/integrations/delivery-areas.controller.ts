import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { DeliveryAreasService } from './delivery-areas.service.js';
import {
  type CreateDeliveryAreaInput,
  createDeliveryAreaSchema,
  type DeleteDeliveryAreaInput,
  deleteDeliveryAreaSchema,
} from './dto/delivery-area.dto.js';

/** Áreas de entrega de uma loja no 99Food (Logistics API). */
@Controller('integrations/:storeId/delivery-areas')
export class DeliveryAreasController {
  constructor(private readonly service: DeliveryAreasService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext, @Param('storeId') storeId: string) {
    return this.service.list(auth, storeId);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  add(
    @CurrentUser() auth: AuthContext,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(createDeliveryAreaSchema)) body: CreateDeliveryAreaInput,
  ) {
    return this.service.add(auth, storeId, body);
  }

  @Post('delete')
  @Roles('owner', 'manager')
  @HttpCode(200)
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(deleteDeliveryAreaSchema)) body: DeleteDeliveryAreaInput,
  ) {
    return this.service.remove(auth, storeId, body.areaIds);
  }
}
