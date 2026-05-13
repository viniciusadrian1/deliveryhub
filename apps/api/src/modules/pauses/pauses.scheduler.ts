import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PausesService } from './pauses.service.js';

/**
 * Cron que reabre pausas com `ends_at` vencido. Roda a cada minuto.
 *
 * Em produção com múltiplas réplicas, este cron deve ficar apenas no
 * processo MODE=worker (Sprint 5+ doc); por ora a flag de ambiente
 * cuida — o gateway HTTP também executa, mas a query é idempotente
 * (reopenedAt = NOT NULL impede re-processamento).
 */
@Injectable()
export class PausesScheduler {
  private readonly logger = new Logger(PausesScheduler.name);

  constructor(private readonly pauses: PausesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runAutoReopen(): Promise<void> {
    try {
      const result = await this.pauses.reopenExpired();
      if (result.reopened > 0 || result.errors > 0) {
        this.logger.log(
          `auto_reopen: reopened=${result.reopened} errors=${result.errors}`,
        );
      }
    } catch (err) {
      this.logger.error({ err }, 'auto_reopen_unexpected_failure');
    }
  }
}
