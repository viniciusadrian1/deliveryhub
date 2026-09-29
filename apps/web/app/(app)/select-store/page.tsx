'use client';

import { Building2, Check, Plus, Store, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '../../../components/ui/button';
import { useConfirm } from '../../../components/ui/confirm-dialog';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { r } from '../../../lib/routes';

export default function SelectStorePage() {
  const router = useRouter();
  const { state, loading, selectStore } = useAuth();
  const confirm = useConfirm();

  if (loading || !state) return null;

  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-xl sm:p-8">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-primary">Escolha sua loja</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Selecione a unidade que você deseja administrar no DeliveryHub.
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {state.stores.map((store) => {
            const selected = state.storeId === store.id;
            return (
              <div
                key={store.id}
                className="flex w-full items-center gap-3 rounded-xl border border-surface-border-subtle bg-surface-base px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    selectStore(store.id);
                    router.push(r('/hub'));
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:text-brand-300"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500/10 text-brand-400">
                    {store.logoUrl ? <img src={store.logoUrl} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-primary">{store.name}</span>
                    <span className="text-xs text-ink-tertiary">Unidade cadastrada</span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-success-bright" />}
                </button>
                {state.role === 'owner' && (
                  <button
                    type="button"
                    aria-label={`Excluir ${store.name}`}
                    className="rounded-md p-2 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                    onClick={async (event) => {
                      event.stopPropagation();
                      const first = await confirm({
                        title: 'Excluir loja?',
                        description: `A loja “${store.name}” será removida da conta. Essa ação não pode ser desfeita.`,
                        confirmLabel: 'Continuar',
                        danger: true,
                      });
                      if (!first) return;
                      const second = await confirm({
                        title: 'Confirma a exclusão permanente?',
                        description: `Todos os dados operacionais vinculados a “${store.name}” serão apagados permanentemente.`,
                        confirmLabel: 'Excluir permanentemente',
                        danger: true,
                      });
                      if (!second) return;
                      await api(`/stores/${store.id}`, { method: 'DELETE' });
                      window.location.reload();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <Button
          className="mt-5 w-full"
          variant="secondary"
          onClick={() => router.push(r('/stores/new'))}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Adicionar nova loja ou unidade
        </Button>
      </section>
    </main>
  );
}
