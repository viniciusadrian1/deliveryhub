'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Ingredient, Supplier } from '../../lib/inventory-types';
import { INGREDIENT_UNIT_LABELS } from '../../lib/inventory-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface PurchaseFormDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  /** Pré-seleciona ingrediente se vier do contexto. */
  defaultIngredientId?: string;
}

export function PurchaseFormDialog({
  open,
  onClose,
  storeId,
  defaultIngredientId,
}: PurchaseFormDialogProps) {
  const qc = useQueryClient();
  const [ingredientId, setIngredientId] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [notes, setNotes] = useState('');

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId, 'raw'],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}&kind=raw`),
    enabled: open,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<Supplier[]>('/inventory/suppliers'),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setIngredientId(defaultIngredientId ?? '');
    setIngredientSearch(ingredients.find((i) => i.id === defaultIngredientId)?.name ?? '');
    setSupplierSearch('');
    setSupplierId('');
    setQuantity('');
    setUnitCost('');
    setInvoiceNumber('');
    setPurchasedAt('');
    setNotes('');
  }, [open, defaultIngredientId]);

  const ingredient = ingredients.find((i) => i.id === ingredientId);
  const filteredIngredients = ingredients.filter((i) => i.name.toLocaleLowerCase().includes(ingredientSearch.trim().toLocaleLowerCase()));
  const qtyNum = parseFloat(quantity.replace(',', '.')) || 0;
  const costNum = parseFloat(unitCost.replace(',', '.')) || 0;
  const total = qtyNum * costNum;

  const mutation = useMutation({
    mutationFn: async () =>
      api('/inventory/purchases', {
        method: 'POST',
        body: {
          storeId,
          ingredientId,
          supplierId: supplierId || null,
          quantity,
          unitCost,
          invoiceNumber: invoiceNumber || undefined,
          purchasedAt: purchasedAt ? new Date(purchasedAt).toISOString() : undefined,
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
      title="Nova compra"
      description="Aumenta o estoque do insumo e atualiza o custo médio."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={
              !ingredientId ||
              qtyNum <= 0 ||
              !unitCost ||
              costNum < 0 ||
              !purchasedAt ||
              !invoiceNumber.trim()
            }
          >
            Registrar compra
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {mutation.error && (
          <p role="alert" className="text-sm text-danger-bright">
            {mutation.error.message}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
            Insumo <span className="text-danger-bright">*</span>
          </label>
          <input
            list="purchase-ingredients"
            value={ingredientSearch}
            onChange={(e) => {
              const value = e.target.value;
              setIngredientSearch(value);
              setIngredientId(ingredients.find((i) => i.name === value)?.id ?? '');
            }}
            placeholder="Selecione ou pesquise um insumo"
            className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
          />
          <datalist id="purchase-ingredients">
            {filteredIngredients.map((i) => (
              <option key={i.id} value={i.name}>{INGREDIENT_UNIT_LABELS[i.unit]}</option>
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
            Fornecedor (opcional)
          </label>
          <input
            list="purchase-suppliers"
            value={supplierSearch}
            onChange={(e) => {
              const value = e.target.value;
              setSupplierSearch(value);
              setSupplierId(suppliers.find((s) => s.name === value)?.id ?? '');
            }}
            placeholder="Opcional: selecione ou pesquise"
            className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500"
          />
          <datalist id="purchase-suppliers">
            {suppliers.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Quantidade${ingredient ? ` (${INGREDIENT_UNIT_LABELS[ingredient.unit]})` : ''} *`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="1000"
          />
          <Input
            label={`Custo por ${ingredient ? INGREDIENT_UNIT_LABELS[ingredient.unit] : 'unidade'} (R$) *`}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
            placeholder="0,045"
          />
        </div>

        {total > 0 && (
          <div className="rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-sm text-ink-primary">
            Total da nota:{' '}
            <span className="font-bold tabular text-brand-500">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data da compra *"
            type="date"
            required
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
          />
          <Input
            label="Nº da nota *"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={80}
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <Input label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-[11px] text-ink-tertiary"><span className="text-danger-bright">*</span> Indica obrigatoriedade</p>
      </div>
    </Dialog>
  );
}
