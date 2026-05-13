'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Calculator, Eye, Play, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';

interface MarginBreakdown {
  sellingPriceCents: number;
  costCents: number;
  commissionCents: number;
  paymentProcessingCents: number;
  totalFeesCents: number;
  netRevenueCents: number;
  marginCents: number;
  marginPct: number;
}

interface ItemMarginRow {
  menuItemId: string;
  menuItemName: string;
  costCents: number;
  platforms: Array<{
    platformCode: string;
    platformName: string;
    configId: string;
    sellingPriceCents: number;
    breakdown: MarginBreakdown;
  }>;
}

type Strategy = 'same_gross_pct' | 'fixed_delta_cents' | 'keep_margin_pct';

interface SimulationRow {
  menuItemId: string;
  menuItemName: string;
  platforms: Array<{
    platformCode: string;
    configId: string;
    currentPriceCents: number;
    newPriceCents: number | null;
    currentMarginPct: number;
    newMarginPct: number | null;
    belowMinimum: boolean;
    impossible: boolean;
  }>;
}

interface SimulationResult {
  itemsAffected: number;
  platformsAffected: number;
  itemsBelowMinimum: number;
  itemsImpossible: number;
  rows: SimulationRow[];
}

const STRATEGY_META: Record<Strategy, { label: string; description: string; star?: boolean }> = {
  same_gross_pct: {
    label: 'Variação por %',
    description: 'Aumenta/diminui o preço atual em % igual para todas as plataformas',
  },
  fixed_delta_cents: {
    label: 'Delta fixo em centavos',
    description: 'Soma/subtrai a mesma quantia (R$) do preço atual',
  },
  keep_margin_pct: {
    label: 'Manter margem líquida',
    description:
      'Calcula preço bruto diferente por plataforma para atingir a mesma margem líquida — mesmo com taxas diferentes',
    star: true,
  },
};

