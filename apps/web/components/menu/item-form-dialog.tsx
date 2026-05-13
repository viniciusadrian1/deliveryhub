'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { api } from '../../lib/api';
import type { Category, MenuItemSummary } from '../../lib/menu-types';
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
  const [costReais, setCostReais] = useState('');
  const [prepTime, setPrepTime] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setCategoryId(editing?.category?.id ?? categories[0]?.id ?? '');
    setCostReais(editing ? (editing.costCents / 100).toFixed(2) : '');
    setPrepTime(editing?.prepTimeMinutes?.toString() ?? '');
  }, [open, editing, categories]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(costReais.replace(',', '.')) * 100) || 0;
      const body = {
        name,
        description: description || undefined,
        categoryId: categoryId || null,
        costCents: cents,
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : undefined,
      };
      if (editing) {
        return api(`/menu/items/${editing.id}`, { method: 'PATCH', body });
      }
      return api('/menu/items', {
        method: 'POST',
        body: { ...body, storeId },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['menu', storeId] });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Novo item'}
      size="md"
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
          <label className="text-sm font-medium">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
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
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800">
          CMV = custo da matéria-prima/item. Margem por plataforma é calculada
          automaticamente quando você define o preço de venda por canal.
        </p>
      </div>
    </Dialog>
  );
}
