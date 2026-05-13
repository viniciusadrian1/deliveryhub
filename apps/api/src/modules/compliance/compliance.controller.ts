import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { ConsentService } from './consent.service.js';
import { LgpdService } from './lgpd.service.js';

@Controller('me')
export class ComplianceController {
  constructor(
    private readonly lgpd: LgpdService,
    private readonly consent: ConsentService,
  ) {}

  @Get('data-export')
  exportMyData(@CurrentUser() auth: AuthContext, @Req() req: Request) {
    return this.lgpd.exportUserData(auth, this.session(req));
  }

  @Post('anonymize')
  @HttpCode(204)
  async anonymize(@CurrentUser() auth: AuthContext, @Req() req: Request): Promise<void> {
    await this.lgpd.anonymizeUser(auth, this.session(req));
  }

  @Get('consents')
  myConsents(@CurrentUser() auth: AuthContext) {
    return this.consent.historyFor('user', auth.userId);
  }

  private session(req: Request): { ip?: string; userAgent?: string } {
    const ua = req.headers['user-agent'];
    return {
      ip: req.ip,
      userAgent: typeof ua === 'string' ? ua : undefined,
    };
  }
}
