'use client';

import { LogOut, ShieldCheck } from 'lucide-react';

import { useAuth } from '../../../lib/auth-context';
import { ROLE_LABELS, type MembershipRole } from '../../../lib/settings-types';
import { Button } from '../../ui/button';
import { ComingSoon, FieldRow, SettingsSection } from '../section';

export function AccountSection() {
  const { state, logout } = useAuth();
  if (!state) return null;

  const role = (state.role as MembershipRole) ?? 'staff';

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Conta"
        description="Suas credenciais e identidade dentro do DeliveryHub."
      >
        <div className="divide-y divide-surface-border-subtle">
          <FieldRow label="Nome">{state.user.name}</FieldRow>
          <FieldRow label="E-mail">{state.user.email}</FieldRow>
          <FieldRow label="Função" hint="Definida pelo proprietário">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-500">
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABELS[role] ?? role}
            </span>
          </FieldRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Segurança"
        description="Mantenha o acesso à sua conta protegido."
      >
        <div className="divide-y divide-surface-border-subtle">
          <div className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-primary">Senha</p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Use uma senha forte que você não usa em outros serviços.
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled>
              Alterar <ComingSoon>em breve</ComingSoon>
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-primary">Sessões ativas</p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Encerre sessões antigas em dispositivos que você não usa mais.
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled>
              Gerenciar <ComingSoon>em breve</ComingSoon>
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sair"
        description="Encerre sua sessão neste navegador."
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            Você precisará fazer login novamente para voltar a usar o Hub.
          </p>
          <Button
            variant="secondary"
            onClick={() => void logout()}
            leftIcon={<LogOut className="h-3.5 w-3.5" />}
          >
            Sair
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
