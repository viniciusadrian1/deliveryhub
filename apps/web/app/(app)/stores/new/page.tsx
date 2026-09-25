'use client';

import { Building2, Check, ChevronLeft, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { api } from '../../../../lib/api';
import { r } from '../../../../lib/routes';

const plans = [
  { name: 'Essencial', price: 'R$ 149/mês', description: 'Operação centralizada para uma unidade.' },
  { name: 'Profissional', price: 'R$ 249/mês', description: 'Indicadores e automações para crescer.' },
];

export default function NewStorePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [plan, setPlan] = useState(plans[0]!.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError('Informe o nome da loja ou unidade.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const store = await api<{ id: string }>('/stores', {
        method: 'POST',
        body: { name: name.trim() },
      });
      window.localStorage.setItem('deliveryhub:selected-store-id', store.id);
      window.location.href = '/select-store';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a unidade.');
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => router.push(r('/select-store'))}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para lojas
      </button>

      <section className="surface-card p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1>Adicionar loja ou unidade</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Cadastre a nova unidade e escolha o plano mais adequado para a operação.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Input
            label="Nome da loja ou unidade *"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Byte+Burguer — Unidade Centro"
          />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <CreditCard className="h-4 w-4 text-brand-400" /> Plano
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((item) => {
              const selected = plan === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setPlan(item.name)}
                  className={`rounded-xl border p-4 text-left transition-colors ${selected ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border bg-surface-base hover:border-surface-border-strong'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-primary">{item.name}</span>
                    {selected && <Check className="h-4 w-4 text-brand-400" />}
                  </div>
                  <p className="mt-2 text-sm font-bold text-brand-400">{item.price}</p>
                  <p className="mt-1 text-xs text-ink-secondary">{item.description}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-tertiary">
            Plano selecionado: {plan}. A contratação pode ser confirmada com o time comercial antes da cobrança.
          </p>
        </div>

        {error && <p role="alert" className="mt-5 text-sm text-danger-bright">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push(r('/select-store'))}>Cancelar</Button>
          <Button onClick={() => void submit()} loading={saving}>Criar unidade</Button>
        </div>
      </section>
    </main>
  );
}
