'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Archive,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ChefHat,
  Download,
  ChevronRight,
  Edit2,
  Package,
  Plus,
  RotateCcw,
  ShoppingCart,
  Sliders,
  Trash2,
  TrendingDown,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { IngredientFormDialog } from '../../../components/inventory/ingredient-form-dialog';
import { PurchaseFormDialog } from '../../../components/inventory/purchase-form-dialog';
import { StockAdjustmentDialog } from '../../../components/inventory/stock-adjustment-dialog';
import { SubRecipeFormDialog } from '../../../components/inventory/sub-recipe-form-dialog';
import { SupplierFormDialog } from '../../../components/inventory/supplier-form-dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { useConfirm } from '../../../components/ui/confirm-dialog';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';
import type {
  Ingredient,
  IngredientPurchase,
  StockAlertSummary,
  StockBalance,
  StockMovement,
  Supplier,
} from '../../../lib/inventory-types';
import { INGREDIENT_UNIT_LABELS, STOCK_MOVEMENT_REASON_LABELS } from '../../../lib/inventory-types';
import { r } from '../../../lib/routes';

type Tab = 'ingredients' | 'balance' | 'purchases' | 'suppliers' | 'movements' | 'alerts';

interface TabMeta {
  key: Tab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabMeta[] = [
  { key: 'ingredients', label: 'Insumos & Preparos', icon: ChefHat },
  { key: 'balance', label: 'Saldo em estoque', icon: Package },
  { key: 'purchases', label: 'Compras', icon: ShoppingCart },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck },
  { key: 'movements', label: 'Movimentações', icon: Sliders },
  { key: 'alerts', label: 'Alertas & Reposição', icon: Bell },
];

