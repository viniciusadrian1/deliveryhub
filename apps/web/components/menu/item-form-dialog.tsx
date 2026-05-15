'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

import { RecipeBuilder, rowsToApiPayload } from '../inventory/recipe-builder';
import { ComboBuilder } from './combo-builder';
import { ModifierGroupsBuilder } from './modifier-groups-builder';
import { api } from '../../lib/api';
import type {
  Ingredient,
  MenuItemRecipeResponse,
  RecipeBuilderRow,
} from '../../lib/inventory-types';
import { convertFromBase } from '../../lib/units';
import type {
  Category,
  ComboBuilderRow,
  ComboResponse,
  MenuItemSummary,
  ProductKind,
  SalesKind,
} from '../../lib/menu-types';
import { SALES_KIND_DESCRIPTIONS, SALES_KIND_LABELS } from '../../lib/menu-types';
import { formatCents } from '../../lib/format';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  categories: Category[];
  editing?: MenuItemSummary | null;
}

type CostMode = 'manual' | 'recipe';

/**
 * Form unificado pra criar/editar um MenuItem.
 *
 * Suporta:
 *  - productKind: `single` (item simples) ou `combo` (composto)
 *  - costMode (só pra single): `manual` ou `recipe`
 *  - salesKind: papel de venda (main / side / drink / dessert / addon)
 *  - Em editing, mostra ModifierGroupsBuilder embedded para gerenciar
 *    grupos de complementos depois que o item já tem ID.
 *
 * Em `combo`, costCents é sempre derivado da soma dos componentes —
 * costMode é ignorado.
 */
