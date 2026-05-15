'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Archive,
  Boxes,
  ChefHat,
  ChevronRight,
  Edit2,
  Package,
  Plus,
  ShoppingCart,
  Sliders,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { IngredientFormDialog } from '../../../components/inventory/ingredient-form-dialog';
import { PurchaseFormDialog } from '../../../components/inventory/purchase-form-dialog';
import { StockAdjustmentDialog } from '../../../components/inventory/stock-adjustment-dialog';
import { SubRecipeFormDialog } from '../../../components/inventory/sub-recipe-form-dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';
import type {
  Ingredient,
  IngredientPurchase,
  StockBalance,
  StockMovement,
} from '../../../lib/inventory-types';
import {
  INGREDIENT_UNIT_LABELS,
  STOCK_MOVEMENT_REASON_LABELS,
} from '../../../lib/inventory-types';
import { r } from '../../../lib/routes';

type Tab = 'ingredients' | 'balance' | 'movements' | 'purchases';

interface TabMeta {
  key: Tab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabMeta[] = [
  { key: 'ingredients', label: 'Insumos & sub-receitas', icon: ChefHat },
  { key: 'balance', label: 'Saldo', icon: Package },
  { key: 'movements', label: 'Movimentações', icon: Sliders },
  { key: 'purchases', label: 'Compras', icon: ShoppingCart },
];

export default function InventoryPage() {
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [tab, setTab] = useState<Tab>('ingredients');

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
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1>Estoque</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Cadastre <b>insumos</b> (matéria-prima comprada de fornecedores) e{' '}
            <b>sub-receitas</b> (preparos internos, como molho da casa). Estes
            são os <i>componentes</i> usados nas receitas dos produtos do{' '}
            <a href="/menu" className="text-brand-500 hover:underline">cardápio</a>.
          </p>
        </div>
        <Link
          href={r('/inventory/suppliers')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-surface-border-strong hover:text-ink-primary"
        >
          <Truck className="h-3.5 w-3.5" />
          Fornecedores
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-surface-border-subtle">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-500 text-ink-primary'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === 'ingredients' && <IngredientsTab storeId={storeId} />}
      {tab === 'balance' && <BalanceTab storeId={storeId} />}
      {tab === 'movements' && <MovementsTab storeId={storeId} />}
      {tab === 'purchases' && <PurchasesTab storeId={storeId} />}
    </div>
  );
}

// -------------------------------------------------------------------
// Tab: Ingredientes & sub-receitas
// -------------------------------------------------------------------

function IngredientsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [subRecipeOpen, setSubRecipeOpen] = useState<Ingredient | null>(null);

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}`),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api(`/inventory/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const raw = ingredients.filter((i) => i.kind === 'raw');
  const subRecipes = ingredients.filter((i) => i.kind === 'sub_recipe');

  return (
    <>
      <div className="mb-4 flex justify-end">
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
          <p className="px-5 py-6 text-sm text-ink-tertiary">
            Nenhum insumo cadastrado.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-right">Custo</th>
                <th className="px-5 py-2 text-right">Unidade</th>
                <th className="w-20 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {raw.map((i) => (
                <tr key={i.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2.5 font-medium text-ink-primary">{i.name}</td>
                  <td className="px-5 py-2.5 text-right tabular text-ink-secondary">
                    R$ {parseFloat(i.costPerUnit).toFixed(4)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-ink-tertiary">
                    {INGREDIENT_UNIT_LABELS[i.unit]}
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
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Arquivar ${i.name}?`)) archive.mutate(i.id);
                        }}
                        className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                        aria-label="Arquivar"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <header className="border-b border-surface-border-subtle bg-surface-base/30 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm">
            <ChefHat className="h-3.5 w-3.5 text-brand-500" />
            Sub-receitas ({subRecipes.length})
          </h2>
        </header>
        {subRecipes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">
            Nenhuma sub-receita. Sub-receitas são preparos que entram como
            componentes em outros produtos (ex.: molho da casa).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-right">Custo unit.</th>
                <th className="px-5 py-2 text-right">Rendimento</th>
                <th className="w-32 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {subRecipes.map((i) => (
                <tr key={i.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2.5 font-medium text-ink-primary">{i.name}</td>
                  <td className="px-5 py-2.5 text-right tabular text-brand-500">
                    R$ {parseFloat(i.costPerUnit).toFixed(4)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-ink-tertiary">
                    {i.batchYield} {INGREDIENT_UNIT_LABELS[i.unit]}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSubRecipeOpen(i)}
                      >
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
          <span className="font-bold text-brand-500 tabular">
            {formatCents(totalValueCents)}
          </span>
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
    queryFn: () =>
      api<StockMovement[]>(`/inventory/stock/movements?storeId=${storeId}&limit=200`),
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
                    {qty.toFixed(2)}{' '}
                    {m.ingredient ? INGREDIENT_UNIT_LABELS[m.ingredient.unit] : ''}
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
    queryFn: () =>
      api<IngredientPurchase[]>(`/inventory/purchases?storeId=${storeId}&limit=100`),
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
            Sem compras registradas. Cada compra atualiza o custo médio do
            insumo automaticamente.
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