export default function InventoryPage() {
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [tab, setTab] = useState<Tab>('ingredients');

  const { data: alertsSummary = [] } = useQuery({
    queryKey: ['inventory', 'alerts', storeId],
    queryFn: () => api<StockAlertSummary[]>(`/inventory/stock/alerts?storeId=${storeId}`),
    enabled: !!storeId,
  });
  const { data: exportIngredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId, 'export'],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}&includeArchived=true`),
    enabled: !!storeId,
  });
  const { data: exportBalance = [] } = useQuery({
    queryKey: ['inventory', 'balance', storeId, 'export'],
    queryFn: () => api<StockBalance[]>(`/inventory/stock/balance?storeId=${storeId}`),
    enabled: !!storeId,
  });
  const { data: exportPurchases = [] } = useQuery({
    queryKey: ['inventory', 'purchases', storeId, 'export'],
    queryFn: () => api<IngredientPurchase[]>(`/inventory/purchases?storeId=${storeId}&limit=1000`),
    enabled: !!storeId,
  });
  const { data: exportMovements = [] } = useQuery({
    queryKey: ['inventory', 'movements', storeId, 'export'],
    queryFn: () => api<StockMovement[]>(`/inventory/stock/movements?storeId=${storeId}&limit=1000`),
    enabled: !!storeId,
  });
  const { data: exportSuppliers = [] } = useQuery({
    queryKey: ['inventory', 'suppliers', storeId, 'export'],
    queryFn: () => api<Supplier[]>('/inventory/suppliers?includeArchived=true'),
    enabled: !!storeId,
  });

  const belowCount = alertsSummary.filter((s) => s.belowMinimum).length;
  const exportStock = () => {
    const values = tab === 'alerts' ? alertsSummary : tab === 'ingredients' ? exportIngredients : tab === 'balance' ? exportBalance : tab === 'purchases' ? exportPurchases : tab === 'movements' ? exportMovements : exportSuppliers;
    const records = values as unknown as Array<Record<string, unknown>>;
    const fallbackHeaders: Record<Tab, string[]> = {
      ingredients: ['id', 'name', 'unit', 'kind', 'costPerUnit', 'minimumStock', 'coverageDays'],
      balance: ['ingredientId', 'name', 'unit', 'kind', 'balance', 'valueCents'],
      purchases: ['id', 'ingredient', 'supplier', 'quantity', 'unitCost', 'totalCost', 'purchasedAt', 'invoiceNumber', 'notes'],
      movements: ['id', 'ingredient', 'quantity', 'reason', 'createdAt', 'notes'],
      suppliers: ['id', 'name', 'document', 'contactName', 'phone', 'email', 'notes', 'archivedAt'],
      alerts: ['ingredientId', 'name', 'unit', 'balance', 'minimumStock', 'needsRestock', 'suggestedPurchase'],
    };
    const header = Array.from(new Set(records.flatMap((row) => Object.keys(row))));
    const columns = header.length > 0 ? header : fallbackHeaders[tab];
    const rows = records.map((row) => columns.map((key) => {
      const value = row[key] ?? '';
      return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    }));
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!storeId) {
    return (
      <EmptyState
        icon={Boxes}
        title="Nenhuma loja configurada"
        description="Crie uma loja antes de gerenciar estoque."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Estoque</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Gerencie insumos, saldo em estoque, compras e fornecedores de forma integrada.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={exportStock} leftIcon={<Download className="h-3.5 w-3.5" />}>
          Exportar estoque
        </Button>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-surface-border-subtle">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const isAlerts = t.key === 'alerts';
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'border-brand-500 text-ink-primary font-semibold'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {isAlerts && belowCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-bright px-1 text-[10px] font-bold text-white leading-none">
                  {belowCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'ingredients' && <IngredientsTab storeId={storeId} />}
      {tab === 'balance' && <BalanceTab storeId={storeId} />}
      {tab === 'purchases' && <PurchasesTab storeId={storeId} />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'movements' && <MovementsTab storeId={storeId} />}
      {tab === 'alerts' && <AlertsTab storeId={storeId} />}
    </div>
  );
}

// -------------------------------------------------------------------
// Tab: Alertas & sugestões de compra
// -------------------------------------------------------------------

function AlertsTab({ storeId }: { storeId: string }) {
  const [purchaseFor, setPurchaseFor] = useState<string | undefined>();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all');

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['inventory', 'alerts', storeId],
    queryFn: () => api<StockAlertSummary[]>(`/inventory/stock/alerts?storeId=${storeId}`),
  });

  // Categorização rigorosa e sem sobreposição:
  // 1. Crítico / Abaixo do mínimo: saldo < minLevel (ou saldo zerado)
  // 2. Repor em breve: saldo acima do mínimo, mas cobertura calculada é menor que a desejada
  // 3. Sob controle: saldo e cobertura seguros
  const critical = summary.filter((s) => s.belowMinimum);
  const warning = summary.filter((s) => !s.belowMinimum && s.needsRestock);
  const ok = summary.filter((s) => !s.belowMinimum && !s.needsRestock);

  const belowCount = critical.length;
  const warningCount = warning.length;
  const okCount = ok.length;

  const filtered = summary
    .filter((s) => {
      if (filter === 'critical') return s.belowMinimum;
      if (filter === 'warning') return !s.belowMinimum && s.needsRestock;
      if (filter === 'ok') return !s.belowMinimum && !s.needsRestock;
      return true;
    })
    .sort((a, b) => {
      const score = (s: StockAlertSummary) => (s.belowMinimum ? 0 : s.needsRestock ? 1 : 2);
      return score(a) - score(b);
    });

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={AlertTriangle}
          label="Abaixo do mínimo"
          value={belowCount}
          description={belowCount > 0 ? `${belowCount} item(ns) exigem reposição imediata` : 'Nenhum insumo em nível crítico'}
          tone={belowCount > 0 ? 'danger' : 'neutral'}
          active={filter === 'critical'}
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
        />
        <SummaryCard
          icon={TrendingDown}
          label="Repor em breve"
          value={warningCount}
          description={warningCount > 0 ? `${warningCount} item(ns) próximos da cobertura mínima` : 'Nenhum insumo em alerta preventivo'}
          tone={warningCount > 0 ? 'warning' : 'neutral'}
          active={filter === 'warning'}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Sob controle"
          value={okCount}
          description={`${okCount} item(ns) com saldo e cobertura regular`}
          tone="success"
          active={filter === 'ok'}
          onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar alertas de estoque">
          <Button
            size="sm"
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('all')}
          >
            Todos ({summary.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'critical' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('critical')}
          >
            Abaixo do mínimo ({belowCount})
          </Button>
          <Button
            size="sm"
            variant={filter === 'warning' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('warning')}
          >
            Repor em breve ({warningCount})
          </Button>
          <Button
            size="sm"
            variant={filter === 'ok' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('ok')}
          >
            Sob controle ({okCount})
          </Button>
        </div>
      </div>

      <section className="surface-card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando estoque…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={
              filter === 'critical'
                ? 'Nenhum insumo abaixo do mínimo'
                : filter === 'warning'
                  ? 'Nenhum insumo precisando de reposição no momento'
                  : 'Nenhum insumo cadastrado'
            }
            description="Todos os insumos monitorados nesta categoria estão com níveis regulares."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-3 text-left">Insumo</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Saldo Atual</th>
                <th className="px-5 py-3 text-right">Mínimo</th>
                <th className="px-5 py-3 text-right">Consumo Médio</th>
                <th className="px-5 py-3 text-right">Previsão Cobertura</th>
                <th className="px-5 py-3 text-right">Sugestão Compra</th>
                <th className="w-28 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {filtered.map((s) => {
                const balance = parseFloat(s.balance);
                const minLevel = s.minLevel ? parseFloat(s.minLevel) : null;
                const consumption = parseFloat(s.avgDailyConsumption);
                const suggested = parseFloat(s.suggestedPurchase);
                const isZero = balance <= 0;
                const isLow = s.belowMinimum;
                const isWarning = !isLow && s.needsRestock;
                const unitLabel = INGREDIENT_UNIT_LABELS[s.unit] ?? s.unit;

                return (
                  <tr key={s.ingredientId} className="hover:bg-surface-overlay/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink-primary">
                      {s.ingredientName}
                    </td>

                    <td className="px-5 py-3">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-bright">
                          <AlertTriangle className="h-3 w-3" /> Zerado
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-bright">
                          <AlertTriangle className="h-3 w-3" /> Abaixo do mín.
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-bright">
                          <TrendingDown className="h-3 w-3" /> Repor em breve
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-bright">
                          <Check className="h-3 w-3" /> Normal
                        </span>
                      )}
                    </td>

                    <td
                      className={clsx(
                        'px-5 py-3 text-right tabular font-semibold',
                        isLow ? 'text-danger-bright' : 'text-ink-primary',
                      )}
                    >
                      {balance.toFixed(2)} {unitLabel}
                    </td>

                    <td className="px-5 py-3 text-right tabular text-ink-tertiary">
                      {minLevel !== null ? `${minLevel.toFixed(2)} ${unitLabel}` : '—'}
                    </td>

                    <td className="px-5 py-3 text-right tabular text-ink-secondary">
                      {consumption > 0 ? (
                        `${consumption.toFixed(2)} ${unitLabel}/dia`
                      ) : (
                        <span className="text-xs text-ink-tertiary">Sem histórico</span>
                      )}
                    </td>

                    <td className="px-5 py-3 text-right tabular">
                      {isZero ? (
                        <span className="font-semibold text-danger-bright">0 dias</span>
                      ) : s.daysOfCover !== null ? (
                        <span
                          className={clsx(
                            'font-semibold',
                            s.daysOfCover < 3
                              ? 'text-danger-bright'
                              : s.daysOfCover < 7
                                ? 'text-warning-bright'
                                : 'text-ink-secondary',
                          )}
                        >
                          {Math.round(s.daysOfCover)} {Math.round(s.daysOfCover) === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-tertiary">Estável</span>
                      )}
                    </td>

                    <td className="px-5 py-3 text-right tabular">
                      {suggested > 0 ? (
                        <span className="font-bold text-brand-500">
                          + {suggested.toFixed(2)} {unitLabel}
                        </span>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3 text-right">
                      {(suggested > 0 || isLow || isWarning) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPurchaseFor(s.ingredientId)}
                          leftIcon={<ShoppingCart className="h-3.5 w-3.5" />}
                        >
                          Comprar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {purchaseFor && (
        <PurchaseFormDialog
          open
          onClose={() => setPurchaseFor(undefined)}
          storeId={storeId}
          defaultIngredientId={purchaseFor}
        />
      )}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  description?: string;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    danger: 'bg-danger-soft text-danger-bright',
    warning: 'bg-warning-soft text-warning-bright',
    success: 'bg-success-soft text-success-bright',
    neutral: 'bg-surface-base text-ink-secondary',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'surface-card flex items-start gap-3.5 p-4 text-left transition-all',
        onClick && 'cursor-pointer hover:border-surface-border',
        active && 'ring-2 ring-brand-500 bg-surface-raised',
      )}
    >
      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
          {label}
        </p>
        <p className="text-2xl font-bold tabular text-ink-primary mt-0.5">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-ink-tertiary truncate">{description}</p>
        )}
      </div>
    </button>
  );
}

// -------------------------------------------------------------------
// Tab: Ingredientes & sub-receitas
// -------------------------------------------------------------------

function IngredientsTab({ storeId }: { storeId: string }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [subRecipeOpen, setSubRecipeOpen] = useState<Ingredient | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}&includeArchived=true`),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/inventory/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => api(`/inventory/ingredients/${id}/restore`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'ingredients', storeId] }),
  });
  const removePermanently = useMutation({
    mutationFn: (id: string) => api(`/inventory/ingredients/${id}/permanent`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'ingredients', storeId] }),
  });

  const visibleIngredients = ingredients.filter((i) => (showArchived ? !!i.archivedAt : !i.archivedAt));
  const raw = visibleIngredients.filter((i) => i.kind === 'raw');
  const subRecipes = visibleIngredients.filter((i) => i.kind === 'sub_recipe');

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filtrar insumos">
          <Button size="sm" variant={showArchived ? 'ghost' : 'secondary'} onClick={() => setShowArchived(false)}>
            Ativos ({ingredients.filter((i) => !i.archivedAt).length})
          </Button>
          <Button size="sm" variant={showArchived ? 'secondary' : 'ghost'} onClick={() => setShowArchived(true)}>
            Arquivados ({ingredients.filter((i) => !!i.archivedAt).length})
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Novo insumo
        </Button>
      </div>

      <section className="surface-card mb-4 overflow-hidden">
        <header className="border-b border-surface-border-subtle bg-surface-base/30 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm">
            <ChefHat className="h-3.5 w-3.5 text-ink-tertiary" />
            Insumos ({raw.length})
          </h2>
        </header>
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
        ) : raw.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Nenhum insumo cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-right">Custo unitário</th>
                <th className="w-20 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {raw.map((i) => {
                const cost = parseFloat(i.costPerUnit);
                return (
                  <tr key={i.id} className="hover:bg-surface-overlay/50">
                    <td className="px-5 py-2.5 font-medium text-ink-primary">{i.name}</td>
                    <td className="px-5 py-2.5 text-right tabular text-ink-secondary">
                      <div className="font-semibold text-ink-primary">
                        R$ {cost.toFixed(4)} / {INGREDIENT_UNIT_LABELS[i.unit]}
                      </div>
                      {(i.unit === 'gram' || i.unit === 'milliliter') && (
                        <div className="text-[11px] text-ink-tertiary">
                          R$ {(cost * 1000).toFixed(2).replace('.', ',')} / {i.unit === 'gram' ? 'kg' : 'L'}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing(i);
                            setDialogOpen(true);
                          }}
                          className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
                          aria-label="Editar"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {!showArchived && (
                          <button
                            onClick={async () => {
                              if (await confirm({ title: 'Arquivar insumo', description: `Deseja arquivar ${i.name}?`, confirmLabel: 'Arquivar', danger: true })) archive.mutate(i.id);
                            }}
                            className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                            aria-label="Arquivar"
                            title="Arquivar"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {showArchived && (
                          <>
                            <button
                              onClick={() => restore.mutate(i.id)}
                              disabled={restore.isPending}
                              className="rounded-md p-1.5 text-brand-500 hover:bg-brand-500/10"
                              aria-label="Restaurar"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (await confirm({ title: 'Excluir insumo', description: `Excluir permanentemente ${i.name}? Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true })) {
                                  removePermanently.mutate(i.id);
                                }
                              }}
                              disabled={removePermanently.isPending}
                              className="rounded-md p-1.5 text-danger-bright hover:bg-danger-soft"
                              aria-label="Excluir permanentemente"
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <header className="border-b border-surface-border-subtle bg-surface-base/30 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm">
            <ChefHat className="h-3.5 w-3.5 text-brand-500" />
            Preparo da casa / Sub-receitas ({subRecipes.length})
          </h2>
        </header>
        {subRecipes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">
            Nenhuma sub-receita cadastrada. Sub-receitas são preparos caseiros que entram como componentes em outros
            produtos (ex.: molho especial, massa fresca).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-right">Custo unitário</th>
                <th className="px-5 py-2 text-right">Rendimento do lote</th>
                <th className="w-32 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {subRecipes.map((i) => (
                <tr key={i.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2.5 font-medium text-ink-primary">{i.name}</td>
                  <td className="px-5 py-2.5 text-right tabular text-brand-500 font-semibold">
                    R$ {parseFloat(i.costPerUnit).toFixed(4)} / {INGREDIENT_UNIT_LABELS[i.unit]}
                  </td>
                  <td className="px-5 py-2.5 text-right text-ink-secondary">
                    {i.batchYield} {INGREDIENT_UNIT_LABELS[i.unit]}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setSubRecipeOpen(i)}>
                        Editar receita
                      </Button>
                      <button
                        onClick={() => {
                          setEditing(i);
                          setDialogOpen(true);
                        }}
                        className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
                        aria-label="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!showArchived ? (
                        <button
                          onClick={async () => {
                            if (await confirm({ title: 'Arquivar preparo', description: `Deseja arquivar ${i.name}?`, confirmLabel: 'Arquivar', danger: true })) archive.mutate(i.id);
                          }}
                          className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                          aria-label="Arquivar"
                          title="Arquivar"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => restore.mutate(i.id)}
                            disabled={restore.isPending}
                            className="rounded-md p-1.5 text-brand-500 hover:bg-brand-500/10"
                            aria-label="Restaurar"
                            title="Restaurar"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (await confirm({ title: 'Excluir preparo', description: `Excluir permanentemente ${i.name}? Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true })) {
                                removePermanently.mutate(i.id);
                              }
                            }}
                            disabled={removePermanently.isPending}
                            className="rounded-md p-1.5 text-danger-bright hover:bg-danger-soft"
                            aria-label="Excluir permanentemente"
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <IngredientFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        storeId={storeId}
        editing={editing}
      />
      <SubRecipeFormDialog
        open={!!subRecipeOpen}
        onClose={() => setSubRecipeOpen(null)}
        storeId={storeId}
        subRecipe={subRecipeOpen}
      />
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Saldo
// -------------------------------------------------------------------

function BalanceTab({ storeId }: { storeId: string }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustIngredient, setAdjustIngredient] = useState<string | undefined>();

  const { data: balance = [], isLoading } = useQuery({
    queryKey: ['inventory', 'balance', storeId],
    queryFn: () => api<StockBalance[]>(`/inventory/stock/balance?storeId=${storeId}`),
  });

  const totalValueCents = balance.reduce((sum, b) => sum + b.valueCents, 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-secondary">
          Valor total do estoque:{' '}
          <span className="font-bold text-brand-500 tabular">{formatCents(totalValueCents)}</span>
        </p>
        <Button
          size="sm"
          onClick={() => {
            setAdjustIngredient(undefined);
            setAdjustOpen(true);
          }}
          leftIcon={<Sliders className="h-3.5 w-3.5" />}
        >
          Ajustar saldo
        </Button>
      </div>

      <section className="surface-card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
        ) : balance.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">
            Estoque vazio. Registre uma compra ou ajuste para começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Insumo</th>
                <th className="px-5 py-2 text-right">Saldo</th>
                <th className="px-5 py-2 text-right">Valor</th>
                <th className="w-24 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {balance.map((b) => {
                const isNegative = parseFloat(b.balance) < 0;
                return (
                  <tr key={b.ingredientId} className="hover:bg-surface-overlay/50">
                    <td className="px-5 py-2.5 font-medium text-ink-primary">
                      {b.name}
                      {b.kind === 'sub_recipe' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-500">
                          sub-receita
                        </span>
                      )}
                    </td>
                    <td
                      className={clsx(
                        'px-5 py-2.5 text-right tabular font-semibold',
                        isNegative ? 'text-danger-bright' : 'text-ink-primary',
                      )}
                    >
                      {parseFloat(b.balance).toFixed(2)} {INGREDIENT_UNIT_LABELS[b.unit]}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular text-ink-secondary">
                      {formatCents(b.valueCents)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdjustIngredient(b.ingredientId);
                          setAdjustOpen(true);
                        }}
                      >
                        Ajustar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <StockAdjustmentDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        storeId={storeId}
        defaultIngredientId={adjustIngredient}
      />
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Movimentações
// -------------------------------------------------------------------

function MovementsTab({ storeId }: { storeId: string }) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['inventory', 'movements', storeId],
    queryFn: () => api<StockMovement[]>(`/inventory/stock/movements?storeId=${storeId}&limit=200`),
  });

  return (
    <section className="surface-card overflow-hidden">
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
      ) : movements.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-tertiary">
          Sem movimentações. Toda compra, ajuste e baixa por pedido aparece aqui.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
            <tr>
              <th className="px-5 py-2 text-left">Data</th>
              <th className="px-5 py-2 text-left">Insumo</th>
              <th className="px-5 py-2 text-left">Motivo</th>
              <th className="px-5 py-2 text-right">Quantidade</th>
              <th className="px-5 py-2 text-left">Por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border-subtle">
            {movements.map((m) => {
              const qty = parseFloat(m.quantity);
              const isIn = qty > 0;
              return (
                <tr key={m.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2 text-xs text-ink-tertiary">
                    {new Date(m.createdAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-5 py-2 font-medium text-ink-primary">
                    {m.ingredient?.name ?? '—'}
                  </td>
                  <td className="px-5 py-2 text-ink-secondary">
                    {STOCK_MOVEMENT_REASON_LABELS[m.reason]}
                  </td>
                  <td
                    className={clsx(
                      'px-5 py-2 text-right tabular font-semibold',
                      isIn ? 'text-success-bright' : 'text-danger-bright',
                    )}
                  >
                    {isIn ? '+' : ''}
                    {qty.toFixed(2)} {m.ingredient ? INGREDIENT_UNIT_LABELS[m.ingredient.unit] : ''}
                  </td>
                  <td className="px-5 py-2 text-xs text-ink-tertiary">
                    {m.createdBy?.name ?? 'Sistema'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

// -------------------------------------------------------------------
// Tab: Compras
// -------------------------------------------------------------------

function PurchasesTab({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['inventory', 'purchases', storeId],
    queryFn: () => api<IngredientPurchase[]>(`/inventory/purchases?storeId=${storeId}&limit=100`),
  });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          Nova compra
        </Button>
      </div>

      <section className="surface-card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
        ) : purchases.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">
            Sem compras registradas. Cada compra atualiza o custo médio do insumo automaticamente.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Data</th>
                <th className="px-5 py-2 text-left">Insumo</th>
                <th className="px-5 py-2 text-left">Fornecedor</th>
                <th className="px-5 py-2 text-right">Qtd</th>
                <th className="px-5 py-2 text-right">Custo unit.</th>
                <th className="px-5 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2 text-xs text-ink-tertiary">
                    {new Date(p.purchasedAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-2 font-medium text-ink-primary">
                    {p.ingredient?.name ?? '—'}
                  </td>
                  <td className="px-5 py-2 text-ink-secondary">{p.supplier?.name ?? '—'}</td>
                  <td className="px-5 py-2 text-right tabular text-ink-secondary">
                    {parseFloat(p.quantity).toFixed(2)}{' '}
                    {p.ingredient ? INGREDIENT_UNIT_LABELS[p.ingredient.unit] : ''}
                  </td>
                  <td className="px-5 py-2 text-right tabular text-ink-secondary">
                    R$ {parseFloat(p.unitCost).toFixed(4)}
                  </td>
                  <td className="px-5 py-2 text-right tabular font-semibold text-brand-500">
                    R$ {parseFloat(p.totalCost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <PurchaseFormDialog open={open} onClose={() => setOpen(false)} storeId={storeId} />
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Fornecedores
// -------------------------------------------------------------------

function SuppliersTab() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const {
    data: allSuppliers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => api<Supplier[]>('/inventory/suppliers?includeArchived=true'),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/inventory/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => api(`/inventory/suppliers/${id}/restore`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/inventory/suppliers/${id}/permanent`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const suppliers = allSuppliers.filter((s) => (showArchived ? !!s.archivedAt : !s.archivedAt));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filtrar fornecedores">
          <Button
            size="sm"
            variant={showArchived ? 'ghost' : 'secondary'}
            onClick={() => setShowArchived(false)}
          >
            Ativos ({allSuppliers.filter((s) => !s.archivedAt).length})
          </Button>
          <Button
            size="sm"
            variant={showArchived ? 'secondary' : 'ghost'}
            onClick={() => setShowArchived(true)}
          >
            Arquivados ({allSuppliers.filter((s) => !!s.archivedAt).length})
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Novo fornecedor
        </Button>
      </div>

      {(error || archive.error || restore.error || remove.error) && (
        <p role="alert" className="mb-3 text-sm text-danger-bright">
          {(error || archive.error || restore.error || remove.error)?.message}
        </p>
      )}

      <section className="surface-card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={showArchived ? 'Nenhum fornecedor arquivado' : 'Nenhum fornecedor cadastrado'}
            description={
              showArchived
                ? 'Os fornecedores arquivados aparecem aqui e podem ser restaurados a qualquer momento.'
                : 'Cadastre seus fornecedores para registrar compras e calcular os custos automaticamente.'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-left">Documento</th>
                <th className="px-5 py-2 text-left">Contato</th>
                <th className="w-20 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2.5 font-medium text-ink-primary">{s.name}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-secondary">
                    {s.document ?? '—'}
                  </td>
                  <td className="px-5 py-2.5 text-ink-secondary">{s.email ?? s.phone ?? '—'}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                        className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {s.archivedAt ? (
                        <>
                          <button
                            disabled={restore.isPending}
                            aria-label={`Restaurar ${s.name}`}
                            title="Restaurar"
                            onClick={() => restore.mutate(s.id)}
                            className="rounded-md p-1.5 text-brand-500 hover:bg-brand-500/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            disabled={remove.isPending}
                            aria-label={`Excluir permanentemente ${s.name}`}
                            title="Excluir permanentemente"
                            onClick={async () => {
                              if (await confirm({ title: 'Excluir fornecedor', description: `Excluir permanentemente ${s.name}? Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true })) remove.mutate(s.id);
                            }}
                            className="rounded-md p-1.5 text-danger-bright hover:bg-danger-soft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={archive.isPending}
                          onClick={async () => {
                            if (await confirm({ title: 'Arquivar fornecedor', description: `Deseja arquivar ${s.name}?`, confirmLabel: 'Arquivar', danger: true })) archive.mutate(s.id);
                          }}
                          className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                          aria-label="Arquivar"
                          title="Arquivar"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <SupplierFormDialog open={open} onClose={() => setOpen(false)} editing={editing} />
    </>
  );
}