export function ItemFormDialog({
  open,
  onClose,
  storeId,
  categories,
  editing,
}: ItemFormDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [productKind, setProductKind] = useState<ProductKind>('single');
  const [salesKind, setSalesKind] = useState<SalesKind>('main');
  const [costMode, setCostMode] = useState<CostMode>('manual');
  const [costReais, setCostReais] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [recipeRows, setRecipeRows] = useState<RecipeBuilderRow[]>([]);
  const [comboRows, setComboRows] = useState<ComboBuilderRow[]>([]);

  // Catálogos auxiliares
  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}`),
    enabled: open && productKind === 'single' && costMode === 'recipe',
  });
  const { data: allMenuItems = [] } = useQuery({
    queryKey: ['menu', storeId, 'all'],
    queryFn: () => api<MenuItemSummary[]>(`/menu/items?storeId=${storeId}`),
    enabled: open && productKind === 'combo',
  });

  // Receita / combo existentes
  const { data: currentRecipe } = useQuery({
    queryKey: ['inventory', 'menu-item-recipe', editing?.id],
    queryFn: () =>
      api<MenuItemRecipeResponse>(`/inventory/recipes/menu-item/${editing!.id}`),
    enabled: open && !!editing && productKind === 'single' && costMode === 'recipe',
  });
  const { data: currentCombo } = useQuery({
    queryKey: ['menu', 'combo', editing?.id],
    queryFn: () => api<ComboResponse>(`/menu/combos/${editing!.id}`),
    enabled: open && !!editing && productKind === 'combo',
  });

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setCategoryId(editing?.category?.id ?? categories[0]?.id ?? '');
    setProductKind(editing?.productKind ?? 'single');
    setSalesKind(editing?.salesKind ?? 'main');
    setCostMode(editing?.costMode ?? 'manual');
    setCostReais(editing ? (editing.costCents / 100).toFixed(2) : '');
    setPrepTime(editing?.prepTimeMinutes?.toString() ?? '');
    setRecipeRows([]);
    setComboRows([]);
  }, [open, editing, categories]);

  useEffect(() => {
    if (currentRecipe && productKind === 'single' && costMode === 'recipe') {
      setRecipeRows(
        currentRecipe.components.map((c) => {
          const displayUnit = c.displayUnit ?? c.ingredient.unit;
          const qtyBase = parseFloat(c.quantity);
          const qtyDisplay =
            displayUnit !== c.ingredient.unit
              ? convertFromBase(qtyBase, c.ingredient.unit, displayUnit)
              : qtyBase;
          return {
            ingredientId: c.ingredientId,
            quantity: String(qtyDisplay),
            displayUnit,
          };
        }),
      );
    }
  }, [currentRecipe, costMode, productKind]);

  useEffect(() => {
    if (currentCombo && productKind === 'combo') {
      setComboRows(
        currentCombo.components.map((c) => ({
          componentMenuItemId: c.componentMenuItemId,
          quantity: c.quantity,
        })),
      );
    }
  }, [currentCombo, productKind]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(costReais.replace(',', '.')) * 100) || 0;
      const body = {
        name,
        description: description || undefined,
        categoryId: categoryId || null,
        productKind,
        salesKind,
        costMode: productKind === 'combo' ? 'recipe' : costMode,
        costCents:
          productKind === 'combo' || costMode === 'recipe' ? 0 : cents,
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : undefined,
      };
      const itemId = editing
        ? (
            await api<{ id: string }>(`/menu/items/${editing.id}`, {
              method: 'PATCH',
              body,
            })
          ).id
        : (
            await api<{ id: string }>('/menu/items', {
              method: 'POST',
              body: { ...body, storeId },
            })
          ).id;

      if (productKind === 'single' && costMode === 'recipe') {
        await api(`/inventory/recipes/menu-item/${itemId}`, {
          method: 'PUT',
          body: { components: rowsToApiPayload(recipeRows, ingredients) },
        });
      }
      if (productKind === 'combo') {
        await api(`/menu/combos/${itemId}/components`, {
          method: 'PUT',
          body: {
            components: comboRows
              .filter((r) => r.componentMenuItemId && r.quantity > 0)
              .map((r, idx) => ({
                componentMenuItemId: r.componentMenuItemId,
                quantity: r.quantity,
                sortOrder: idx,
              })),
          },
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['menu', storeId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
  });

  // Preview de custo (client-side, backend recalcula authoritativamente)
  const recipeCostCents = recipeRows.reduce((sum, row) => {
    const ing = ingredients.find((i) => i.id === row.ingredientId);
    if (!ing) return sum;
    const qty = parseFloat(row.quantity) || 0;
    const cost = parseFloat(ing.costPerUnit) || 0;
    return sum + qty * cost * 100;
  }, 0);
  const comboCostCents = comboRows.reduce((sum, row) => {
    const item = allMenuItems.find((i) => i.id === row.componentMenuItemId);
    if (!item) return sum;
    return sum + item.costCents * row.quantity;
  }, 0);
  const calculatedCostCents =
    productKind === 'combo'
      ? comboCostCents
      : costMode === 'recipe'
        ? Math.round(recipeCostCents)
        : null;

  const showBig = productKind === 'combo' || costMode === 'recipe' || !!editing;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Novo item'}
      size={showBig ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink-secondary">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 rounded-lg border border-surface-border-subtle bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink-secondary">Tipo de venda</label>
            <select
              value={salesKind}
              onChange={(e) => setSalesKind(e.target.value as SalesKind)}
              className="h-10 rounded-lg border border-surface-border-subtle bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
            >
              {(Object.keys(SALES_KIND_LABELS) as SalesKind[]).map((k) => (
                <option key={k} value={k}>
                  {SALES_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-tertiary">
              {SALES_KIND_DESCRIPTIONS[salesKind]}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setProductKind('single')}
            className={clsx(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
              productKind === 'single'
                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                : 'border-surface-border-subtle text-ink-secondary',
            )}
          >
            Item simples
          </button>
          <button
            type="button"
            onClick={() => setProductKind('combo')}
            className={clsx(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
              productKind === 'combo'
                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                : 'border-surface-border-subtle text-ink-secondary',
            )}
          >
            Combo
          </button>
        </div>

        {productKind === 'single' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCostMode('manual')}
              className={clsx(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
                costMode === 'manual'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-surface-border-subtle text-ink-secondary',
              )}
            >
              CMV manual
            </button>
            <button
              type="button"
              onClick={() => setCostMode('recipe')}
              className={clsx(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
                costMode === 'recipe'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-surface-border-subtle text-ink-secondary',
              )}
            >
              CMV por receita
            </button>
          </div>
        )}

        {productKind === 'single' && costMode === 'manual' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CMV (R$)"
              placeholder="12,00"
              value={costReais}
              onChange={(e) => setCostReais(e.target.value)}
              inputMode="decimal"
            />
            <Input
              label="Tempo preparo (min)"
              placeholder="12"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              type="number"
              min={0}
            />
          </div>
        )}

        {(productKind === 'combo' || costMode === 'recipe') && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                CMV calculado
              </p>
              <p className="text-lg font-bold tabular text-brand-500">
                {formatCents(calculatedCostCents ?? 0)}
              </p>
            </div>
            <Input
              label="Tempo preparo (min)"
              placeholder="12"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              type="number"
              min={0}
            />
          </div>
        )}

        {productKind === 'single' && costMode === 'recipe' && (
          <RecipeBuilder
            availableIngredients={ingredients.filter((i) => !i.archivedAt)}
            rows={recipeRows}
            onChange={setRecipeRows}
          />
        )}

        {productKind === 'combo' && (
          <ComboBuilder
            availableItems={allMenuItems}
            rows={comboRows}
            onChange={setComboRows}
            excludeMenuItemId={editing?.id}
          />
        )}

        {/* Modifier groups: só mostra em edit (precisa do menuItemId persistido) */}
        {editing && (
          <div className="border-t border-surface-border-subtle pt-4">
            <ModifierGroupsBuilder menuItemId={editing.id} storeId={storeId} />
          </div>
        )}

        <p className="rounded-md border border-surface-border-subtle bg-surface-base px-3 py-2 text-xs text-ink-secondary">
          {productKind === 'combo'
            ? 'Combo: CMV é a soma dos CMVs dos componentes (recalculado automaticamente).'
            : costMode === 'recipe'
              ? 'CMV é calculado a partir dos insumos. Quando um insumo muda de preço (compra/ajuste), todos os items que o usam têm CMV recalculado em cascata.'
              : 'CMV manual: você digita o custo. Mude pra "CMV por receita" pra usar insumos do estoque.'}
        </p>
      </div>
    </Dialog>
  );
}
