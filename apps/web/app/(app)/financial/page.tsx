'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { KpiCard } from '../../../components/ui/kpi-card';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';

interface Summary {
  orderCount: number;
  revenueGrossCents: number;
  revenueNetCents: number;
  totalFeesCents: number;
  avgTicketCents: number;
}

interface DailyPoint {
  day: string;
  orderCount: number;
  revenueGrossCents: number;
  revenueNetCents: number;
}

interface TopItem {
  menuItemId: string | null;
  name: string;
  sold: number;
  grossRevenueCents: number;
  marginCents: number;
}

interface ByPlatform {
  platformCode: string;
  platformName: string;
  colorHex: string;
  orderCount: number;
  revenueGrossCents: number;
  revenueNetCents: number;
  sharePct: number;
}

interface Payout {
  id: string;
  expectedAmountCents: number;
  receivedAmountCents: number | null;
  expectedPayDate: string | null;
  status: 'pending' | 'partial' | 'reconciled' | 'mismatch';
  referencePeriodStart: string;
  referencePeriodEnd: string;
  platform: { code: string; name: string; colorHex: string };
  bankTransaction: { id: string; description: string; amountCents: number; date: string } | null;
}

interface ReconciliationReport {
  matched: number;
  partial: number;
  mismatched: number;
  unmatched: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const STATUS_BADGE: Record<
  Payout['status'],
  { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  reconciled: { variant: 'success', label: 'Conciliado' },
  partial: { variant: 'warning', label: 'Parcial' },
  mismatch: { variant: 'danger', label: 'Divergência' },
  pending: { variant: 'neutral', label: 'Aguardando' },
};

export default function FinancialPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  const params = `storeId=${encodeURIComponent(storeId ?? '')}&from=${from}&to=${to}`;

  const { data: summary } = useQuery({
    queryKey: ['fin', 'summary', storeId, from, to],
    queryFn: () => api<Summary>(`/financial/summary?${params}`),
    enabled: !!storeId,
  });

  const { data: daily = [] } = useQuery({
    queryKey: ['fin', 'daily', storeId, from, to],
    queryFn: () => api<DailyPoint[]>(`/financial/daily?${params}`),
    enabled: !!storeId,
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ['fin', 'top', storeId, from, to],
    queryFn: () => api<TopItem[]>(`/financial/top-items?${params}&limit=5`),
    enabled: !!storeId,
  });

