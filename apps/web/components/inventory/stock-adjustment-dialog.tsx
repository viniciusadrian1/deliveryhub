'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Ingredient } from '../../lib/inventory-types';
import { INGREDIENT_UNIT_LABELS } from '../../lib/inventory-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface StockAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  defaultIngredientId?: string;
}

type AdjustmentReason = 'adjustment' | 'waste' | 'transfer_in' | 'transfer_out' | 'initial';

const REASONS: { value: AdjustmentReason; label: string; sign: 'positive' | 'negative' | 'any' }[] = [
  { value: 'initial', label: 'Saldo inicial', sign: 'positive' },
  { value: 'adjustment', label: 'Ajuste manual', sign: 'any' },
  { value: 'waste', label: 'Perda / descarte', sign: 'negative' },
  { value: 'transfer_in', label: 'Transferência (entrada)', sign: 'positive' },
  { value: 'transfer_out', label: 'Transferência (saída)', sign: 'negative' },
];

export function StockAdjustmentDialog({
  open,
  onClose,
  storeId,
  defaultIngredientId,
}: StockAdjustmentDialogProps) {
  const qc = useQueryClient();
  const [ingredientId, setIngredientId] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('adjustment');
  const [signedQuantity, setSignedQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}`),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setIngredientId(defaultIngredientId ?? '');
    setReason('adjustment');
    setSignedQuantity('');
    setNotes('');
  }, [open, defaultIngredientId]);

  const ingredient = ingredients.find((i) => i.id === ingredientId);

  // Para reasons negativos, normalizamos: se usuário digitou positivo, vira negativo.
  const reasonMeta = REASONS.find((r) => r.value === reason)!;
  const normalizedQty = (() => {
    const qty = parseFloat(signedQuantity);
    if (isNaN(qty) || qty === 0) return '';
    if (reasonMeta.sign === 'negative' && qty > 0) return String(-qty);
    if (reasonMeta.sign === 'positive' && qty < 0) return String(Math.abs(qty));
    return signedQuantity;
  })();

  const mutation = useMutation({
    mutationFn: async () =>
      api('/inventory/stock/adjustments', {
        method: 'POST',
        body: {
          storeId,
          ingredientId,
          quantity: normalizedQty,
          reason,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajuste de estoque"
      description="Registra entrada, saída ou correção manual."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!ingredientId || !normalizedQty}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
            Insumo
          </label>
          <select
            value={ingredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
          >
            <option value="">— selecione —</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({INGREDIENT_UNIT_LABELS[i.unit]})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
            Motivo
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as AdjustmentReason)}
            className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={`Quantidade${ingredient ? ` (${INGREDIENT_UNIT_LABELS[ingredient.unit]})` : ''}`}
          value={signedQuantity}
          onChange={(e) => setSignedQuantity(e.target.value)}
          inputMode="decimal"
          hint={
            reasonMeta.sign === 'negative'
              ? 'Saída: número positivo (será convertido para negativo).'
              : reasonMeta.sign === 'positive'
                ? 'Entrada: número positivo.'
                : 'Use sinal negativo (-) para saída.'
          }
        />

        <Input label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}
