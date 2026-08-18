import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreatePromotionInput,
  createPromotionSchema,
  type ListPromotionsQuery,
  listPromotionsQuerySchema,
} from './dto/promotions.dto.js';
import { PromotionsService } from './promotions.service.js';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listPromotionsQuerySchema)) query: ListPromotionsQuery,
  ) {
    return this.promotions.list(auth, query.storeId);
  }

  @Post()
  @Roles('owner', 'manager')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotionInput,
  ) {
    return this.promotions.create(auth, body);
  }

  /** Consulta o processamento na plataforma e atualiza o status local. */
  @Post(':id/refresh')
  @Roles('owner', 'manager')
  @HttpCode(200)
  refresh(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.promotions.refresh(auth, id);
  }
}
