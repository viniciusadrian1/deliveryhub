import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type ApplyBatchInput,
  applyBatchSchema,
  type ListMarginQuery,
  listMarginQuerySchema,
  type SimulateBatchInput,
  simulateBatchSchema,
} from './dto/pricing.dto.js';
import { PricingService } from './pricing.service.js';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('items')
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listMarginQuerySchema)) query: ListMarginQuery,
  ) {
    return this.pricing.listMargin(auth, query.storeId, query.categoryId);
  }

  @Post('simulate')
  @Roles('owner', 'manager')
  @HttpCode(200)
  simulate(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(simulateBatchSchema)) body: SimulateBatchInput,
  ) {
    return this.pricing.simulate(auth, body);
  }

  @Post('apply')
  @Roles('owner', 'manager')
  @HttpCode(200)
  apply(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(applyBatchSchema)) body: ApplyBatchInput,
  ) {
    return this.pricing.apply(auth, body);
  }
}