  const { data: byPlatform = [] } = useQuery({
    queryKey: ['fin', 'platforms', storeId, from, to],
    queryFn: () => api<ByPlatform[]>(`/financial/by-platform?${params}`),
    enabled: !!storeId,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['fin', 'payouts', storeId],
    queryFn: () => api<Payout[]>(`/payouts?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
  });

  const importCsv = useMutation({
    mutationFn: async () =>
      api<{ parsed: number; inserted: number; duplicated: number }>('/bank/import', {
        method: 'POST',
        body: { storeId, csv: csvText },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fin'] });
      setImportOpen(false);
      setCsvText('');
    },
  });

  const reconcile = useMutation({
    mutationFn: async () =>
      api<ReconciliationReport>('/reconciliation/run', {
        method: 'POST',
        body: { storeId },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fin', 'payouts'] }),
  });

  const maxDaily = Math.max(1, ...daily.map((d) => d.revenueGrossCents));

  if (!storeId) {
    return <EmptyState icon={Wallet} title="Nenhuma loja configurada" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Financeiro</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Faturamento, margem total, repasses esperados e conciliação bancária.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-ink-tertiary" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-xs font-medium text-ink-primary focus:outline-none"
            />
            <span className="text-ink-tertiary">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-xs font-medium text-ink-primary focus:outline-none"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setImportOpen(true)}
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
          >
            Importar extrato
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Faturamento bruto"
          value={formatCents(summary?.revenueGrossCents ?? 0)}
          icon={TrendingUp}
          hint={`${summary?.orderCount ?? 0} pedido${summary?.orderCount === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="Taxas pagas"
          value={formatCents(summary?.totalFeesCents ?? 0)}
          icon={Receipt}
          tone="muted"
        />
        <KpiCard
          label="Líquido pra você"
          value={formatCents(summary?.revenueNetCents ?? 0)}
          icon={PiggyBank}
          tone="success"
        />
        <KpiCard
          label="Ticket médio"
          value={formatCents(summary?.avgTicketCents ?? 0)}
          icon={BarChart3}
        />
      </section>

      {/* Daily chart */}
      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between border-b border-surface-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-ink-primary">Faturamento por dia</h2>
          </div>
          <Badge variant="neutral">{daily.length} dias</Badge>
        </header>
        <div className="p-5">
          {daily.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-tertiary">
              Sem pedidos no período selecionado.
            </p>
          ) : (
            <div className="flex items-end gap-1.5" style={{ height: 180 }}>
              {daily.map((d) => {
                const pct = (d.revenueGrossCents / maxDaily) * 100;
                return (
                  <div
                    key={d.day}
                    className="group relative flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all hover:from-brand-500 hover:to-brand-300"
                      style={{ height: `${Math.max(pct, 3)}%` }}
                      title={`${d.day}: ${formatCents(d.revenueGrossCents)} · ${d.orderCount} pedidos`}
                    />
                    <span className="text-[10px] text-ink-tertiary">
                      {new Date(d.day).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por plataforma */}
        <section className="surface-card overflow-hidden">
          <header className="border-b border-surface-border-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-ink-primary">Por plataforma</h2>
          </header>
          {byPlatform.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ink-tertiary">
              Sem dados no período.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border-subtle">
              {byPlatform.map((p) => (
                <li key={p.platformCode} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold uppercase text-white"
                    style={{ backgroundColor: p.colorHex }}
                  >
                    {p.platformName.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-primary">{p.platformName}</p>
                    <p className="text-xs text-ink-tertiary">
                      {p.orderCount} pedido{p.orderCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular text-ink-primary">
                      {formatCents(p.revenueGrossCents)}
                    </p>
                    <p className="text-xs text-ink-tertiary tabular">
                      {p.sharePct.toFixed(1)}% · líq {formatCents(p.revenueNetCents)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top itens */}
        <section className="surface-card overflow-hidden">
          <header className="flex items-center justify-between border-b border-surface-border-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-ink-primary">Top itens por margem</h2>
            <Badge variant="neutral">{topItems.length}</Badge>
          </header>
          {topItems.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ink-tertiary">
              Sem itens vendidos no período.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border-subtle">
              {topItems.map((it, idx) => (
                <li
                  key={(it.menuItemId ?? 'x') + idx}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                      idx === 0
                        ? 'bg-brand-500/20 text-brand-300'
                        : 'bg-surface-overlay text-ink-secondary',
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-primary">{it.name}</p>
                    <p className="text-xs text-ink-tertiary">
                      {it.sold} vendido{it.sold === 1 ? '' : 's'} ·{' '}
                      {formatCents(it.grossRevenueCents)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular text-success-bright">
                    {formatCents(it.marginCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Conciliação */}
      <section className="surface-card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-bright" />
            <h2 className="text-sm font-semibold text-ink-primary">Conciliação de repasses</h2>
            <Badge variant="neutral">{payouts.length}</Badge>
          </div>
          <Button
            size="sm"
            onClick={() => reconcile.mutate()}
            loading={reconcile.isPending}
            leftIcon={<Zap className="h-3.5 w-3.5" />}
          >
            Rodar conciliação
          </Button>
        </header>
        {payouts.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum repasse calculado ainda"
              description={
                'Use POST /payouts/recompute pra gerar o esperado a partir dos pedidos do período, ou importe um extrato e rode a conciliação.'
              }
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border-subtle text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <th className="px-5 py-2.5">Plataforma</th>
                <th className="px-5 py-2.5">Período</th>
                <th className="px-5 py-2.5 text-right">Esperado</th>
                <th className="px-5 py-2.5 text-right">Recebido</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const meta = STATUS_BADGE[p.status];
                const diff =
                  p.receivedAmountCents !== null
                    ? Number(p.receivedAmountCents) - Number(p.expectedAmountCents)
                    : null;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-surface-border-subtle/60 hover:bg-surface-overlay/40"
                  >
                    <td className="px-5 py-3">
                      <Badge color={p.platform.colorHex}>{p.platform.name}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-secondary">
                      {new Date(p.referencePeriodStart).toLocaleDateString('pt-BR')} →{' '}
                      {new Date(p.referencePeriodEnd).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular">
                      {formatCents(p.expectedAmountCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular">
                      {p.receivedAmountCents !== null
                        ? formatCents(p.receivedAmountCents)
                        : '—'}
                      {diff !== null && Math.abs(diff) > 0 && (
                        <span
                          className={clsx(
                            'ml-1 text-xs',
                            diff < 0 ? 'text-danger-bright' : 'text-warning-bright',
                          )}
                        >
                          ({diff < 0 ? '' : '+'}
                          {formatCents(diff)})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant} dot>
                        {meta.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar extrato bancário"
        description="Cole o CSV do seu banco. Detectamos separador (; ou ,) e formato BR automaticamente."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => importCsv.mutate()}
              loading={importCsv.isPending}
              disabled={!csvText.trim()}
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
            >
              Importar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-surface-border bg-surface-base p-3 font-mono text-xs text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none"
            placeholder={`Data;Histórico;Valor\n10/05/2026;Crédito iFood;7823,40\n17/05/2026;Crédito iFood;8014,90`}
          />
          {importCsv.data && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-bright">
              <CheckCircle2 className="h-4 w-4" />
              {importCsv.data.inserted} importadas · {importCsv.data.duplicated} duplicadas ·{' '}
              {importCsv.data.parsed} total
            </div>
          )}
          {importCsv.error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
              <AlertTriangle className="h-4 w-4" />
              CSV inválido. Verifique os cabeçalhos (Data, Histórico, Valor).
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
