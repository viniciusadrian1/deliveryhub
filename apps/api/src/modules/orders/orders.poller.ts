import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AdapterApiError } from '@deliveryhub/ifood';
import type { PlatformCode } from '@deliveryhub/shared';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { OrdersService } from './orders.service.js';

/**
 * Cron de **polling de eventos** para plataformas que suportam (hoje só iFood).
 *
 * iFood "Distribuído" não envia webhook proativamente em todos os fluxos;
 * o padrão recomendado é fazer GET periódico em `/order/v1.0/events:polling`
 * e devolver ack após processar. Roda a cada 30s:
 *
 *   1. Lista PlatformConnection com `status = active`
 *   2. Pra cada conexão:
 *      a. Lê tokens do vault
 *      b. Se expirar em <1min, faz `adapter.refreshAuth` e salva de volta
 *      c. Chama `adapter.pollEvents(tokens, merchantId)`
 *      d. Pra cada evento: `orders.ingestFromWebhook(...)`  (reaproveita pipeline)
 *      e. Ack dos eventos que foram processados com sucesso
 *      f. Atualiza `lastSyncAt` na conexão
 *
 * Falha em uma conexão NÃO impede as outras de rodarem (try/catch isola).
 *
 * Em deploy com múltiplas réplicas, este cron deve ficar SÓ no processo
 * `MODE=worker` (configurável via env) — por ora, plano free tier roda
 * uma instância só e o `webhookEvent` UNIQUE protege contra dupla ingestão.
 */
@Injectable()
export class OrdersPoller {
  private readonly logger = new Logger(OrdersPoller.name);
  /** Margem antes da expiração pra renovar o token preventivamente. */
  private readonly TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly integrations: IntegrationsService,
    private readonly orders: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    let connections: Array<{
      id: string;
      externalMerchantId: string | null;
      platform: { code: string };
    }>;
    try {
      connections = await this.prisma.platformConnection.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          externalMerchantId: true,
          platform: { select: { code: true } },
        },
      });
    } catch (err) {
      this.logger.error({ err }, 'poller_db_query_failed');
      return;
    }

    if (connections.length === 0) return;

    // Sequencial mesmo — cada poll é leve e em paralelo poderia
    // estourar rate limit das plataformas. Se ficar lento dá pra usar
    // Promise.all com limite de concorrência depois.
    for (const conn of connections) {
      await this.pollOne(conn).catch((err) => {
        this.logger.error(
          { err, connectionId: conn.id, platform: conn.platform.code },
          'poller_connection_failed',
        );
      });
    }
  }

  private async pollOne(conn: {
    id: string;
    externalMerchantId: string | null;
    platform: { code: string };
  }): Promise<void> {
    if (!conn.externalMerchantId) return;
    const platformCode = conn.platform.code as PlatformCode;

    const adapter = this.registry.get(platformCode);
    let tokens = await this.integrations.getTokens(conn.id);
    if (!tokens) {
      this.logger.warn({ connectionId: conn.id }, 'poller_no_tokens');
      return;
    }

    // Refresh preventivo: se expira em menos de 1 minuto, renova já.
    if (tokens.expiresAt.getTime() - Date.now() < this.TOKEN_REFRESH_MARGIN_MS) {
      try {
        tokens = await adapter.refreshAuth(tokens.refreshToken);
        await this.integrations.saveTokens(conn.id, tokens);
        this.logger.debug({ connectionId: conn.id }, 'poller_refreshed_tokens');
      } catch (err) {
        // Refresh falhou — marca a conexão como erro e pula este ciclo.
        await this.markConnectionError(conn.id, err);
        return;
      }
    }

    let events;
    try {
      events = await adapter.pollEvents(tokens, conn.externalMerchantId);
    } catch (err) {
      // 401: token foi revogado externamente. Marca erro.
      if (err instanceof AdapterApiError && err.status === 401) {
        await this.markConnectionError(conn.id, err);
        return;
      }
      throw err;
    }

    if (events.length === 0) {
      // Mesmo sem eventos, atualiza lastSyncAt pra mostrar "vivo" no painel.
      await this.touchLastSync(conn.id);
      return;
    }

    this.logger.log(
      { connectionId: conn.id, count: events.length },
      'poller_events_received',
    );

    const processed: string[] = [];
    for (const evt of events) {
      try {
        await this.orders.ingestFromWebhook(
          platformCode,
          evt.externalOrderId,
          evt.externalMerchantId,
          evt.eventType,
        );
        processed.push(evt.eventId);
      } catch (err) {
        // Não acka um evento que falhou — iFood vai reentregar no próximo poll.
        this.logger.error(
          { err, connectionId: conn.id, eventId: evt.eventId },
          'poller_event_ingest_failed',
        );
      }
    }

    if (processed.length > 0) {
      try {
        await adapter.acknowledgeEvents(tokens, processed);
      } catch (err) {
        // Ack falhou — eventos virão de novo no próximo poll. Idempotência
        // do webhookEvent UNIQUE protege contra reprocessamento.
        this.logger.error(
          { err, connectionId: conn.id, count: processed.length },
          'poller_ack_failed',
        );
      }
    }

    await this.touchLastSync(conn.id);
  }

  private async touchLastSync(connectionId: string): Promise<void> {
    await this.prisma.platformConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });
  }

  private async markConnectionError(connectionId: string, err: unknown): Promise<void> {
    const message =
      err instanceof Error ? err.message : 'unknown_error_during_poll';
    try {
      await this.prisma.platformConnection.update({
        where: { id: connectionId },
        data: {
          status: 'error',
          lastErrorAt: new Date(),
          lastErrorMessage: message.slice(0, 500),
        },
      });
      this.logger.warn(
        { connectionId, message: message.slice(0, 200) },
        'poller_marked_error',
      );
    } catch (updErr) {
      this.logger.error({ err: updErr, connectionId }, 'poller_mark_error_failed');
    }
  }
}
