import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from '../integrations/adapter.registry.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import type { CreatePromotionInput } from './dto/promotions.dto.js';

/** Item embutido no JSON `Promotion.items`. */
interface PromotionItemSnapshot {
  menuItemId: string;
  externalId: string;
  // externalCode real do item no catálogo da plataforma (EAN). É o que o iFood
  // usa pra casar a promoção: publish grava nosso menuItemId aqui, pull captura
  // o EAN que já existia na plataforma. Sem ele a promoção nasce morta.
  externalCode: string;
  name: string;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly integrations: IntegrationsService,
    private readonly registry: AdapterRegistry,
  ) {}

  async list(auth: AuthContext, storeId: string) {
    return this.prisma.promotion.findMany({
      where: { organizationId: auth.orgId, storeId },
      include: { platform: { select: { code: true, name: true, colorHex: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cria a promoção na plataforma (processamento assíncrono do lado dela)
   * e persiste localmente com o aggregationId pra acompanhamento.
   * Todos os itens precisam já estar publicados na plataforma (externalId).
   */
  async create(auth: AuthContext, input: CreatePromotionInput) {
    const platform = await this.prisma.platform.findUnique({
      where: { code: input.platformCode },
    });
    if (!platform) throw new NotFoundException('platform_not_found');

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      input.storeId,
      platform.id,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(input.platformCode);
    if (!adapter.createPromotion) {
      throw new BadRequestException('promotion_unsupported');
    }

    const configs = await this.prisma.menuItemPlatformConfig.findMany({
      where: {
        organizationId: auth.orgId,
        platformId: platform.id,
        menuItemId: { in: input.menuItemIds },
        // Escopo de loja: sem isso, itens de OUTRA loja da mesma org
        // passariam na validação e a promoção iria pro merchant errado.
        menuItem: { storeId: input.storeId },
      },
      include: { menuItem: { select: { id: true, name: true } } },
    });

    const byItem = new Map(configs.map((c) => [c.menuItemId, c]));
    // Exige o externalCode (EAN real no catálogo), não só o externalId (UUID do
    // catálogo). Item importado via pull tem externalId mas pode não ter EAN
    // utilizável — e sem EAN o iFood não casa a promoção. Assim itens sem código
    // real são rejeitados como não publicados em vez de gerar promoção órfã.
    const missing = input.menuItemIds.filter((id) => !byItem.get(id)?.externalCode);
    if (missing.length > 0) {
      throw new BadRequestException(
        `items_not_published_on_platform:${missing.length}`,
      );
    }

    const items: PromotionItemSnapshot[] = input.menuItemIds.map((id) => {
      const cfg = byItem.get(id)!;
      return {
        menuItemId: id,
        externalId: cfg.externalId!,
        externalCode: cfg.externalCode!,
        name: cfg.menuItem.name,
      };
    });

    // Tag única por tentativa — a plataforma exige nunca reutilizar.
    const aggregationTag = randomUUID();

    // Persiste ANTES de chamar a plataforma. Se o iFood aceitasse a promoção
    // mas o insert local falhasse depois (blip de DB), o desconto ficaria vivo
    // no iFood sem nenhuma linha local — órfão, invisível e impossível de
    // cancelar pela aplicação. Gravando primeiro (status default 'processing',
    // sem aggregationId ainda), toda tentativa fica visível via list/refresh.
    const promotion = await this.prisma.promotion.create({
      data: {
        organizationId: auth.orgId,
        storeId: input.storeId,
        platformId: platform.id,
        name: input.name,
        aggregationTag,
        discountPercent: input.discountPercent,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        items: items as unknown as object[],
      },
      include: { platform: { select: { code: true, name: true, colorHex: true } } },
    });

    let aggregationId: string;
    try {
      const result = await adapter.createPromotion(conn.tokens, conn.externalMerchantId, {
        name: input.name,
        aggregationTag,
        items: items.map((it) => ({
          // O iFood casa o item por EAN/externalCode. Enviamos o externalCode
          // real gravado no config (publish grava nosso menuItemId; pull captura
          // o EAN da plataforma). Usar o menuItemId direto quebrava itens
          // importados, cujo externalCode no iFood não é o nosso id.
          ean: it.externalCode,
          discountPercent: input.discountPercent,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        })),
      });
      aggregationId = result.aggregationId;
    } catch (err) {
      // Falhou na plataforma: marca a linha como erro (visível/limpável) em vez
      // de deixar um registro 'processing' fantasma.
      await this.prisma.promotion.update({
        where: { id: promotion.id },
        data: { status: 'error', lastError: (err as Error).message?.slice(0, 500) ?? null },
      });
      throw err;
    }

    const saved = await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: { externalAggregationId: aggregationId },
      include: { platform: { select: { code: true, name: true, colorHex: true } } },
    });

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'promotion',
      entityId: saved.id,
      action: 'create',
      diff: { name: input.name, discountPercent: input.discountPercent, items: items.length },
    });

    return saved;
  }

  /**
   * Consulta na plataforma o status de processamento dos itens da promoção
   * e atualiza o status local: algum ERROR → error; todos ACTIVE → active;
   * senão continua processing.
   */
  async refresh(auth: AuthContext, promotionId: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: promotionId, organizationId: auth.orgId },
      include: { platform: true },
    });
    if (!promotion) throw new NotFoundException('promotion_not_found');
    if (!promotion.externalAggregationId) {
      throw new BadRequestException('promotion_has_no_aggregation_id');
    }

    const conn = await this.integrations.getActiveConnectionWithTokens(
      auth.orgId,
      promotion.storeId,
      promotion.platformId,
    );
    if (!conn) throw new BadRequestException('no_active_connection');

    const adapter = this.registry.get(promotion.platform.code as PlatformCode);
    if (!adapter.fetchPromotionItems) {
      throw new BadRequestException('promotion_unsupported');
    }

    const remoteItems = await adapter.fetchPromotionItems(
      conn.tokens,
      conn.externalMerchantId,
      promotion.externalAggregationId,
    );

    const errored = remoteItems.find((it) => it.status === 'ERROR');
    const allActive =
      remoteItems.length > 0 && remoteItems.every((it) => it.status === 'ACTIVE');
    const status = errored ? 'error' : allActive ? 'active' : 'processing';

    const updated = await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        status,
        lastCheckedAt: new Date(),
        lastError: errored?.error?.slice(0, 500) ?? null,
      },
      include: { platform: { select: { code: true, name: true, colorHex: true } } },
    });

    return updated;
  }
}
