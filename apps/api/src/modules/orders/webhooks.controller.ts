import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { PlatformCode } from '@deliveryhub/shared';

import { Public } from '../../common/auth/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { OrdersService } from './orders.service.js';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly orders: OrdersService,
  ) {}

  @Public()
  @Post('ifood')
  @HttpCode(200)
  async ifoodWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('ifood', req);
  }

  private async handle(
    platformCode: PlatformCode,
    req: Request & { rawBody?: Buffer },
  ): Promise<{ status: string }> {
    const adapter = this.registry.get(platformCode);
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const headers = req.headers as Record<string, string>;

    if (!adapter.verifyWebhookSignature(headers, rawBody)) {
      throw new UnauthorizedException('invalid_signature');
    }

    let envelope;
    try {
      envelope = adapter.parseWebhook(req.body);
    } catch (err) {
      this.logger.warn({ err }, 'webhook_parse_failed');
      return { status: 'ignored' };
    }

    const platform = await this.prisma.platform.findUnique({ where: { code: platformCode } });
    if (!platform) {
      this.logger.error({ platformCode }, 'webhook_platform_not_found');
      return { status: 'ignored' };
    }

    // Idempotência: UNIQUE em (platformId, externalId) garante que duplicatas
    // resultam em P2002 — capturamos e devolvemos 200 sem reprocessar.
    try {
      await this.prisma.webhookEvent.create({
        data: {
          platformId: platform.id,
          externalId: envelope.eventId,
          eventType: envelope.eventType,
          payload: req.body as never,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        return { status: 'duplicate' };
      }
      throw err;
    }

    try {
      await this.orders.ingestFromWebhook(
        platformCode,
        envelope.externalOrderId,
        envelope.externalMerchantId,
        envelope.eventType,
      );
      await this.prisma.webhookEvent.update({
        where: { platformId_externalId: { platformId: platform.id, externalId: envelope.eventId } },
        data: { processedAt: new Date() },
      });
      return { status: 'processed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error({ err, eventId: envelope.eventId }, 'webhook_processing_failed');
      await this.prisma.webhookEvent.update({
        where: { platformId_externalId: { platformId: platform.id, externalId: envelope.eventId } },
        data: { error: message.slice(0, 500) },
      });
      return { status: 'error' };
    }
  }
}
