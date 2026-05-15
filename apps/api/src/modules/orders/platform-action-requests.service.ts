import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DidifoodAdapter, type DidifoodActionRequest } from '@deliveryhub/didifood';
import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ResolveActionRequestInput } from './dto/orders.dto.js';
import { OrdersEmitter } from './orders.emitter.js';

/**
 * Pedidos de ação do cliente — cancelamento e reembolso abertos via
 * atendimento da plataforma (hoje só 99Food). A loja aprova ou recusa,
 * e a decisão é enviada de volta à plataforma pelo adapter.
 */
@Injectable()
export class PlatformActionRequestsService {
  private readonly logger = new Logger(PlatformActionRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly integrations: IntegrationsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditLogService,
    private readonly emitter: OrdersEmitter,
  ) {}

  /**
   * Ingestão do webhook orderCancelApply / orderRefundApply.
   * Idempotente: o webhook é reenviado várias vezes com o mesmo apply_id
   * — só registramos (e notificamos) na primeira ocorrência.
   */
  async ingestFromWebhook(
    platformCode: PlatformCode,
    action: DidifoodActionRequest,
  ): Promise<void> {
    const platform = await this.prisma.platform.findUnique({
      where: { code: platformCode },
    });
    if (!platform) return;

    const connection = await this.prisma.platformConnection.findFirst({
      where: {
        platformId: platform.id,
        externalMerchantId: action.externalMerchantId,
        status: 'active',
      },
    });
    if (!connection) {
      this.logger.warn(
        { platformCode, merchant: action.externalMerchantId },
        'action_request_no_connection',
      );
      return;
    }

    // Idempotência — UNIQUE (platformId, externalApplyId).
    const existing = await this.prisma.platformActionRequest.findUnique({
      where: {
        platformId_externalApplyId: {
          platformId: platform.id,
          externalApplyId: action.applyId,
        },
      },
      select: { id: true },
    });
    if (existing) return;

    // Casa com o pedido local (pode não existir — request fica órfã mas
    // ainda resolvível, já que o adapter só precisa de order_id + apply_id).
    const order = await this.prisma.order.findUnique({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: action.externalOrderId,
        },
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        totalCents: true,
        netCents: true,
        placedAt: true,
      },
    });

    const request = await this.prisma.platformActionRequest.create({
      data: {
        organizationId: connection.organizationId,
        storeId: connection.storeId,
        platformId: platform.id,
        orderId: order?.id ?? null,
        kind: action.kind,
        externalOrderId: action.externalOrderId,
        externalApplyId: action.applyId,
        customerReason: action.customerReason ?? null,
        reasonOptions: action.reasonOptions as never,
        evidenceImages:
          action.images.length > 0 ? (action.images as never) : undefined,
      },
    });

    const label = action.kind === 'cancellation' ? 'cancelamento' : 'reembolso';
    const targets = await this.prisma.membership.findMany({
      where: {
        organizationId: connection.organizationId,
        role: { in: ['owner', 'manager'] },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const t of targets) {
      await this.notifications.create({
        userId: t.userId,
        organizationId: connection.organizationId,
        kind: 'order_action_request',
        title: `Pedido de ${label} — ${platformCode}`,
        body: action.customerReason
          ? `Cliente: "${action.customerReason}"`
          : `O cliente solicitou ${label} de um pedido.`,
        linkUrl: order ? `/hub?order=${order.id}` : '/hub',
        metadata: { actionRequestId: request.id, kind: action.kind },
        email: t.user.email,
      });
    }

    // Atualiza o Hub em tempo real — card ganha o selo, drawer mostra o banner.
    if (order) {
      this.emitter.emit({
        event: 'order.updated',
        organizationId: connection.organizationId,
        storeId: connection.storeId,
        orderId: order.id,
        status: order.status,
        externalId: order.externalId,
        platformCode,
        totalCents: order.totalCents,
        netCents: order.netCents,
        placedAt: order.placedAt,
      });
    }
  }

  /**
   * Aprova ou recusa um pedido de cancelamento/reembolso e envia a
   * decisão de volta à plataforma. Ao recusar um reembolso, a plataforma
   * exige um motivo da lista (`baseReasonId` + `baseReason`).
   */
  async resolve(auth: AuthContext, id: string, input: ResolveActionRequestInput) {
    const request = await this.prisma.platformActionRequest.findFirst({
      where: { id, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!request) throw new NotFoundException('action_request_not_found');
    if (request.status !== 'pending') {
      throw new BadRequestException('action_request_already_resolved');
    }

    let refusal:
      | { baseReasonId: string; baseReason: string; customReason?: string }
      | undefined;
    if (request.kind === 'refund' && !input.approve) {
      if (!input.baseReasonId || !input.baseReason) {
        throw new BadRequestException('refund_refusal_reason_required');
      }
      refusal = {
        baseReasonId: input.baseReasonId,
        baseReason: input.baseReason,
        customReason: input.reason,
      };
    }

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      request.storeId,
      request.platformId,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(request.platform.code as PlatformCode);
    if (!(adapter instanceof DidifoodAdapter)) {
      throw new BadRequestException('action_request_unsupported');
    }

    try {
      if (request.kind === 'cancellation') {
        await adapter.handleCancellationRequest(
          conn.tokens,
          request.externalOrderId,
          request.externalApplyId,
          input.approve,
          input.reason,
        );
      } else {
        await adapter.handleRefundRequest(
          conn.tokens,
          request.externalOrderId,
          request.externalApplyId,
          input.approve,
          refusal,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'action_request_failed';
      this.logger.error({ err, requestId: request.id }, 'action_request_resolve_failed');
      throw new BadRequestException(message.slice(0, 200));
    }

    const updated = await this.prisma.platformActionRequest.update({
      where: { id: request.id },
      data: {
        status: input.approve ? 'approved' : 'declined',
        resolvedByUserId: auth.userId,
        resolvedReason: input.baseReason ?? input.reason ?? null,
        resolvedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'platform_action_request',
      entityId: request.id,
      action: 'update',
      diff: {
        kind: request.kind,
        decision: input.approve ? 'approved' : 'declined',
      },
    });

    return updated;
  }
}
