'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
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
  divergences: Array<{
    payoutId: string;
    expectedCents: number;
    bestMatchAmountCents: number | null;
    bestMatchDescription: string | null;
    diffCents: number | null;
  }>;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
    queryFn: () =>
      api<Payout[]>(`/payouts?storeId=${encodeURIComponent(storeId ?? '')}`),
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

  const maxDailyGross = Math.max(1, ...daily.map((d) => d.revenueGrossCents));

  if (!storeId) return <p className="text-sm text-zinc-500">Crie/selecione uma loja primeiro.</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Faturamento, margem, repasses e conciliação bancária.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs">
            de
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col text-xs">
            até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            + Extrato bancário
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento bruto" value={formatCents(summary?.revenueGrossCents ?? 0)} />
        <KpiCard
          label="Taxas pagas"
          value={formatCents(summary?.totalFeesCents ?? 0)}
          variant="muted"
        />
        <KpiCard
          label="Líquido"
          value={formatCents(summary?.revenueNetCents ?? 0)}
          variant="success"
        />
        <KpiCard label="Ticket médio" value={formatCents(summary?.avgTicketCents ?? 0)} />
      </section>

      {/* Gráfico diário */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Faturamento por dia ({daily.length})</h2>
        {daily.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Sem pedidos no período.</p>
        ) : (
          <div className="mt-4 flex items-end gap-1" style={{ height: 160 }}>
            {daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-zinc-900 dark:bg-white"
                  style={{
                    height: `${(d.revenueGrossCents / maxDailyGross) * 140}px`,
                  }}
                  title={`${d.day}: ${formatCents(d.revenueGrossCents)} (${d.orderCount} pedidos)`}
                />
                <span className="text-[10px] text-zinc-500">
                  {new Date(d.day).getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Por plataforma */}
      {byPlatform.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <header className="bg-zinc-50 px-4 py-2 font-semibold dark:bg-zinc-900">
            Faturamento por plataforma
          </header>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2">Plataforma</th>
                <th className="px-4 py-2 text-right">Pedidos</th>
                <th className="px-4 py-2 text-right">Bruto</th>
                <th className="px-4 py-2 text-right">Líquido</th>
                <th className="px-4 py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {byPlatform.map((p) => (
                <tr key={p.platformCode} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <Badge color={p.colorHex}>{p.platformName}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{p.orderCount}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCents(p.revenueGrossCents)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCents(p.revenueNetCents)}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Top itens */}
      {topItems.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <header className="bg-zinc-50 px-4 py-2 font-semibold dark:bg-zinc-900">
            Top itens por margem (período)
          </header>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Vendidos</th>
                <th className="px-4 py-2 text-right">Faturado</th>
                <th className="px-4 py-2 text-right">Margem total</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map((it, idx) => (
                <tr key={(it.menuItemId ?? 'x') + idx} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {idx + 1}. {it.name}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{it.sold}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCents(it.grossRevenueCents)}</td>
                  <td className="px-4 py-2 text-right font-mono text-status-open">
                    {formatCents(it.marginCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Conciliação */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <header className="flex items-center justify-between bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
          <h2 className="font-semibold">Conciliação de repasses</h2>
          <Button
            size="sm"
            onClick={() => reconcile.mutate()}
            disabled={reconcile.isPending}
          >
            {reconcile.isPending ? 'Rodando…' : 'Rodar conciliação automática →'}
          </Button>
        </header>
        {payouts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-500">
            Sem payouts ainda. Use <b>POST /payouts/recompute</b> para gerar a partir
            dos pedidos do período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2">Plataforma</th>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2 text-right">Esperado</th>
                <th className="px-4 py-2 text-right">Recebido</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <Badge color={p.platform.colorHex}>{p.platform.name}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(p.referencePeriodStart).toLocaleDateString('pt-BR')} →{' '}
                    {new Date(p.referencePeriodEnd).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCents(p.expectedAmountCents)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {p.receivedAmountCents !== null
                      ? formatCents(p.receivedAmountCents)
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {p.status === 'reconciled' && (
                      <span className="text-status-open">✅ Conciliado</span>
                    )}
                    {p.status === 'partial' && (
                      <span className="text-status-paused">⚠️ Parcial</span>
                    )}
                    {p.status === 'mismatch' && (
                      <span className="text-status-error">⚠️ Divergência</span>
                    )}
                    {p.status === 'pending' && (
                      <span className="text-zinc-500">⏳ Aguardando</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar extrato bancário (CSV)"
        description="Cole o CSV exportado do seu banco. Aceita ; ou , como separador."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => importCsv.mutate()} disabled={importCsv.isPending || !csvText.trim()}>
              {importCsv.isPending ? 'Importando…' : 'Importar'}
            </Button>
          </>
        }
      >
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          placeholder={`Data;Histórico;Valor\n10/05/2026;Crédito iFood;7823,40\n17/05/2026;Crédito iFood;8014,90`}
        />
        {importCsv.data && (
          <p className="mt-2 text-sm text-status-open">
            ✅ {importCsv.data.inserted} importadas, {importCsv.data.duplicated} duplicadas
            ({importCsv.data.parsed} total)
          </p>
        )}
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'success' | 'muted';
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          variant === 'success'
            ? 'text-status-open'
            : variant === 'muted'
              ? 'text-zinc-500'
              : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
