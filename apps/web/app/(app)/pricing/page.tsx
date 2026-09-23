'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  DollarSign,
  Eye,
  Percent,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { PlatformLogo } from '../../../components/ui/platform-logo';
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
    feesMissing: boolean;
  }>;
}

type Strategy = 'keep_margin_pct' | 'same_gross_pct' | 'fixed_delta_cents';

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

const STRATEGY_META: Record<Strategy, { label: string; description: string; icon: any }> = {
  keep_margin_pct: {
    label: 'Equalizar margem de lucro',
    description:
      'Calcula o preço de venda ideal em cada canal para obter a mesma margem líquida final, compensando as diferentes comissões.',
    icon: TrendingUp,
  },
  same_gross_pct: {
    label: 'Reajuste percentual (%)',
    description: 'Aplica um aumento ou desconto percentual diretamente sobre o preço atual em todas as plataformas.',
    icon: Percent,
  },
  fixed_delta_cents: {
    label: 'Ajuste fixo em Reais (R$)',
    description: 'Soma ou subtrai uma quantia fixa em Reais (R$) diretamente sobre o preço de venda atual.',
    icon: DollarSign,
  },
};

export default function PricingPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [strategy, setStrategy] = useState<Strategy>('keep_margin_pct');
  const [deltaPct, setDeltaPct] = useState('5');
  const [deltaReais, setDeltaReais] = useState('2,00');
  const [targetMarginPct, setTargetMarginPct] = useState('35');
  const [minMarginPct, setMinMarginPct] = useState('25');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [marginFilter, setMarginFilter] = useState<'all' | 'healthy' | 'moderate' | 'low'>('all');
  const [preview, setPreview] = useState<SimulationResult | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['pricing', storeId],
    queryFn: () =>
      api<ItemMarginRow[]>(`/pricing/items?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
  });

  // Filtragem de itens
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        if (!r.menuItemName.toLowerCase().includes(query)) return false;
      }
      if (marginFilter === 'healthy') {
        return r.platforms.some((p) => p.breakdown.marginPct >= 35);
      }
      if (marginFilter === 'moderate') {
        return r.platforms.some((p) => p.breakdown.marginPct >= 20 && p.breakdown.marginPct < 35);
      }
      if (marginFilter === 'low') {
        return r.platforms.some((p) => p.breakdown.marginPct < 20);
      }
      return true;
    });
  }, [rows, search, marginFilter]);

  const selectAll = () => {
    const all = new Set(filteredRows.map((r) => r.menuItemId));
    setSelectedIds(all);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      storeId,
      minMarginPct: parseFloat(minMarginPct) || undefined,
    };
    if (selectedIds.size > 0) base.menuItemIds = Array.from(selectedIds);
    if (strategy === 'same_gross_pct') return { ...base, strategy, deltaPct: parseFloat(deltaPct) || 0 };
    if (strategy === 'fixed_delta_cents') {
      const clean = deltaReais.replace(',', '.').replace(/[^0-9.-]/g, '');
      const parsedReais = parseFloat(clean) || 0;
      const deltaCents = Math.round(parsedReais * 100);
      return { ...base, strategy, deltaCents };
    }
    return { ...base, strategy, targetMarginPct: parseFloat(targetMarginPct) || 35 };
  };

  const simulate = useMutation({
    mutationFn: async () =>
      api<SimulationResult>('/pricing/simulate', { method: 'POST', body: buildPayload() }),
    onSuccess: (r) => {
      setPreview(r);
      const previewEl = document.getElementById('pricing-preview');
      if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth' });
    },
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
      void qc.invalidateQueries({ queryKey: ['menu', storeId] });
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
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Preço &amp; Margem</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Monitore o custo dos produtos e a margem líquida real de cada canal de delivery, considerando as comissões cobradas pelas plataformas.
          </p>
        </div>
      </header>

      {/* Tabela de Produtos Publicados */}
      <section className="surface-card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">
              Produtos cadastrados por canal
            </h2>
            <Badge variant="neutral">{filteredRows.length}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Busca rápida */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="text"
                placeholder="Buscar produto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-lg border border-surface-border bg-surface-base pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Filtro por status de margem */}
            <div className="flex rounded-lg border border-surface-border bg-surface-base p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMarginFilter('all')}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  marginFilter === 'all'
                    ? 'bg-surface-raised text-ink-primary shadow-sm'
                    : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setMarginFilter('healthy')}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  marginFilter === 'healthy'
                    ? 'bg-surface-raised text-success-bright shadow-sm'
                    : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                Saudável (≥35%)
              </button>
              <button
                type="button"
                onClick={() => setMarginFilter('low')}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  marginFilter === 'low'
                    ? 'bg-surface-raised text-danger-bright shadow-sm'
                    : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                Baixa (&lt;20%)
              </button>
            </div>

            {/* Botões de seleção em lote */}
            <div className="flex items-center gap-1">
              <Button size="xs" variant="secondary" onClick={selectAll}>
                Selecionar todos
              </Button>
              {selectedIds.size > 0 && (
                <Button size="xs" variant="ghost" onClick={clearSelection}>
                  Limpar ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </header>

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-tertiary">Carregando itens…</p>
        ) : filteredRows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={Calculator}
              title="Nenhum produto encontrado"
              description="Verifique os filtros de busca ou publique produtos nos canais de delivery no módulo de Cardápio."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border-subtle bg-surface-base/30 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  <th className="w-10 px-5 py-2.5"></th>
                  <th className="px-5 py-2.5">Item</th>
                  <th className="px-5 py-2.5 text-right">Custo (CMV)</th>
                  <th className="px-5 py-2.5">Canal</th>
                  <th className="px-5 py-2.5 text-right">Preço de Venda</th>
                  <th className="px-5 py-2.5 text-right">Margem Líquida</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) =>
                  row.platforms.map((p, idx) => (
                    <tr
                      key={`${row.menuItemId}-${p.platformCode}`}
                      className="border-t border-surface-border-subtle/60 transition-colors hover:bg-surface-overlay/40"
                    >
                      {idx === 0 ? (
                        <td className="px-5 py-3 align-top" rowSpan={row.platforms.length}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.menuItemId)}
                            onChange={(e) => {
                              const s = new Set(selectedIds);
                              if (e.target.checked) s.add(row.menuItemId);
                              else s.delete(row.menuItemId);
                              setSelectedIds(s);
                            }}
                            className="mt-1 h-4 w-4 rounded border-surface-border bg-surface-base text-brand-500"
                          />
                        </td>
                      ) : null}
                      {idx === 0 ? (
                        <td className="px-5 py-3 align-top" rowSpan={row.platforms.length}>
                          <div className="font-semibold text-ink-primary">{row.menuItemName}</div>
                          <span className="text-[11px] text-ink-tertiary">
                            {row.platforms.length} {row.platforms.length === 1 ? 'canal' : 'canais'} ativos
                          </span>
                        </td>
                      ) : null}
                      {idx === 0 ? (
                        <td
                          className="px-5 py-3 align-top text-right font-mono tabular text-ink-primary font-medium"
                          rowSpan={row.platforms.length}
                        >
                          {row.costCents > 0 ? formatCents(row.costCents) : (
                            <span className="text-xs text-ink-tertiary">Não informado</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <PlatformLogo platform={p.platformCode} size="xs" />
                          <span className="font-medium text-xs text-ink-primary">{p.platformName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular font-semibold text-ink-primary">
                        {formatCents(p.sellingPriceCents)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {p.feesMissing ? (
                          <span title="Taxas contratuais da plataforma ainda não configuradas">
                            <Badge variant="warning">Taxas pendentes</Badge>
                          </span>
                        ) : (
                          <Badge variant={marginTone(p.breakdown.marginPct)} dot>
                            {p.breakdown.marginPct.toFixed(1)}%
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ferramenta de Reajuste Inteligente em Lote */}
      <section className="surface-card overflow-hidden">
        <header className="border-b border-surface-border-subtle bg-surface-base/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-ink-primary">
              Reajuste Inteligente em Lote
            </h2>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Aplicação em {totalSelected} {totalSelected === 1 ? 'produto' : 'produtos'}{' '}
            {selectedIds.size === 0 && '(todos os cadastrados)'}
          </p>
        </header>

        <div className="space-y-5 p-5">
          {/* Seleção de Estratégia */}
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.entries(STRATEGY_META) as [Strategy, (typeof STRATEGY_META)[Strategy]][]).map(
              ([key, meta]) => {
                const active = strategy === key;
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStrategy(key)}
                    className={clsx(
                      'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all',
                      active
                        ? 'border-brand-500 bg-brand-500/10 shadow-sm'
                        : 'border-surface-border-subtle bg-surface-base hover:border-surface-border',
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon className={clsx('h-4 w-4', active ? 'text-brand-400' : 'text-ink-tertiary')} />
                        <span
                          className={clsx(
                            'text-sm font-semibold',
                            active ? 'text-brand-300' : 'text-ink-primary',
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                );
              },
            )}
          </div>

          {/* Parâmetros do Reajuste */}
          <div className="grid gap-4 sm:grid-cols-2 border-t border-surface-border-subtle pt-5">
            {strategy === 'keep_margin_pct' && (
              <Input
                label="Margem líquida desejada (%)"
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(e.target.value)}
                type="number"
                step="0.5"
                hint="O sistema calcula o preço bruto ideal para cada canal"
              />
            )}
            {strategy === 'same_gross_pct' && (
              <Input
                label="Variação percentual (%)"
                value={deltaPct}
                onChange={(e) => setDeltaPct(e.target.value)}
                type="number"
                step="0.5"
                hint="Exemplo: 5 para aumentar 5% ou -3 para reduzir 3%"
              />
            )}
            {strategy === 'fixed_delta_cents' && (
              <Input
                label="Ajuste fixo em Reais (R$)"
                value={deltaReais}
                onChange={(e) => setDeltaReais(e.target.value)}
                placeholder="2,00"
                hint="Exemplo: 2,00 para somar R$ 2,00 ou -1,50 para subtrair"
              />
            )}

            <Input
              label="Margem de segurança mínima (%)"
              value={minMarginPct}
              onChange={(e) => setMinMarginPct(e.target.value)}
              type="number"
              step="0.5"
              hint="Produtos cuja margem ficar abaixo serão alertados antes da confirmação"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2 border-t border-surface-border-subtle pt-5">
            <Button
              variant="secondary"
              onClick={() => simulate.mutate()}
              loading={simulate.isPending}
              leftIcon={<Eye className="h-4 w-4" />}
            >
              {simulate.isPending ? 'Simulando preços…' : 'Pré-visualizar simulação'}
            </Button>

            {preview && (
              <Button
                onClick={() => {
                  const belowMinWarning =
                    preview.itemsBelowMinimum > 0
                      ? ` (${preview.itemsBelowMinimum} abaixo da margem mínima serão preservados)`
                      : '';
                  if (
                    confirm(
                      `Confirmar a atualização de preços em ${preview.itemsAffected} produtos nas plataformas?${belowMinWarning}`,
                    )
                  ) {
                    apply.mutate();
                  }
                }}
                loading={apply.isPending}
                leftIcon={<Check className="h-4 w-4" />}
              >
                Aplicar novos preços
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Tabela de Pré-visualização da Simulação */}
      {preview && (
        <section id="pricing-preview" className="surface-card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle px-5 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-ink-primary">
                Resultado da Simulação
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="neutral">
                {preview.itemsAffected} produtos alterados
              </Badge>
              {preview.itemsBelowMinimum > 0 && (
                <Badge variant="warning" dot>
                  {preview.itemsBelowMinimum} abaixo da margem mínima
                </Badge>
              )}
              {preview.itemsImpossible > 0 && (
                <Badge variant="danger" dot>
                  {preview.itemsImpossible} inviáveis
                </Badge>
              )}
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border-subtle bg-surface-base/30 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  <th className="px-5 py-2.5">Item</th>
                  <th className="px-5 py-2.5">Canal</th>
                  <th className="px-5 py-2.5 text-right">Preço Atual</th>
                  <th className="px-5 py-2.5 text-right">Novo Preço</th>
                  <th className="px-5 py-2.5 text-right">Margem Atual</th>
                  <th className="px-5 py-2.5 text-right">Nova Margem</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) =>
                  row.platforms.map((p) => (
                    <tr
                      key={`${row.menuItemId}-${p.platformCode}`}
                      className={clsx(
                        'border-t border-surface-border-subtle/60 transition-colors',
                        p.belowMinimum && 'bg-warning-soft/40',
                        p.impossible && 'bg-danger-soft/40',
                      )}
                    >
                      <td className="px-5 py-2.5 font-medium text-ink-primary">
                        {row.menuItemName}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <PlatformLogo platform={p.platformCode} size="xs" />
                          <span className="text-xs text-ink-secondary capitalize">{p.platformCode}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular text-ink-secondary">
                        {formatCents(p.currentPriceCents)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular font-bold text-ink-primary">
                        {p.newPriceCents === null ? '—' : formatCents(p.newPriceCents)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="text-xs text-ink-tertiary tabular">
                          {p.currentMarginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {p.newMarginPct === null ? (
                          <Badge variant="danger">Inviável</Badge>
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
          </div>
        </section>
      )}
    </div>
  );
}
