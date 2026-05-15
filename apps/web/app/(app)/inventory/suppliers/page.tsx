'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronLeft, Edit2, Plus, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { SupplierFormDialog } from '../../../../components/inventory/supplier-form-dialog';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Button } from '../../../../components/ui/button';
import { api } from '../../../../lib/api';
import type { Supplier } from '../../../../lib/inventory-types';
import { r } from '../../../../lib/routes';

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<Supplier[]>('/inventory/suppliers'),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api(`/inventory/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  return (
    <div className="flex flex-col">
      <Link
        href={r('/inventory')}
        className="mb-3 inline-flex items-center gap-1 self-start text-xs text-ink-tertiary hover:text-ink-secondary"
      >
        <ChevronLeft className="h-3 w-3" />
        Estoque
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1>Fornecedores</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Cadastro de fornecedores ligados às compras de insumos.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Novo fornecedor
        </Button>
      </header>

      <section className="surface-card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-tertiary">Carregando…</p>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nenhum fornecedor cadastrado"
            description="Cadastre fornecedores para vincular às compras de insumos e manter histórico."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/20 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 text-left">Nome</th>
                <th className="px-5 py-2 text-left">Documento</th>
                <th className="px-5 py-2 text-left">Contato</th>
                <th className="w-20 px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-surface-overlay/50">
                  <td className="px-5 py-2.5 font-medium text-ink-primary">{s.name}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-secondary">
                    {s.document ?? '—'}
                  </td>
                  <td className="px-5 py-2.5 text-ink-secondary">
                    {s.email ?? s.phone ?? '—'}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                        className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
                        aria-label="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Arquivar ${s.name}?`)) archive.mutate(s.id);
                        }}
                        className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                        aria-label="Arquivar"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <SupplierFormDialog open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}
