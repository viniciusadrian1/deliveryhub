import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { loadEnv } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: string;
}

export interface SignedAccessToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokensService {
  private readonly env = loadEnv();

  constructor(private readonly jwt: JwtService) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken> {
    const token = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL,
    });
    const expiresAt = new Date(Date.now() + this.env.JWT_ACCESS_TTL * 1000);
    return { token, expiresAt };
  }
}
