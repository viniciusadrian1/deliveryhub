import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('healthz')
  liveness() {
    return { status: 'ok' };
  }

  @Get('readyz')
  readiness() {
    // Sprint 2 (US-10.6 expansion) injetará checks de Postgres e Redis aqui.
    return { status: 'ok' };
  }
}
