import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { type LoginInput, loginSchema } from './dto/login.dto.js';
import { type SignupInput, signupSchema } from './dto/signup.dto.js';
import { AuthService, type AuthResult } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<AuthResult> {
    return this.auth.signup(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResult> {
    return this.auth.login(body);
  }
}
