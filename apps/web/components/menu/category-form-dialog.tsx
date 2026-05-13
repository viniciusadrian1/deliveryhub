'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Category } from '../../lib/menu-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  editing?: Category | null;
}

export function CategoryFormDialog({ open, onClose, storeId, editing }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, description: description || undefined };
      if (editing) {
        return api(`/menu/categories/${editing.id}`, { method: 'PATCH', body });
      }
      return api('/menu/categories', { method: 'POST', body: { ...body, storeId } });
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
      title={editing ? `Editar "${editing.name}"` : 'Nova categoria'}
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
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        <Input
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
