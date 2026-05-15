'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Supplier } from '../../lib/inventory-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface SupplierFormDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Supplier | null;
}

export function SupplierFormDialog({ open, onClose, editing }: SupplierFormDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDocument(editing?.document ?? '');
    setEmail(editing?.email ?? '');
    setPhone(editing?.phone ?? '');
    setNotes(editing?.notes ?? '');
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        document: document || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      };
      if (editing) {
        return api(`/inventory/suppliers/${editing.id}`, { method: 'PATCH', body });
      }
      return api('/inventory/suppliers', { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.name}` : 'Novo fornecedor'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!name.trim()}
          >
            {editing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label="CNPJ / Documento" value={document} onChange={(e) => setDocument(e.target.value)} />
          <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}
