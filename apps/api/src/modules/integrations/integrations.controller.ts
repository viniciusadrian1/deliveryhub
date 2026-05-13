import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { startConnectionSchema, type StartConnectionInput } from './dto/connect.dto.js';
import { IntegrationsService } from './integrations.service.js';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('connections')
  list(@CurrentUser() auth: AuthContext) {
    return this.integrations.listConnections(auth);
  }

  @Post('connect')
  @Roles('owner', 'manager')
  @HttpCode(201)
  start(
    @Body(new ZodValidationPipe(startConnectionSchema)) body: StartConnectionInput,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.integrations.startConnection(auth, body.platformCode, body.storeId, this.session(req));
  }

  @Post('connections/:id/finalize')
  @Roles('owner', 'manager')
  @HttpCode(200)
  finalize(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.integrations.finalizeConnection(auth, id, this.session(req));
  }

  @Delete('connections/:id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async disconnect(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.integrations.disconnect(auth, id, this.session(req));
  }

  private session(req: Request): { userAgent?: string; ip?: string } {
    const ua = req.headers['user-agent'];
    return {
      userAgent: typeof ua === 'string' ? ua : undefined,
      ip: req.ip,
    };
  }
}