export default function PricingPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [strategy, setStrategy] = useState<Strategy>('keep_margin_pct');
  const [deltaPct, setDeltaPct] = useState('5');
  const [deltaCents, setDeltaCents] = useState('200');
  const [targetMarginPct, setTargetMarginPct] = useState('35');
  const [minMarginPct, setMinMarginPct] = useState('25');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<SimulationResult | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ['pricing', storeId],
    queryFn: () =>
      api<ItemMarginRow[]>(`/pricing/items?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
  });

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      storeId,
      minMarginPct: parseFloat(minMarginPct) || undefined,
    };
    if (selectedIds.size > 0) base.menuItemIds = Array.from(selectedIds);
    if (strategy === 'same_gross_pct') return { ...base, strategy, deltaPct: parseFloat(deltaPct) };
    if (strategy === 'fixed_delta_cents')
      return { ...base, strategy, deltaCents: parseInt(deltaCents, 10) };
    return { ...base, strategy, targetMarginPct: parseFloat(targetMarginPct) };
  };

  const simulate = useMutation({
    mutationFn: async () =>
      api<SimulationResult>('/pricing/simulate', { method: 'POST', body: buildPayload() }),
    onSuccess: (r) => setPreview(r),
  });

  const apply = useMutation({
    mutationFn: async () =>
      api('/pricing/apply', {
        method: 'POST',
        body: { ...buildPayload(), skipBelowMinimum: true },
      }),
    onSuccess: () => {
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['pricing', storeId] });
    },
  });

  const totalSelected = selectedIds.size || rows.length;

  const marginTone = (pct: number): 'success' | 'warning' | 'danger' => {
    if (pct >= 35) return 'success';
    if (pct >= 20) return 'warning';
    return 'danger';
  };

  if (!storeId) {
    return <EmptyState icon={TrendingUp} title="Nenhuma loja configurada" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-start gap-2">
          <h1>Preço &amp; Margem</h1>
          <Badge variant="brand" dot>
            Diferencial
          </Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Margem líquida real por item × plataforma. O simulador calcula o preço bruto
          necessário em cada plataforma para atingir a mesma margem — comissão diferente,{' '}
          <b className="text-ink-primary">mesma margem líquida</b>.
        </p>
      </header>

      {/* Lista atual com margens */}
      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between border-b border-surface-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">
              Itens publicados
            </h2>
            <Badge variant="neutral">{rows.length}</Badge>
          </div>
          <span className="text-xs text-ink-tertiary">
            {selectedIds.size === 0
              ? 'Sem seleção · simulador aplicará em todos'
              : `${selectedIds.size} selecionado${selectedIds.size === 1 ? '' : 's'}`}
          </span>
        </header>

        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={Calculator}
              title="Sem itens publicados"
              description="Publique itens em alguma plataforma (Cardápio → plataformas) ou faça sincronização inicial em Integrações."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border-subtle text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <th className="w-10 px-5 py-2.5"></th>
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5 text-right">CMV</th>
                <th className="px-5 py-2.5">Plataforma</th>
                <th className="px-5 py-2.5 text-right">Preço</th>
                <th className="px-5 py-2.5 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.platforms.map((p, idx) => (
                  <tr
                    key={`${row.menuItemId}-${p.platformCode}`}
                    className="border-t border-surface-border-subtle/60 transition-colors hover:bg-surface-overlay/40"
                  >
                    {idx === 0 ? (
                      <td className="px-5 py-3" rowSpan={row.platforms.length}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.menuItemId)}
                          onChange={(e) => {
                            const s = new Set(selectedIds);
                            if (e.target.checked) s.add(row.menuItemId);
                            else s.delete(row.menuItemId);
                            setSelectedIds(s);
                          }}
                          className="h-4 w-4 rounded border-surface-border bg-surface-base text-brand-500"
                        />
                      </td>
                    ) : null}
                    {idx === 0 ? (
                      <td className="px-5 py-3" rowSpan={row.platforms.length}>
                        <div className="font-medium text-ink-primary">{row.menuItemName}</div>
                      </td>
                    ) : null}
                    {idx === 0 ? (
                      <td
                        className="px-5 py-3 text-right font-mono tabular text-ink-primary"
                        rowSpan={row.platforms.length}
                      >
                        {formatCents(row.costCents)}
                      </td>
                    ) : null}
                    <td className="px-5 py-3">
                      <Badge variant="neutral">{p.platformName}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular">
                      {formatCents(p.sellingPriceCents)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant={marginTone(p.breakdown.marginPct)} dot>
                        {p.breakdown.marginPct.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Simulador */}
      <section className="surface-card overflow-hidden">
        <header className="border-b border-surface-border-subtle bg-surface-base/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-ink-primary">
              Alterar preço em lote
            </h2>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">
            Aplicar em {totalSelected} {totalSelected === 1 ? 'item' : 'itens'}{' '}
            {selectedIds.size === 0 && '(todos os publicados)'}
          </p>
        </header>

        <div className="space-y-5 p-5">
          {/* Strategy cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.entries(STRATEGY_META) as [Strategy, (typeof STRATEGY_META)[Strategy]][]).map(
              ([key, meta]) => {
                const active = strategy === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStrategy(key)}
                    className={clsx(
                      'group flex flex-col rounded-xl border p-4 text-left transition-all',
                      active
                        ? 'border-brand-500 bg-brand-500/10 shadow-glow'
                        : 'border-surface-border-subtle bg-surface-base hover:border-surface-border',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'text-sm font-semibold',
                          active ? 'text-brand-300' : 'text-ink-primary',
                        )}
                      >
                        {meta.label}
                      </span>
                      {meta.star && (
                        <Badge variant="brand">⭐</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      {meta.description}
                    </p>
                  </button>
                );
              },
            )}
          </div>

          {/* Strategy params */}
          <div className="grid grid-cols-2 gap-4 border-t border-surface-border-subtle pt-5">
            {strategy === 'same_gross_pct' && (
              <Input
                label="Delta (%)"
                value={deltaPct}
                onChange={(e) => setDeltaPct(e.target.value)}
                type="number"
                step="0.1"
              />
            )}
            {strategy === 'fixed_delta_cents' && (
              <Input
                label="Delta (centavos)"
                value={deltaCents}
                onChange={(e) => setDeltaCents(e.target.value)}
                type="number"
              />
            )}
            {strategy === 'keep_margin_pct' && (
              <Input
                label="Margem-alvo (%)"
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(e.target.value)}
                type="number"
                step="0.5"
                hint="O sistema resolve o preço bruto pra cada plataforma"
              />
            )}
            <Input
              label="Margem mínima (%)"
              value={minMarginPct}
              onChange={(e) => setMinMarginPct(e.target.value)}
              type="number"
              step="0.5"
              hint="Itens abaixo serão sinalizados na pré-visualização"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-surface-border-subtle pt-5">
            <Button
              variant="secondary"
              onClick={() => simulate.mutate()}
              loading={simulate.isPending}
              leftIcon={<Eye className="h-4 w-4" />}
            >
              {simulate.isPending ? 'Calculando…' : 'Pré-visualizar'}
            </Button>
            {preview && (
              <Button
                onClick={() => {
                  if (
                    confirm(
                      `Aplicar em ${preview.itemsAffected} itens? (${preview.itemsBelowMinimum} abaixo da mínima serão pulados)`,
                    )
                  ) {
                    apply.mutate();
                  }
                }}
                loading={apply.isPending}
                leftIcon={<Play className="h-4 w-4" />}
              >
                Aplicar mudanças
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Preview */}
      {preview && (
        <section className="surface-card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle px-5 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-ink-primary">Pré-visualização</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="neutral">
                {preview.itemsAffected} itens · {preview.platformsAffected} plataformas
              </Badge>
              {preview.itemsBelowMinimum > 0 && (
                <Badge variant="warning" dot>
                  {preview.itemsBelowMinimum} abaixo da mínima
                </Badge>
              )}
              {preview.itemsImpossible > 0 && (
                <Badge variant="danger" dot>
                  {preview.itemsImpossible} impossíveis
                </Badge>
              )}
            </div>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border-subtle text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5">Plataforma</th>
                <th className="px-5 py-2.5 text-right">Atual</th>
                <th className="px-5 py-2.5 text-right">Novo</th>
                <th className="px-5 py-2.5 text-right">Antes</th>
                <th className="px-5 py-2.5 text-right">Depois</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) =>
                row.platforms.map((p) => (
                  <tr
                    key={`${row.menuItemId}-${p.platformCode}`}
                    className={clsx(
                      'border-t border-surface-border-subtle/60',
                      p.belowMinimum && 'bg-warning-soft',
                      p.impossible && 'bg-danger-soft',
                    )}
                  >
                    <td className="px-5 py-2.5 text-ink-primary">{row.menuItemName}</td>
                    <td className="px-5 py-2.5 text-ink-secondary">{p.platformCode}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular text-ink-secondary">
                      {formatCents(p.currentPriceCents)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular font-semibold text-ink-primary">
                      {p.newPriceCents === null ? '—' : formatCents(p.newPriceCents)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="text-xs text-ink-tertiary tabular">
                        {p.currentMarginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {p.newMarginPct === null ? (
                        <Badge variant="danger">impossível</Badge>
                      ) : (
                        <Badge variant={marginTone(p.newMarginPct)} dot>
                          {p.newMarginPct.toFixed(1)}%
                        </Badge>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
