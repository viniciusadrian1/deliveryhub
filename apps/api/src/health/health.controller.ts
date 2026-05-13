import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/auth/public.decorator.js';

@Controller()
export class HealthController {
  @Public()
  @Get('healthz')
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('readyz')
  readiness() {
    // Sprint 2+ injetará checks de Postgres e Redis aqui.
    return { status: 'ok' };
  }
}
