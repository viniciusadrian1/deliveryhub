'use client';

import { Building2, ImagePlus, Store as StoreIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { SettingsSection } from '../section';

const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (GMT-3)'],
  ['America/Manaus', 'Manaus (GMT-4)'],
  ['America/Rio_Branco', 'Rio Branco (GMT-5)'],
];

export function OrganizationSection() {
  const { state, selectStore } = useAuth();
  const store = state?.stores.find((item) => item.id === state.storeId) ?? state?.stores[0];
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [address, setAddress] = useState({ street: '', number: '', city: '', state: '', zipCode: '' });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const value = store.address ?? {};
    setName(store.name);
    setTimezone(store.timezone || 'America/Sao_Paulo');
    setLogoUrl(store.logoUrl);
    setAddress({
      street: String(value.street ?? ''),
      number: String(value.number ?? ''),
      city: String(value.city ?? ''),
      state: String(value.state ?? ''),
      zipCode: String(value.zipCode ?? ''),
    });
  }, [store?.id, store?.name, store?.timezone, store?.logoUrl, store?.address]);

  if (!state || !store) return null;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api(`/stores/${store.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), timezone, logoUrl, address },
      });
      setMessage('Dados da loja atualizados.');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar os dados.');
    } finally {
      setSaving(false);
    }
  };

  const readLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Escolha um arquivo de imagem.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection title="Organização" description="Dados da empresa que aparecem para sua equipe e clientes.">
        <div className="divide-y divide-surface-border-subtle">
          <div className="flex items-center gap-3 py-2.5 text-sm text-ink-primary">
            <Building2 className="h-3.5 w-3.5 text-ink-tertiary" />
            <span>{state.organization.name || 'Sua organização'}</span>
          </div>
          <p className="py-2.5 text-xs text-ink-tertiary">ID interno: {state.organization.id}</p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Organização & Loja"
        description="Altere a unidade ativa, identidade visual, endereço e fuso horário."
        action={<Button size="sm" onClick={() => void save()} loading={saving}>Salvar alterações</Button>}
      >
        <div className="space-y-5">
          {state.stores.length > 1 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-secondary">Loja ativa</label>
              <select value={store.id} onChange={(event) => selectStore(event.target.value)} className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500">
                {state.stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-brand-500/10 text-brand-400">
              {logoUrl ? <img src={logoUrl} alt="Logo da loja" className="h-full w-full object-cover" /> : <StoreIcon className="h-7 w-7" />}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-xs font-semibold text-ink-primary hover:border-brand-500">
                <ImagePlus className="h-4 w-4 text-brand-400" /> Adicionar logo
                <input type="file" accept="image/*" className="hidden" onChange={(event) => readLogo(event.target.files?.[0])} />
              </label>
              <p className="mt-1 text-[11px] text-ink-tertiary">PNG ou JPG. A imagem aparece no lugar do ícone padrão.</p>
            </div>
          </div>

          <Input label="Nome da loja *" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Rua" value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} />
            <Input label="Número" value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} />
            <Input label="Cidade" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} />
            <Input label="UF" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} maxLength={2} />
            <Input label="CEP" value={address.zipCode} onChange={(event) => setAddress({ ...address, zipCode: event.target.value })} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">Fuso horário *</label>
              <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none focus:border-brand-500">
                {TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          {message && <p role="status" className="text-sm text-ink-secondary">{message}</p>}
        </div>
      </SettingsSection>
    </div>
  );
}
