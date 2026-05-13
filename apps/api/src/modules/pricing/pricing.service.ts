import { Injectable, NotFoundException } from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import type { ApplyBatchInput, SimulateBatchInput } from './dto/pricing.dto.js';
import {
  applyFixedDelta,
  applyPercentDelta,
  calculateMargin,
  type FeeInputs,
  type MarginBreakdown,
  priceToHitMargin,
} from './margin.calculator.js';

export interface ItemMarginRow {
  menuItemId: string;
  menuItemName: string;
  costCents: number;
  categoryId: string | null;
  platforms: Array<{
    platformCode: PlatformCode;
    platformName: string;
    configId: string;
    sellingPriceCents: number;
    fees: FeeInputs;
    breakdown: MarginBreakdown;
  }>;
}

export interface SimulationRow {
  menuItemId: string;
  menuItemName: string;
  platforms: Array<{
    platformCode: PlatformCode;
    configId: string;
    currentPriceCents: number;
    newPriceCents: number | null;
    currentMarginPct: number;
    newMarginPct: number | null;
    belowMinimum: boolean;
    impossible: boolean;
  }>;
}

export interface SimulationResult {
  itemsAffected: number;
  platformsAffected: number;
  itemsBelowMinimum: number;
  itemsImpossible: number;
  rows: SimulationRow[];
}

export interface ApplyResult {
  applied: number;
  skipped: number;
  rows: Array<{ configId: string; oldPriceCents: number; newPriceCents: number }>;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Lista todos os itens da loja com a margem calculada por plataforma. */
  async listMargin(
    auth: AuthContext,
    storeId: string,
    categoryId?: string,
  ): Promise<ItemMarginRow[]> {
    await this.assertStore(auth.orgId, storeId);
    const rows = await this.loadRows(auth.orgId, storeId, undefined, undefined, categoryId);
    return rows.map((r) => this.toMarginRow(r));
  }

  async simulate(auth: AuthContext, input: SimulateBatchInput): Promise<SimulationResult> {
    await this.assertStore(auth.orgId, input.storeId);
    const rows = await this.loadRows(
      auth.orgId,
      input.storeId,
      input.menuItemIds,
      input.platformCodes,
    );

    const simRows: SimulationRow[] = [];
    let itemsBelowMinimum = 0;
    let itemsImpossible = 0;
    const platformsTouched = new Set<string>();

    for (const r of rows) {
      const platforms = r.configs.map((c) => {
        const fees: FeeInputs = c.fees;
        const current = calculateMargin({
          sellingPriceCents: c.sellingPriceCents,
          costCents: r.costCents,
          ...fees,
        });

        const newPrice = this.computeNewPrice(input, c.sellingPriceCents, r.costCents, fees);
        let newPct: number | null = null;
        let belowMinimum = false;
        const impossible = newPrice === null;

        if (newPrice !== null) {
          const after = calculateMargin({
            sellingPriceCents: newPrice,
            costCents: r.costCents,
            ...fees,
          });
          newPct = after.marginPct;
          if (input.minMarginPct !== undefined && after.marginPct < input.minMarginPct) {
            belowMinimum = true;
          }
          platformsTouched.add(c.platformCode);
        }

        return {
          platformCode: c.platformCode,
          configId: c.configId,
          currentPriceCents: c.sellingPriceCents,
          newPriceCents: newPrice,
          currentMarginPct: current.marginPct,
          newMarginPct: newPct,
          belowMinimum,
          impossible,
        };
      });

      if (platforms.some((p) => p.belowMinimum)) itemsBelowMinimum++;
      if (platforms.some((p) => p.impossible)) itemsImpossible++;

      simRows.push({
        menuItemId: r.menuItemId,
        menuItemName: r.menuItemName,
        platforms,
      });
    }

    return {
      itemsAffected: simRows.length,
      platformsAffected: platformsTouched.size,
      itemsBelowMinimum,
      itemsImpossible,
      rows: simRows,
    };
  }

