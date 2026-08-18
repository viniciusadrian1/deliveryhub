import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

/**
 * Agregações para o dashboard financeiro. Calcula tudo on-demand via
 * SQL agregado — escala MVP justifica simplicidade. Materialized views
 * entram quando volumetria exigir (ver ADR-0003 análogo).
 */
@Injectable()
export class FinancialDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(auth: AuthContext, storeId: string, from: Date, to: Date) {
    await this.assertStore(auth.orgId, storeId);
    const result = await this.prisma.order.aggregate({
      where: {
        organizationId: auth.orgId,
        storeId,
        status: { not: 'cancelled' },
        placedAt: { gte: from, lte: to },
      },
      _sum: {
        totalCents: true,
        netCents: true,
        platformFeeCents: true,
        processingFeeCents: true,
        flatFeeCents: true,
      },
      _avg: { totalCents: true },
      _count: { _all: true },
    });

    const revenueGross = Number(result._sum.totalCents ?? 0);
    const revenueNet = Number(result._sum.netCents ?? 0);
    const totalFees =
      Number(result._sum.platformFeeCents ?? 0) +
      Number(result._sum.processingFeeCents ?? 0) +
      Number(result._sum.flatFeeCents ?? 0);

    return {
      from,
      to,
      orderCount: result._count._all,
      revenueGrossCents: revenueGross,
      revenueNetCents: revenueNet,
      totalFeesCents: totalFees,
      avgTicketCents: Math.round(Number(result._avg.totalCents ?? 0)),
    };
  }

  async dailySeries(auth: AuthContext, storeId: string, from: Date, to: Date) {
    await this.assertStore(auth.orgId, storeId);
    // GROUP BY data — usamos raw SQL pois Prisma não tem aggregate por dia nativo.
    const rows = await this.prisma.$queryRaw<
      { day: Date; orders: bigint; gross_cents: bigint; net_cents: bigint }[]
    >`
      SELECT
        -- placed_at é timestamp sem tz guardando UTC; converte pro dia local (BRT)
        -- antes de truncar, senão pedidos do jantar caem no dia UTC seguinte.
        date_trunc('day', placed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date AS day,
        COUNT(*)::bigint              AS orders,
        SUM(total_cents)::bigint      AS gross_cents,
        SUM(net_cents)::bigint        AS net_cents
      FROM "order"
      WHERE organization_id = ${auth.orgId}
        AND store_id = ${storeId}
        AND status <> 'cancelled'
        AND placed_at >= ${from}
        AND placed_at <= ${to}
      GROUP BY day
      ORDER BY day ASC
    `;

    return rows.map((r) => ({
      day: r.day,
      orderCount: Number(r.orders),
      revenueGrossCents: Number(r.gross_cents),
      revenueNetCents: Number(r.net_cents),
    }));
  }

  async topItemsByMargin(
    auth: AuthContext,
    storeId: string,
    from: Date,
    to: Date,
    limit: number,
  ) {
    await this.assertStore(auth.orgId, storeId);
    // Margem por item de pedido = (unit_price - menu_item.cost_cents) * qty
    // Items sem menu_item_id (matching falhou) entram com cost=0.
    const rows = await this.prisma.$queryRaw<
      {
        menu_item_id: string | null;
        name: string;
        sold: bigint;
        gross_cents: bigint;
        margin_cents: bigint;
      }[]
    >`
      SELECT
        oi.menu_item_id,
        MAX(oi.name_snapshot)            AS name,
        SUM(oi.qty)::bigint              AS sold,
        SUM(oi.total_cents)::bigint      AS gross_cents,
        SUM(
          (oi.unit_price_cents - COALESCE(mi.cost_cents, 0)) * oi.qty
        )::bigint                        AS margin_cents
      FROM order_item oi
      INNER JOIN "order" o ON o.id = oi.order_id
      LEFT JOIN menu_item mi ON mi.id = oi.menu_item_id
      WHERE o.organization_id = ${auth.orgId}
        AND o.store_id = ${storeId}
        AND o.status <> 'cancelled'
        AND o.placed_at >= ${from}
        AND o.placed_at <= ${to}
      GROUP BY oi.menu_item_id
      ORDER BY margin_cents DESC NULLS LAST
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      menuItemId: r.menu_item_id,
      name: r.name,
      sold: Number(r.sold),
      grossRevenueCents: Number(r.gross_cents),
      marginCents: Number(r.margin_cents),
    }));
  }

  async revenueByPlatform(auth: AuthContext, storeId: string, from: Date, to: Date) {
    await this.assertStore(auth.orgId, storeId);
    const rows = await this.prisma.$queryRaw<
      {
        code: string;
        name: string;
        color_hex: string;
        orders: bigint;
        gross_cents: bigint;
        net_cents: bigint;
      }[]
    >`
      SELECT
        p.code,
        p.name,
        p.color_hex,
        COUNT(o.id)::bigint           AS orders,
        SUM(o.total_cents)::bigint    AS gross_cents,
        SUM(o.net_cents)::bigint      AS net_cents
      FROM "order" o
      INNER JOIN platform p ON p.id = o.platform_id
      WHERE o.organization_id = ${auth.orgId}
        AND o.store_id = ${storeId}
        AND o.status <> 'cancelled'
        AND o.placed_at >= ${from}
        AND o.placed_at <= ${to}
      GROUP BY p.code, p.name, p.color_hex
      ORDER BY gross_cents DESC
    `;

    const totalGross = rows.reduce((acc, r) => acc + Number(r.gross_cents), 0);

    return rows.map((r) => ({
      platformCode: r.code,
      platformName: r.name,
      colorHex: r.color_hex,
      orderCount: Number(r.orders),
      revenueGrossCents: Number(r.gross_cents),
      revenueNetCents: Number(r.net_cents),
      sharePct:
        totalGross > 0
          ? Math.round((Number(r.gross_cents) / totalGross) * 10_000) / 100
          : 0,
    }));
  }

  private async assertStore(orgId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('store_not_found');
  }
}
