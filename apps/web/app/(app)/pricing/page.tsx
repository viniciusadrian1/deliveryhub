'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
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
    if (strategy === 'same_gross_pct')
      return { ...base, strategy, deltaPct: parseFloat(deltaPct) };
    if (strategy === 'fixed_delta_cents')
      return { ...base, strategy, deltaCents: parseInt(deltaCents, 10) };
    return { ...base, strategy, targetMarginPct: parseFloat(targetMarginPct) };
  };

  const simulate = useMutation({
    mutationFn: async () => api<SimulationResult>('/pricing/simulate', { method: 'POST', body: buildPayload() }),
    onSuccess: (r) => setPreview(r),
  });

  const apply = useMutation({
    mutationFn: async () =>
      api('/pricing/apply', { method: 'POST', body: { ...buildPayload(), skipBelowMinimum: true } }),
    onSuccess: () => {
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['pricing', storeId] });
    },
  });

  const totalSelected = selectedIds.size || rows.length;

  const marginColor = (pct: number) => {
    if (pct >= 35) return 'text-status-open';
    if (pct >= 20) return 'text-status-paused';
    return 'text-status-error';
  };

  if (!storeId)
    return <p className="text-sm text-zinc-500">Crie/selecione uma loja primeiro.</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Preço &amp; Margem ⭐</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Margem líquida real por item × plataforma. Simulador resolve o preço bruto que
          mantém a mesma margem mesmo com taxas diferentes.
        </p>
      </header>

      {/* Listagem com margem atual */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <header className="flex items-center justify-between bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
          <h2 className="font-semibold">Itens publicados ({rows.length})</h2>
          <span className="text-xs text-zinc-500">
            {selectedIds.size === 0
              ? 'Sem seleção = aplicar em todos'
              : `${selectedIds.size} selecionado(s)`}
          </span>
        </header>
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">CMV</th>
              <th className="px-3 py-2">Plataforma</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Margem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.platforms.map((p, idx) => (
                <tr
                  key={`${row.menuItemId}-${p.platformCode}`}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  {idx === 0 ? (
                    <td className="px-3 py-2" rowSpan={row.platforms.length}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.menuItemId)}
                        onChange={(e) => {
                          const s = new Set(selectedIds);
                          if (e.target.checked) s.add(row.menuItemId);
                          else s.delete(row.menuItemId);
                          setSelectedIds(s);
                        }}
                      />
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td className="px-3 py-2" rowSpan={row.platforms.length}>
                      <div className="font-medium">{row.menuItemName}</div>
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td className="px-3 py-2 text-right font-mono" rowSpan={row.platforms.length}>
                      {formatCents(row.costCents)}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <Badge>{p.platformName}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCents(p.sellingPriceCents)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${marginColor(p.breakdown.marginPct)}`}>
                    {p.breakdown.marginPct.toFixed(1)}%
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </section>

      {/* Simulador */}
      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">Alterar preço em lote</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Aplicará em {totalSelected} {totalSelected === 1 ? 'item' : 'itens'}{' '}
          {selectedIds.size === 0 && '(todos)'}
        </p>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={strategy === 'same_gross_pct'}
              onChange={() => setStrategy('same_gross_pct')}
            />
            Aumentar/diminuir preço atual por %
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={strategy === 'fixed_delta_cents'}
              onChange={() => setStrategy('fixed_delta_cents')}
            />
            Somar/subtrair valor fixo em centavos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={strategy === 'keep_margin_pct'}
              onChange={() => setStrategy('keep_margin_pct')}
            />
            ⭐ Manter mesma margem líquida em todas as plataformas
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
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
            />
          )}
          <Input
            label="Margem mínima — abaixo vai marcar"
            value={minMarginPct}
            onChange={(e) => setMinMarginPct(e.target.value)}
            type="number"
            step="0.5"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={() => simulate.mutate()} disabled={simulate.isPending}>
            {simulate.isPending ? 'Calculando…' : 'Pré-visualizar →'}
          </Button>
          {preview && (
            <Button
              variant="primary"
              onClick={() => {
                if (
                  confirm(
                    `Aplicar em ${preview.itemsAffected} itens? (descarta ${preview.itemsBelowMinimum} abaixo da mínima)`,
                  )
                ) {
                  apply.mutate();
                }
              }}
              disabled={apply.isPending}
            >
              {apply.isPending ? 'Aplicando…' : 'Aplicar (skip < mínima)'}
            </Button>
          )}
        </div>
      </section>

      {/* Pré-visualização */}
      {preview && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <header className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
            <h2 className="font-semibold">Pré-visualização</h2>
            <div className="flex gap-3 text-xs">
              <span>itens: {preview.itemsAffected}</span>
              <span>plataformas: {preview.platformsAffected}</span>
              <span className="text-status-paused">
                abaixo da mínima: {preview.itemsBelowMinimum}
              </span>
              <span className="text-status-error">impossíveis: {preview.itemsImpossible}</span>
            </div>
          </header>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Plataforma</th>
                <th className="px-3 py-2 text-right">Atual</th>
                <th className="px-3 py-2 text-right">Novo</th>
                <th className="px-3 py-2 text-right">Margem antes</th>
                <th className="px-3 py-2 text-right">Margem depois</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) =>
                row.platforms.map((p) => (
                  <tr
                    key={`${row.menuItemId}-${p.platformCode}`}
                    className={`border-t border-zinc-100 dark:border-zinc-800 ${
                      p.belowMinimum ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                    } ${p.impossible ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                  >
                    <td className="px-3 py-2">{row.menuItemName}</td>
                    <td className="px-3 py-2">{p.platformCode}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCents(p.currentPriceCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {p.newPriceCents === null ? '—' : formatCents(p.newPriceCents)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${marginColor(p.currentMarginPct)}`}>
                      {p.currentMarginPct.toFixed(1)}%
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        p.newMarginPct === null ? 'text-status-error' : marginColor(p.newMarginPct)
                      }`}
                    >
                      {p.newMarginPct === null ? 'impossível' : `${p.newMarginPct.toFixed(1)}%`}
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
