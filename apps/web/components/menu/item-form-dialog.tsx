'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

import { RecipeBuilder } from '../inventory/recipe-builder';
import { api } from '../../lib/api';
import type {
  Ingredient,
  MenuItemRecipeResponse,
  RecipeBuilderRow,
} from '../../lib/inventory-types';
import type { Category, MenuItemSummary } from '../../lib/menu-types';
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
  const [costMode, setCostMode] = useState<CostMode>('manual');
  const [costReais, setCostReais] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [rows, setRows] = useState<RecipeBuilderRow[]>([]);

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}`),
    enabled: open && costMode === 'recipe',
  });

  const { data: currentRecipe } = useQuery({
    queryKey: ['inventory', 'menu-item-recipe', editing?.id],
    queryFn: () =>
      api<MenuItemRecipeResponse>(`/inventory/recipes/menu-item/${editing!.id}`),
    enabled: open && !!editing && costMode === 'recipe',
  });

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setCategoryId(editing?.category?.id ?? categories[0]?.id ?? '');
    setCostMode(editing?.costMode ?? 'manual');
    setCostReais(editing ? (editing.costCents / 100).toFixed(2) : '');
    setPrepTime(editing?.prepTimeMinutes?.toString() ?? '');
    setRows([]);
  }, [open, editing, categories]);

  useEffect(() => {
    if (currentRecipe && costMode === 'recipe') {
      setRows(
        currentRecipe.components.map((c) => ({
          ingredientId: c.ingredientId,
          quantity: c.quantity,
        })),
      );
    }
  }, [currentRecipe, costMode]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(costReais.replace(',', '.')) * 100) || 0;
      const body = {
        name,
        description: description || undefined,
        categoryId: categoryId || null,
        costMode,
        costCents: costMode === 'manual' ? cents : 0,
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

      // Em modo receita, salva a receita após criar/atualizar o item.
      if (costMode === 'recipe') {
        await api(`/inventory/recipes/menu-item/${itemId}`, {
          method: 'PUT',
          body: {
            components: rows
              .filter((r) => r.ingredientId && parseFloat(r.quantity) > 0)
              .map((r, idx) => ({
                ingredientId: r.ingredientId,
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

  // Preview de custo da receita (client-side; backend recalcula authoritativamente)
  const recipeCostCents = rows.reduce((sum, row) => {
    const ing = ingredients.find((i) => i.id === row.ingredientId);
    if (!ing) return sum;
    const qty = parseFloat(row.quantity) || 0;
    const cost = parseFloat(ing.costPerUnit) || 0;
    return sum + qty * cost * 100;
  }, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Novo item'}
      size={costMode === 'recipe' ? 'lg' : 'md'}
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
      <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink-secondary">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 rounded-lg border border-surface-border-subtle bg-surface-raised px-3 text-sm text-ink-primary outline-none transition-colors focus:border-brand-500"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setCostMode('manual')}
            className={clsx(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
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
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
              costMode === 'recipe'
                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                : 'border-surface-border-subtle text-ink-secondary',
            )}
          >
            CMV por receita
          </button>
        </div>

        {costMode === 'manual' ? (
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
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  CMV calculado
                </p>
                <p className="text-lg font-bold tabular text-brand-500">
                  {formatCents(Math.round(recipeCostCents))}
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

            <RecipeBuilder
              availableIngredients={ingredients.filter((i) => !i.archivedAt)}
              rows={rows}
              onChange={setRows}
            />
          </>
        )}

        <p className="rounded-md border border-surface-border-subtle bg-surface-base px-3 py-2 text-xs text-ink-secondary">
          {costMode === 'manual' ? (
            <>
              CMV manual: você digita o custo. <b>Migrar pra receita</b> quando
              quiser que o custo se ajuste automaticamente conforme você compra
              insumos.
            </>
          ) : (
            <>
              CMV é calculado a partir dos componentes. Quando o preço de um
              insumo mudar (via compra ou ajuste), todos os itens que o usam
              têm o CMV recalculado em cascata.
            </>
          )}
        </p>
      </div>
    </Dialog>
  );
}
