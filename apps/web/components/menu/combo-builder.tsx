'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { formatCents } from '../../lib/format';
import type { ComboBuilderRow, MenuItemSummary } from '../../lib/menu-types';
import { SALES_KIND_LABELS } from '../../lib/menu-types';
import { Button } from '../ui/button';

interface ComboBuilderProps {
  /** Catálogo de items single (não-combo) disponíveis pra entrar no combo. */
  availableItems: MenuItemSummary[];
  /** Linhas do combo em edição. */
  rows: ComboBuilderRow[];
  onChange: (rows: ComboBuilderRow[]) => void;
  /** O próprio combo sendo editado (pra excluir da lista). */
  excludeMenuItemId?: string;
}

/**
 * Tabela editável dos componentes de um combo.
 *
 * Cada linha: item escolhido + quantidade. Mostra subtotal de CMV e total.
 * Diferente da receita (insumos), aqui é hierarquia de produtos finais:
 * combo "X Salada Bacon + Coca + Batata" aponta para 3 MenuItems single.
 *
 * Restrições aplicadas no backend (combo_components_must_be_single,
 * combo_self_reference). UI tenta evitar mostrar essas opções na seleção.
 */
export function ComboBuilder({
  availableItems,
  rows,
  onChange,
  excludeMenuItemId,
}: ComboBuilderProps) {
  const byId = useMemo(
    () => new Map(availableItems.map((i) => [i.id, i])),
    [availableItems],
  );

  // Só itens single (não-combo) e que não sejam o próprio combo sendo editado.
  const visibleItems = useMemo(
    () =>
      availableItems.filter(
        (i) =>
          i.productKind === 'single' &&
          (!excludeMenuItemId || i.id !== excludeMenuItemId) &&
          !i.archivedAt,
      ),
    [availableItems, excludeMenuItemId],
  );

  const subtotals = rows.map((row) => {
    const item = byId.get(row.componentMenuItemId);
    if (!item) return 0;
    return item.costCents * row.quantity;
  });

  const totalCostCents = subtotals.reduce((a, b) => a + b, 0);

  const addRow = () => {
    const firstAvailable = visibleItems.find(
      (i) => !rows.some((r) => r.componentMenuItemId === i.id),
    );
    onChange([
      ...rows,
      { componentMenuItemId: firstAvailable?.id ?? '', quantity: 1 },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<ComboBuilderRow>) => {
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
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">CMV unit.</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border-subtle">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-tertiary">
                  Nenhum componente. Clique em <b>+ Produto</b> pra começar.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const item = byId.get(row.componentMenuItemId);
              return (
                <tr key={idx} className="bg-surface-raised">
                  <td className="px-3 py-2">
                    <select
                      value={row.componentMenuItemId}
                      onChange={(e) =>
                        updateRow(idx, { componentMenuItemId: e.target.value })
                      }
                      className="w-full rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="">— selecione —</option>
                      {visibleItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-tertiary">
                    {item ? SALES_KIND_LABELS[item.salesKind] : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(idx, {
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-16 rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-right text-sm tabular outline-none focus:border-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-secondary">
                    {item ? formatCents(item.costCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular font-medium text-ink-primary">
                    {formatCents(subtotals[idx]!)}
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
                CMV total do combo
              </td>
              <td className="px-3 py-2 text-right tabular font-bold text-brand-500">
                {formatCents(totalCostCents)}
              </td>
              <td></td>
            </tr>
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
          Produto
        </Button>
      </div>
    </div>
  );
}