  async apply(auth: AuthContext, input: ApplyBatchInput): Promise<ApplyResult> {
    const sim = await this.simulate(auth, input);

    const updates: Array<{
      configId: string;
      oldPriceCents: number;
      newPriceCents: number;
    }> = [];
    let skipped = 0;

    for (const row of sim.rows) {
      for (const p of row.platforms) {
        if (p.impossible || p.newPriceCents === null) {
          skipped++;
          continue;
        }
        if (input.skipBelowMinimum && p.belowMinimum) {
          skipped++;
          continue;
        }
        if (p.newPriceCents === p.currentPriceCents) {
          skipped++;
          continue;
        }
        updates.push({
          configId: p.configId,
          oldPriceCents: p.currentPriceCents,
          newPriceCents: p.newPriceCents,
        });
      }
    }

    if (updates.length === 0) {
      return { applied: 0, skipped, rows: [] };
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.menuItemPlatformConfig.update({
          where: { id: u.configId },
          // Não atualiza last_sync_at — a config local mudou mas a plataforma
          // remota ainda não. Aparece como "fora de sync" até o operador
          // disparar /sync-price (sprint 5).
          data: { sellingPriceCents: u.newPriceCents },
        }),
      ),
    );

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'menu_item_platform_config',
      action: 'price_change',
      diff: {
        strategy: input.strategy,
        params: this.strategyParams(input),
        applied: updates.length,
        skipped,
        sample: updates.slice(0, 10),
      },
    });

    return { applied: updates.length, skipped, rows: updates };
  }

  // ---------------- helpers ----------------

  private computeNewPrice(
    input: SimulateBatchInput,
    currentPriceCents: number,
    costCents: number,
    fees: FeeInputs,
  ): number | null {
    switch (input.strategy) {
      case 'same_gross_pct':
        return applyPercentDelta(currentPriceCents, input.deltaPct);
      case 'fixed_delta_cents':
        return applyFixedDelta(currentPriceCents, input.deltaCents);
      case 'keep_margin_pct':
        return priceToHitMargin(input.targetMarginPct, costCents, fees);
    }
  }

  private strategyParams(input: SimulateBatchInput): Record<string, unknown> {
    switch (input.strategy) {
      case 'same_gross_pct':
        return { deltaPct: input.deltaPct };
      case 'fixed_delta_cents':
        return { deltaCents: input.deltaCents };
      case 'keep_margin_pct':
        return { targetMarginPct: input.targetMarginPct };
    }
  }

  private async loadRows(
    organizationId: string,
    storeId: string,
    menuItemIds?: string[],
    platformCodes?: PlatformCode[],
    categoryId?: string,
  ) {
    const platformFilter = platformCodes ? { platform: { code: { in: platformCodes } } } : {};
    const items = await this.prisma.menuItem.findMany({
      where: {
        organizationId,
        storeId,
        archivedAt: null,
        id: menuItemIds ? { in: menuItemIds } : undefined,
        categoryId: categoryId ?? undefined,
      },
      include: {
        platformConfigs: {
          where: platformFilter,
          include: { platform: { select: { code: true, name: true, id: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Carrega taxas vigentes (effective_from <= now) por (store_id, platform_id)
    const today = new Date();
    const feeRecords = await this.prisma.platformFeeProfile.findMany({
      where: { organizationId, storeId, effectiveFrom: { lte: today } },
      orderBy: { effectiveFrom: 'desc' },
    });

    const feesByPlatform = new Map<string, FeeInputs>();
    for (const f of feeRecords) {
      if (!feesByPlatform.has(f.platformId)) {
        feesByPlatform.set(f.platformId, {
          commissionPct: Number(f.commissionPct),
          paymentProcessingPct: Number(f.paymentProcessingPct),
          flatFeeCents: Number(f.flatFeeCents),
        });
      }
    }

    return items.map((item) => ({
      menuItemId: item.id,
      menuItemName: item.name,
      costCents: item.costCents,
      categoryId: item.categoryId,
      configs: item.platformConfigs.map((c) => ({
        configId: c.id,
        platformCode: c.platform.code as PlatformCode,
        platformName: c.platform.name,
        platformId: c.platform.id,
        sellingPriceCents: c.sellingPriceCents,
        fees: feesByPlatform.get(c.platform.id) ?? {
          commissionPct: 0,
          paymentProcessingPct: 0,
          flatFeeCents: 0,
        },
      })),
    }));
  }

  private toMarginRow(
    r: Awaited<ReturnType<PricingService['loadRows']>>[number],
  ): ItemMarginRow {
    return {
      menuItemId: r.menuItemId,
      menuItemName: r.menuItemName,
      costCents: r.costCents,
      categoryId: r.categoryId,
      platforms: r.configs.map((c) => ({
        platformCode: c.platformCode,
        platformName: c.platformName,
        configId: c.configId,
        sellingPriceCents: c.sellingPriceCents,
        fees: c.fees,
        breakdown: calculateMargin({
          sellingPriceCents: c.sellingPriceCents,
          costCents: r.costCents,
          ...c.fees,
        }),
      })),
    };
  }

  private async assertStore(orgId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('store_not_found');
  }
}
