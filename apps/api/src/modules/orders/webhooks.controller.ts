import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  DidifoodAdapter,
  type DidifoodActionRequest,
  type DidifoodDeliveryStatus,
} from '@deliveryhub/didifood';
import { KeetaAdapter } from '@deliveryhub/keeta';
import type { PlatformCode } from '@deliveryhub/shared';

import { Public } from '../../common/auth/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { OrdersService } from './orders.service.js';
import { PlatformActionRequestsService } from './platform-action-requests.service.js';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly orders: OrdersService,
    private readonly actionRequests: PlatformActionRequestsService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Public()
  @Post('ifood')
  @HttpCode(200)
  async ifoodWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('ifood', req);
  }

  @Public()
  @Post('rappi')
  @HttpCode(200)
  async rappiWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('rappi', req);
  }

  @Public()
  @Post('ubereats')
  @HttpCode(200)
  async ubereatsWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('ubereats', req);
  }

  @Public()
  @Post('aiqfome')
  @HttpCode(200)
  async aiqfomeWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('aiqfome', req);
  }

  @Public()
  @Post('99food')
  @HttpCode(200)
  async didifoodWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('99food', req);
  }

  @Public()
  @Post('keeta')
  @HttpCode(200)
  async keetaWebhook(@Req() req: Request & { rawBody?: Buffer }): Promise<{ status: string }> {
    return this.handle('keeta', req);
  }

  /** Keeta 1301 — nova autorização de loja (webhook /webhook/authorization). */
  @Public()
  @Post('keeta/authorization')
  @HttpCode(200)
  async keetaAuthorization(
    @Req() req: Request & { rawBody?: Buffer },
  ): Promise<{ status: string }> {
    return this.handleKeetaAuth('authorization', req);
  }

  /** Keeta 1302 — desautorização de loja. */
  @Public()
  @Post('keeta/deauthorization')
  @HttpCode(200)
  async keetaDeauthorization(
    @Req() req: Request & { rawBody?: Buffer },
  ): Promise<{ status: string }> {
    return this.handleKeetaAuth('deauthorization', req);
  }

  private async handle(
    platformCode: PlatformCode,
    req: Request & { rawBody?: Buffer },
  ): Promise<{ status: string }> {
    const adapter = this.registry.get(platformCode);
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const headers = req.headers as Record<string, string>;

    // ── Captura de payload bruto ──────────────────────────────────
    // Logamos TODA requisição de webhook (headers + body) ANTES da
    // verificação de assinatura. Isso é essencial pra implementar o
    // adapter de uma plataforma nova: dispara um pedido de teste no
    // sandbox da plataforma e o formato real aparece nos logs.
    // Headers de autenticação são redatados; o resto (incluindo o
    // header de assinatura, que QUEREMOS ver) é mantido.
    this.logger.log(
      {
        platformCode,
        headers: redactHeaders(headers),
        bodyPreview: rawBody.toString('utf8').slice(0, 4096),
        bodyBytes: rawBody.length,
      },
      'webhook_received',
    );

    if (!adapter.verifyWebhookSignature(headers, rawBody)) {
      this.logger.warn({ platformCode }, 'webhook_invalid_signature');
      throw new UnauthorizedException('invalid_signature');
    }

    // ── 99Food: cancelamento/reembolso pedido pelo cliente ────────
    // Têm fluxo próprio (apply_id, lista de motivos) e NÃO viram evento
    // de status de pedido. A idempotência fica no PlatformActionRequest.
    if (adapter instanceof DidifoodAdapter) {
      let action: DidifoodActionRequest | null = null;
      try {
        action = adapter.parseActionRequest(req.body, rawBody);
      } catch (err) {
        this.logger.warn({ err, platformCode }, 'webhook_action_parse_failed');
        return { status: 'ignored' };
      }
      if (action) {
        try {
          await this.actionRequests.ingestFromWebhook(platformCode, action);
          return { status: 'processed' };
        } catch (err) {
          this.logger.error({ err, platformCode }, 'webhook_action_processing_failed');
          return { status: 'error' };
        }
      }

      // Webhook deliveryStatus (Logistics) — progresso do entregador.
      let delivery: DidifoodDeliveryStatus | null = null;
      try {
        delivery = adapter.parseDeliveryStatus(req.body, rawBody);
      } catch (err) {
        this.logger.warn({ err, platformCode }, 'webhook_delivery_parse_failed');
        return { status: 'ignored' };
      }
      if (delivery) {
        try {
          await this.orders.ingestDeliveryStatus(platformCode, delivery);
          return { status: 'processed' };
        } catch (err) {
          this.logger.error({ err, platformCode }, 'webhook_delivery_processing_failed');
          return { status: 'error' };
        }
      }
    }

    let envelope;
    try {
      // Passamos o rawBody: plataformas com IDs long 64-bit (99Food)
      // precisam dele pra extrair os IDs sem perda de precisão.
      envelope = adapter.parseWebhook(req.body, rawBody);
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

  /**
   * Webhooks de autorização/desautorização do Keeta (1301/1302). Loga o corpo
   * cru ANTES de tudo (pra capturar o formato real), verifica a assinatura e
   * delega pro IntegrationsService ativar/revogar a conexão.
   */
  private async handleKeetaAuth(
    kind: 'authorization' | 'deauthorization',
    req: Request & { rawBody?: Buffer },
  ): Promise<{ status: string }> {
    let adapter;
    try {
      adapter = this.registry.get('keeta');
    } catch {
      return { status: 'ignored' };
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const headers = req.headers as Record<string, string>;

    this.logger.log(
      {
        platformCode: 'keeta',
        kind,
        headers: redactHeaders(headers),
        bodyPreview: rawBody.toString('utf8').slice(0, 4096),
        bodyBytes: rawBody.length,
      },
      'keeta_auth_webhook_received',
    );

    if (!adapter.verifyWebhookSignature(headers, rawBody)) {
      this.logger.warn({ kind }, 'keeta_auth_invalid_signature');
      throw new UnauthorizedException('invalid_signature');
    }
    if (!(adapter instanceof KeetaAdapter)) return { status: 'ignored' };

    try {
      if (kind === 'authorization') {
        const parsed = adapter.parseAuthorization(req.body, rawBody);
        if (!parsed) return { status: 'ignored' };
        await this.integrations.handleKeetaAuthorization(parsed.authId);
      } else {
        const parsed = adapter.parseDeauthorization(req.body, rawBody);
        if (!parsed) return { status: 'ignored' };
        await this.integrations.handleKeetaDeauthorization(parsed.merchantId);
      }
      return { status: 'processed' };
    } catch (err) {
      this.logger.error({ err, kind }, 'keeta_auth_processing_failed');
      return { status: 'error' };
    }
  }
}

/**
 * Redata headers sensíveis (Authorization, cookies) mas PRESERVA os
 * headers de assinatura de webhook — eles são justamente o que
 * precisamos inspecionar pra implementar `verifyWebhookSignature`.
 */
function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const redactKeys = new Set(['authorization', 'cookie', 'proxy-authorization']);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = redactKeys.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}
