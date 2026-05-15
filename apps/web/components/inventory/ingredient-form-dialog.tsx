'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Ingredient, IngredientKind, IngredientUnit } from '../../lib/inventory-types';
import { INGREDIENT_UNIT_FULL_LABELS, INGREDIENT_UNIT_LABELS } from '../../lib/inventory-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface IngredientFormDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  /** Quando `editing` está presente, é update. Senão é create. */
  editing?: Ingredient | null;
  /** Pré-seleciona o kind. Padrão `raw`. */
  defaultKind?: IngredientKind;
}

const UNITS: IngredientUnit[] = ['gram', 'kilogram', 'milliliter', 'liter', 'unit'];

export function IngredientFormDialog({
  open,
  onClose,
  storeId,
  editing,
  defaultKind = 'raw',
}: IngredientFormDialogProps) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<IngredientKind>(defaultKind);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<IngredientUnit>('gram');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [batchYield, setBatchYield] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? defaultKind);
    setName(editing?.name ?? '');
    setUnit(editing?.unit ?? 'gram');
    setCostPerUnit(editing?.costPerUnit ?? '');
    setBatchYield(editing?.batchYield ?? '');
    setNotes(editing?.notes ?? '');
  }, [open, editing, defaultKind]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api(`/inventory/ingredients/${editing.id}`, {
          method: 'PATCH',
          body: {
            name,
            unit,
            costPerUnit: kind === 'raw' ? costPerUnit : undefined,
            batchYield: kind === 'sub_recipe' ? batchYield : undefined,
            notes,
          },
        });
      }
      return api('/inventory/ingredients', {
        method: 'POST',
        body: {
          storeId,
          kind,
          name,
          unit,
          costPerUnit: kind === 'raw' ? costPerUnit : undefined,
          batchYield: kind === 'sub_recipe' ? batchYield : undefined,
          notes,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Novo insumo / sub-receita'}
      description={
        kind === 'raw'
          ? 'Item comprado de fornecedor — define custo unitário base.'
          : 'Receita interna que serve de componente em produtos finais (ex.: molho da casa).'
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!name.trim() || (kind === 'sub_recipe' && !batchYield.trim())}
          >
            {editing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!editing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('raw')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                kind === 'raw'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-surface-border-subtle text-ink-secondary'
              }`}
            >
              Insumo (raw)
            </button>
            <button
              type="button"
              onClick={() => setKind('sub_recipe')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                kind === 'sub_recipe'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-surface-border-subtle text-ink-secondary'
              }`}
            >
              Sub-receita
            </button>
          </div>
        )}

        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
              Unidade
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as IngredientUnit)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {INGREDIENT_UNIT_LABELS[u]} ({INGREDIENT_UNIT_FULL_LABELS[u]})
                </option>
              ))}
            </select>
          </div>

          {kind === 'raw' ? (
            <Input
              label={`Custo por ${INGREDIENT_UNIT_LABELS[unit]} (R$)`}
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              placeholder="0,045"
              inputMode="decimal"
              hint="Use 4-8 casas para precisão (ex.: 0,045 = R$45/kg)."
            />
          ) : (
            <Input
              label={`Rendimento (${INGREDIENT_UNIT_LABELS[unit]} por preparo)`}
              value={batchYield}
              onChange={(e) => setBatchYield(e.target.value)}
              placeholder="500"
              inputMode="decimal"
              required
              hint="Quanto a receita rende a cada execução."
            />
          )}
        </div>

        <Input
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {kind === 'sub_recipe' && !editing && (
          <p className="rounded-md border border-info/30 bg-info-soft px-3 py-2 text-xs text-ink-secondary">
            Depois de criar, defina os componentes desta sub-receita usando o
            botão <b>Editar receita</b> na listagem. O custo unitário será
            calculado automaticamente.
          </p>
        )}
      </div>
    </Dialog>
  );
}
