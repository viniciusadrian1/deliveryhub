'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import {
  type InvitationCreated,
  type MembershipRole,
  ROLE_LABELS,
} from '../../../lib/settings-types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { SettingsSection } from '../section';

interface PendingInvitation {
  id: string;
  email: string;
  role: MembershipRole;
  expiresAt: string;
}
export function MembersSection() {
  const { state } = useAuth();
  const allowed = state?.role === 'owner' || state?.role === 'manager';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('staff');
  const [success, setSuccess] = useState<(InvitationCreated & { email: string }) | null>(null);
  const qc = useQueryClient();
  const key = ['invitations', state?.organization.id];
  const pending = useQuery({
    queryKey: key,
    queryFn: () => api<PendingInvitation[]>('/organizations/invitations'),
    enabled: allowed,
  });
  const invite = useMutation({
    mutationFn: (input: { email: string; role: MembershipRole }) =>
      api<InvitationCreated>('/organizations/invitations', { method: 'POST', body: input }),
    onSuccess: (result, input) => {
      setSuccess({ ...result, email: input.email });
      setEmail('');
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  if (!allowed)
    return (
      <p className="text-sm text-ink-secondary">
        Apenas proprietários e gerentes podem convidar membros.
      </p>
    );
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Convidar pessoa"
        description="Convide alguém para trabalhar na sua loja e escolha a função de acesso."
      >
        <form
          className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setSuccess(null);
            invite.mutate({ email: email.trim().toLowerCase(), role });
          }}
        >
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={invite.isPending}
          />
          <label className="flex flex-col gap-1.5 text-xs text-ink-secondary">
            Função
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MembershipRole)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm"
            >
              {(['manager', 'staff', 'financial'] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" loading={invite.isPending}>
              Enviar convite
            </Button>
          </div>
        </form>
        {invite.error && (
          <p role="alert" className="mt-3 text-sm text-danger-bright">
            {invite.error.message}
          </p>
        )}
        {success && (
          <div className="mt-4 space-y-2 text-sm" role="status">
            <p>
              {success.delivery === 'email' ? 'Convite enviado' : 'Convite criado'} para{' '}
              <b>{success.email}</b>. Válido até{' '}
              {new Date(success.expiresAt).toLocaleDateString('pt-BR')}.
            </p>
            {success.invitationUrl && (
              <>
                <p>
                  O envio por e-mail não está configurado. Copie este link e envie à pessoa
                  convidada.
                </p>
                <Input
                  label="Link do convite"
                  readOnly
                  value={success.invitationUrl}
                  onFocus={(e) => e.target.select()}
                />
              </>
            )}
          </div>
        )}
      </SettingsSection>
      <SettingsSection
        title="Convites pendentes"
        description="Reenviar gera um novo link e invalida o anterior."
      >
        {pending.isLoading && <p>Carregando…</p>}
        {pending.error && (
          <p role="alert" className="text-sm text-danger-bright">
            {pending.error.message}
          </p>
        )}
        {pending.data?.length === 0 && (
          <p className="text-sm text-ink-secondary">Nenhum convite pendente.</p>
        )}
        <ul className="divide-y divide-surface-border-subtle">
          {pending.data?.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="break-all text-sm">{item.email}</p>
                <p className="text-xs text-ink-secondary">
                  {ROLE_LABELS[item.role]} · até{' '}
                  {new Date(item.expiresAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={invite.isPending || (state?.role !== 'owner' && item.role === 'owner')}
                onClick={() => {
                  setSuccess(null);
                  invite.mutate({ email: item.email, role: item.role });
                }}
              >
                Reenviar
              </Button>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
