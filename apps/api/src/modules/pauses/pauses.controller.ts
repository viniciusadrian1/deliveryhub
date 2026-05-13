import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreatePauseInput,
  createPauseSchema,
  type ListPausesQuery,
  listPausesQuerySchema,
} from './dto/pauses.dto.js';
import { PausesService } from './pauses.service.js';

@Controller('pauses')
export class PausesController {
  constructor(private readonly pauses: PausesService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listPausesQuerySchema)) query: ListPausesQuery,
  ) {
    return this.pauses.list(auth, query);
  }

  @Get('active')
  listActive(@CurrentUser() auth: AuthContext, @Query('storeId') storeId: string) {
    return this.pauses.listActive(auth, storeId);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createPauseSchema)) body: CreatePauseInput,
    @Req() req: Request,
  ) {
    return this.pauses.create(auth, body, this.session(req));
  }

  @Post(':id/cancel')
  @Roles('owner', 'manager')
  @HttpCode(200)
  cancel(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.pauses.cancel(auth, id, this.session(req));
  }

  private session(req: Request): { userAgent?: string; ip?: string } {
    const ua = req.headers['user-agent'];
    return {
      userAgent: typeof ua === 'string' ? ua : undefined,
      ip: req.ip,
    };
  }
}
