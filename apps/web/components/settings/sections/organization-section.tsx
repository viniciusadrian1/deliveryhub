'use client';

import { Building2, Store as StoreIcon } from 'lucide-react';

import { useAuth } from '../../../lib/auth-context';
import { Button } from '../../ui/button';
import { ComingSoon, FieldRow, SettingsSection } from '../section';

export function OrganizationSection() {
  const { state } = useAuth();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Organização"
        description="Dados da empresa que aparecem para sua equipe e clientes."
        action={
          <Button size="sm" variant="secondary" disabled>
            Editar <ComingSoon>em breve</ComingSoon>
          </Button>
        }
      >
        <div className="divide-y divide-surface-border-subtle">
          <FieldRow label="Nome">
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-ink-tertiary" />
              {state.organization.name || 'Sua organização'}
            </span>
          </FieldRow>
          <FieldRow label="ID interno" hint="Identificador único da sua organização">
            <span className="font-mono text-xs text-ink-secondary">
              {state.organization.id}
            </span>
          </FieldRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Loja"
        description="A loja física em que os pedidos chegam."
        action={
          <Button size="sm" variant="secondary" disabled>
            Editar <ComingSoon>em breve</ComingSoon>
          </Button>
        }
      >
        {state.storeId ? (
          <div className="divide-y divide-surface-border-subtle">
            <FieldRow label="ID da loja">
              <span className="font-mono text-xs text-ink-secondary">
                {state.storeId}
              </span>
            </FieldRow>
            <FieldRow label="Endereço" hint="Aparece nos comprovantes">
              <ComingSoon>em breve</ComingSoon>
            </FieldRow>
            <FieldRow label="Fuso horário" hint="Usado para horários de pausa">
              <ComingSoon>em breve</ComingSoon>
            </FieldRow>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-base">
              <StoreIcon className="h-5 w-5 text-ink-tertiary" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-primary">
                Nenhuma loja configurada
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                Crie sua primeira loja para começar a receber pedidos.
              </p>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
