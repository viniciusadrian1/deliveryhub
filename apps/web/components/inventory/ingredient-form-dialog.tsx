'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Ingredient, IngredientKind, IngredientUnit } from '../../lib/inventory-types';
import { INGREDIENT_UNIT_FULL_LABELS, INGREDIENT_UNIT_LABELS } from '../../lib/inventory-types';
import { normalizeDecimalInput } from '../../lib/money';
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
  const [costBulk, setCostBulk] = useState('');
  const [batchYield, setBatchYield] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [targetDays, setTargetDays] = useState('');
  const [notes, setNotes] = useState('');

  // Sincroniza estado ao abrir ou mudar edição
  useEffect(() => {
    if (!open) return;
    const currentKind = editing?.kind ?? defaultKind;
    const currentUnit = editing?.unit ?? 'gram';
    setKind(currentKind);
    setName(editing?.name ?? '');
    setUnit(currentUnit);

    const rawCost = editing?.costPerUnit ?? '';
    setCostPerUnit(rawCost);
    if (rawCost && !isNaN(parseFloat(rawCost))) {
      const num = parseFloat(rawCost);
      if (currentUnit === 'gram' || currentUnit === 'milliliter') {
        setCostBulk((num * 1000).toFixed(2).replace('.', ','));
      } else {
        setCostBulk(num.toFixed(2).replace('.', ','));
      }
    } else {
      setCostBulk('');
    }

    setBatchYield(editing?.batchYield ?? '');
    setMinLevel(editing?.minLevel ?? '');
    setTargetDays(editing?.targetDays?.toString() ?? '');
    setNotes(editing?.notes ?? '');
  }, [open, editing, defaultKind]);

  // Manipulador quando altera o custo por Quilo ou Litro (bulk)
  const handleBulkChange = (value: string) => {
    setCostBulk(value);
    const cleaned = normalizeDecimalInput(value);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      if (unit === 'gram' || unit === 'milliliter') {
        setCostPerUnit((num / 1000).toString());
      } else {
        setCostPerUnit(num.toString());
      }
    } else if (!value.trim()) {
      setCostPerUnit('');
    }
  };

  // Manipulador quando altera o custo por unidade base direta
  const handleDirectCostChange = (value: string) => {
    setCostPerUnit(value);
    const cleaned = normalizeDecimalInput(value);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      if (unit === 'gram' || unit === 'milliliter') {
        setCostBulk((num * 1000).toFixed(2).replace('.', ','));
      } else {
        setCostBulk(num.toFixed(2).replace('.', ','));
      }
    } else if (!value.trim()) {
      setCostBulk('');
    }
  };

  const handleUnitChange = (newUnit: IngredientUnit) => {
    setUnit(newUnit);
    const cleaned = normalizeDecimalInput(costPerUnit);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      if (newUnit === 'gram' || newUnit === 'milliliter') {
        setCostBulk((num * 1000).toFixed(2).replace('.', ','));
      } else {
        setCostBulk(num.toFixed(2).replace('.', ','));
      }
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const minLevelValue = minLevel.trim() ? minLevel.replace(',', '.') : null;
      const targetDaysValue = targetDays.trim() ? parseInt(targetDays, 10) : null;
      const cleanCost = normalizeDecimalInput(costPerUnit);
      const cleanBatchYield = normalizeDecimalInput(batchYield);

      if (editing) {
        return api(`/inventory/ingredients/${editing.id}`, {
          method: 'PATCH',
          body: {
            name,
            unit,
            costPerUnit: kind === 'raw' ? (cleanCost || '0') : undefined,
            batchYield: kind === 'sub_recipe' ? cleanBatchYield : undefined,
            minLevel: minLevelValue,
            targetDays: targetDaysValue,
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
          costPerUnit: kind === 'raw' ? (cleanCost || '0') : undefined,
          batchYield: kind === 'sub_recipe' ? cleanBatchYield : undefined,
          minLevel: minLevelValue,
          targetDays: targetDaysValue,
          notes,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
  });

  const rawFieldsValid =
    kind !== 'raw' ||
    (parseFloat(normalizeDecimalInput(costPerUnit)) > 0 &&
      minLevel.trim() !== '' &&
      Number.isInteger(Number(targetDays)) &&
      Number(targetDays) >= 1 &&
      Number(targetDays) <= 90);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Novo Insumo ou Preparo'}
      description={
        kind === 'raw'
          ? 'Matéria-prima ou ingrediente comprado de fornecedores para uso nas receitas.'
          : 'Receita ou preparo interno produzido na própria cozinha (ex.: molhos, massas).'
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
            disabled={!name.trim() || !rawFieldsValid || (kind === 'sub_recipe' && !batchYield.trim())}
          >
            {editing ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('raw')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                kind === 'raw'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-surface-border-subtle text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Insumo comprado
            </button>
            <button
              type="button"
              onClick={() => setKind('sub_recipe')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                kind === 'sub_recipe'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-surface-border-subtle text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Preparo da casa (Sub-receita)
            </button>
          </div>
        )}

        <Input
          label="Nome do item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Doce de Leite, Farinha de Trigo..."
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Unidade de medida
            </label>
            <select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value as IngredientUnit)}
              className="h-10 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {INGREDIENT_UNIT_FULL_LABELS[u]} ({INGREDIENT_UNIT_LABELS[u]})
                </option>
              ))}
            </select>
          </div>

          {kind === 'raw' ? (
            unit === 'gram' || unit === 'milliliter' ? (
              <Input
                label={`Preço por ${unit === 'gram' ? 'Quilo (R$/kg)' : 'Litro (R$/L)'}`}
                value={costBulk}
                onChange={(e) => handleBulkChange(e.target.value)}
                placeholder={unit === 'gram' ? '45,00' : '15,00'}
                inputMode="decimal"
                hint={`Equivale a R$ ${costPerUnit ? parseFloat(costPerUnit.replace(',', '.')).toFixed(4) : '0,0000'} por ${INGREDIENT_UNIT_LABELS[unit]}`}
              />
            ) : (
              <Input
                label={`Custo por ${INGREDIENT_UNIT_LABELS[unit]} (R$)`}
                value={costPerUnit}
                onChange={(e) => handleDirectCostChange(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                hint="Valor de custo unitário deste item."
              />
            )
          ) : (
            <Input
              label={`Rendimento por preparo (${INGREDIENT_UNIT_LABELS[unit]})`}
              value={batchYield}
              onChange={(e) => setBatchYield(e.target.value)}
              placeholder="500"
              inputMode="decimal"
              required
              hint="Quanto a receita rende a cada lote produzido."
            />
          )}
        </div>

        {kind === 'raw' && (unit === 'gram' || unit === 'milliliter') && (
          <div className="rounded-lg border border-surface-border-subtle bg-surface-base/30 p-2.5 text-xs text-ink-secondary">
            <div className="flex items-center justify-between">
              <span>Custo calculado por {INGREDIENT_UNIT_LABELS[unit]}:</span>
              <span className="font-mono font-semibold text-ink-primary">
                R$ {costPerUnit ? parseFloat(costPerUnit.replace(',', '.')).toFixed(4) : '0,0000'} / {INGREDIENT_UNIT_LABELS[unit]}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-tertiary">
              Dica: Você pode informar o preço por quilo ou litro diretamente acima, e o sistema converte automaticamente para o custo das receitas.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-surface-border-subtle bg-surface-base/40 p-3.5 space-y-3">
          <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Controle de Reposição e Alertas
            </p>
            <p className="text-[11px] text-ink-tertiary">
              Configure quando você quer ser alertado para repor o estoque.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Estoque mínimo (${INGREDIENT_UNIT_LABELS[unit]})`}
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              placeholder="Ex: 500"
              inputMode="decimal"
              required
              hint="Obrigatório para calcular os alertas de reposição."
            />
            <Input
              label="Dias de cobertura"
              value={targetDays}
              onChange={(e) => setTargetDays(e.target.value)}
              placeholder="7"
              type="number"
              min={1}
              max={90}
              required
              hint="Obrigatório para sugerir compra para durar X dias."
            />
          </div>
        </div>

        <Input
          label="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Marca preferida, fornecedor habitual..."
        />

        {kind === 'sub_recipe' && !editing && (
          <p className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-xs text-ink-secondary">
            Após cadastrar a sub-receita, utilize a opção <b>Editar receita</b> para adicionar os insumos que compõem este preparo. O custo será calculado automaticamente.
          </p>
        )}
      </div>
    </Dialog>
  );
}
