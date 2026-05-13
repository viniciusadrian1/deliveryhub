'use client';

import { useMutation } from '@tanstack/react-query';
import { Mail, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../../lib/api';
import {
  type InvitationCreated,
  type MembershipRole,
  ROLE_LABELS,
} from '../../../lib/settings-types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { ComingSoon, SettingsSection } from '../section';

const INVITABLE_ROLES: MembershipRole[] = ['manager', 'staff', 'financial'];

export function MembersSection() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('staff');
  const [success, setSuccess] = useState<{ email: string; expiresAt: string } | null>(
    null,
  );

  const invite = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (!trimmed) throw new Error('Informe um e-mail.');
      const result = await api<InvitationCreated>('/organizations/invitations', {
        method: 'POST',
        body: { email: trimmed, role },
      });
      return result;
    },
    onSuccess: (result) => {
      setSuccess({ email: email.trim(), expiresAt: result.expiresAt });
      setEmail('');
    },
  });

  const expiresLabel = success
    ? new Date(success.expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Convidar pessoa"
        description="Envie um convite por e-mail. O acesso é liberado quando a pessoa aceitar."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <Input
            label="E-mail"
            type="email"
            placeholder="colega@suaempresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            disabled={invite.isPending}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
              Função
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MembershipRole)}
              disabled={invite.isPending}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary outline-none transition-colors hover:border-surface-border-strong focus:border-brand-500"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => invite.mutate()}
              loading={invite.isPending}
              disabled={!email.trim()}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Enviar convite
            </Button>
          </div>
        </div>

        {invite.error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger-bright">
            {(invite.error as Error).message || 'Falha ao enviar convite.'}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs font-medium text-success-bright">
            Convite enviado para <b>{success.email}</b> — expira em {expiresLabel}.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Membros da organização"
        description="Lista completa de quem tem acesso a este DeliveryHub."
        action={<ComingSoon>em breve</ComingSoon>}
      >
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-ink-secondary">
            Em breve você poderá ver, editar funções e remover membros aqui.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
