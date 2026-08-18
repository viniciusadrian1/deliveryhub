import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../../common/auth/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { type LoginInput, loginSchema } from './dto/login.dto.js';
import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
} from './dto/password-reset.dto.js';
import { type RefreshInput, refreshSchema } from './dto/refresh.dto.js';
import { type SignupInput, signupSchema } from './dto/signup.dto.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('signup')
  @HttpCode(201)
  signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.signup(body, this.sessionContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.login(body, this.sessionContext(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.refresh(body.refreshToken, this.sessionContext(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken, this.sessionContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.passwordReset.requestReset(body.email, this.sessionContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.passwordReset.resetPassword(body.token, body.password, this.sessionContext(req));
  }

  private sessionContext(req: Request): { userAgent?: string; ip?: string } {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      ip: req.ip,
    };
  }
}
