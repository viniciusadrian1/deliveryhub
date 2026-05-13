import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/auth/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { type LoginInput, loginSchema } from './dto/login.dto.js';
import { type RefreshInput, refreshSchema } from './dto/refresh.dto.js';
import { type SignupInput, signupSchema } from './dto/signup.dto.js';
import { AuthService, type AuthResult } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.signup(body, this.sessionContext(req));
  }

  @Public()
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
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  private sessionContext(req: Request): { userAgent?: string; ip?: string } {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      ip: req.ip,
    };
  }
}
