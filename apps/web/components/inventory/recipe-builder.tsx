'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { formatCents } from '../../lib/format';
import type { Ingredient, RecipeBuilderRow } from '../../lib/inventory-types';
import { INGREDIENT_UNIT_LABELS as UNIT } from '../../lib/inventory-types';
import { Button } from '../ui/button';

interface RecipeBuilderProps {
  /** Ingredientes disponíveis (raw + sub-receitas) que podem ser componentes. */
  availableIngredients: Ingredient[];
  /** Linhas da receita em edição. Controlado por callback. */
  rows: RecipeBuilderRow[];
  onChange: (rows: RecipeBuilderRow[]) => void;
  /**
   * Para sub-receita, este é o próprio ingrediente sendo editado —
   * removemos da lista de "disponíveis" pra impedir auto-referência
   * direta na UI (anti-ciclo extra acontece no backend).
   */
  excludeIngredientId?: string;
  /** Para sub-receita: quanto produz por preparo. Mostra custo unitário. */
  batchYield?: string;
}

/**
 * Tabela editável de componentes da receita.
 *
 * Cada linha: select de ingrediente + quantidade + custo subtotal (live).
 * Footer: custo total + custo unitário (se batchYield).
 *
 * O cálculo de custo é feito client-side com base nos `costPerUnit`
 * carregados — o backend recalcula authoritativamente ao salvar.
 */
export function RecipeBuilder({
  availableIngredients,
  rows,
  onChange,
  excludeIngredientId,
  batchYield,
}: RecipeBuilderProps) {
  const ingredientById = useMemo(
    () => new Map(availableIngredients.map((i) => [i.id, i])),
    [availableIngredients],
  );

  const visibleIngredients = useMemo(
    () =>
      availableIngredients.filter(
        (i) => !excludeIngredientId || i.id !== excludeIngredientId,
      ),
    [availableIngredients, excludeIngredientId],
  );

  const subtotals = rows.map((row) => {
    const ing = ingredientById.get(row.ingredientId);
    if (!ing) return 0;
    const qty = parseFloat(row.quantity) || 0;
    const cost = parseFloat(ing.costPerUnit) || 0;
    return qty * cost;
  });

  const totalCost = subtotals.reduce((a, b) => a + b, 0);
  const batchYieldNum = batchYield ? parseFloat(batchYield) : null;
  const unitCost = batchYieldNum && batchYieldNum > 0 ? totalCost / batchYieldNum : null;

  const addRow = () => {
    const firstAvailable = visibleIngredients.find(
      (i) => !rows.some((r) => r.ingredientId === i.id),
    );
    onChange([
      ...rows,
      { ingredientId: firstAvailable?.id ?? '', quantity: '' },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<RecipeBuilderRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-surface-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-base/50 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
            <tr>
              <th className="px-3 py-2 text-left">Insumo</th>
              <th className="px-3 py-2 text-right">Quantidade</th>
              <th className="px-3 py-2 text-right">Unidade</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border-subtle">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-tertiary">
                  Nenhum componente. Clique em <b>+ Insumo</b> para começar.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const ing = ingredientById.get(row.ingredientId);
              return (
                <tr key={idx} className="bg-surface-raised">
                  <td className="px-3 py-2">
                    <select
                      value={row.ingredientId}
                      onChange={(e) => updateRow(idx, { ingredientId: e.target.value })}
                      className="w-full rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="">— selecione —</option>
                      {visibleIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                          {i.kind === 'sub_recipe' ? ' (sub-receita)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                      placeholder="0,00"
                      className="w-24 rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-right text-sm tabular outline-none focus:border-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-ink-tertiary">
                    {ing ? UNIT[ing.unit] : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-secondary">
                    {ing ? `R$ ${parseFloat(ing.costPerUnit).toFixed(4)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular font-medium text-ink-primary">
                    R$ {subtotals[idx]!.toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded-md p-1 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-surface-border bg-surface-base/30">
            <tr className="text-sm">
              <td colSpan={4} className="px-3 py-2 text-right font-semibold text-ink-secondary">
                Custo total da receita
              </td>
              <td className="px-3 py-2 text-right tabular font-bold text-brand-500">
                {formatCents(Math.round(totalCost * 100))}
              </td>
              <td></td>
            </tr>
            {unitCost !== null && (
              <tr className="text-xs">
                <td colSpan={4} className="px-3 py-1 pb-2 text-right text-ink-tertiary">
                  ÷ {batchYieldNum} de rendimento = custo unitário
                </td>
                <td className="px-3 py-1 pb-2 text-right tabular font-semibold text-ink-secondary">
                  R$ {unitCost.toFixed(4)}
                </td>
                <td></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addRow}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Insumo
        </Button>
      </div>
    </div>
  );
}
