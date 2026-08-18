import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Public } from '../../common/auth/public.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { AuthResult } from '../auth/auth.service.js';
import {
  acceptInvitationSchema,
  type AcceptInvitationInput,
  createInvitationSchema,
  type CreateInvitationInput,
} from './dto/invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('organizations/invitations')
  @Roles('owner', 'manager')
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationInput,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ): Promise<{ id: string; expiresAt: Date }> {
    return this.invitations.create(
      auth.orgId,
      auth.userId,
      auth.role,
      body.email,
      body.role,
      this.session(req),
    );
  }

  @Public()
  @Post('auth/invitations/accept')
  @HttpCode(200)
  async accept(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.invitations.accept(body.token, body.name, body.password, this.session(req));
  }

  private session(req: Request): { userAgent?: string; ip?: string } {
    const ua = req.headers['user-agent'];
    return {
      userAgent: typeof ua === 'string' ? ua : undefined,
      ip: req.ip,
    };
  }
}
