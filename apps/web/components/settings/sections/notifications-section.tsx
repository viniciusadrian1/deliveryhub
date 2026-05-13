'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Mail } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../../lib/api';
import {
  NOTIFICATION_KIND_META,
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationPreference,
} from '../../../lib/settings-types';
import { Button } from '../../ui/button';
import { SettingsSection } from '../section';

type PrefState = Record<NotificationKind, { inApp: boolean; email: boolean }>;

/** Defaults match server (in-app on, email off) so the UI never flickers. */
function buildDefaults(prefs: NotificationPreference[]): PrefState {
  const byKind = new Map(prefs.map((p) => [p.kind, p]));
  return NOTIFICATION_KINDS.reduce((acc, kind) => {
    const existing = byKind.get(kind);
    acc[kind] = {
      inApp: existing?.channelInApp ?? true,
      email: existing?.channelEmail ?? false,
    };
    return acc;
  }, {} as PrefState);
}

export function NotificationsSection() {
  const qc = useQueryClient();

  const { data: prefs = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api<NotificationPreference[]>('/notifications/preferences'),
  });

  const initial = useMemo(() => buildDefaults(prefs), [prefs]);
  const [draft, setDraft] = useState<PrefState>(initial);

  // Keep local draft in sync if server data loads after mount.
  useEffect(() => setDraft(initial), [initial]);

  const dirty = useMemo(() => {
    return NOTIFICATION_KINDS.some(
      (k) => draft[k].inApp !== initial[k].inApp || draft[k].email !== initial[k].email,
    );
  }, [draft, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const preferences = NOTIFICATION_KINDS.filter(
        (k) => draft[k].inApp !== initial[k].inApp || draft[k].email !== initial[k].email,
      ).map((k) => ({
        kind: k,
        channelInApp: draft[k].inApp,
        channelEmail: draft[k].email,
      }));
      if (!preferences.length) return;
      await api('/notifications/preferences', {
        method: 'PUT',
        body: { preferences },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const operational = NOTIFICATION_KINDS.filter(
    (k) => NOTIFICATION_KIND_META[k].group === 'operacional',
  );
  const account = NOTIFICATION_KINDS.filter(
    (k) => NOTIFICATION_KIND_META[k].group === 'conta',
  );

  return (
    <SettingsSection
      title="Notificações"
      description="Escolha por onde receber cada tipo de alerta."
      action={
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          loading={save.isPending}
          leftIcon={<Check className="h-3.5 w-3.5" />}
        >
          Salvar
        </Button>
      }
      padded={false}
    >
      {isLoading ? (
        <div className="px-6 py-8 text-center text-sm text-ink-tertiary">
          Carregando preferências…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_80px_80px] items-center gap-4 border-b border-surface-border-subtle bg-surface-base/40 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
            <span>Tipo de aviso</span>
            <span className="flex items-center justify-center gap-1">
              <Bell className="h-3 w-3" /> Hub
            </span>
            <span className="flex items-center justify-center gap-1">
              <Mail className="h-3 w-3" /> E-mail
            </span>
          </div>

          <PrefGroup
            label="Operacional"
            kinds={operational}
            draft={draft}
            onToggle={(kind, channel) =>
              setDraft((d) => ({
                ...d,
                [kind]: { ...d[kind], [channel]: !d[kind][channel] },
              }))
            }
          />
          <PrefGroup
            label="Conta & Sistema"
            kinds={account}
            draft={draft}
            onToggle={(kind, channel) =>
              setDraft((d) => ({
                ...d,
                [kind]: { ...d[kind], [channel]: !d[kind][channel] },
              }))
            }
          />
        </>
      )}
    </SettingsSection>
  );
}

interface PrefGroupProps {
  label: string;
  kinds: NotificationKind[];
  draft: PrefState;
  onToggle: (kind: NotificationKind, channel: 'inApp' | 'email') => void;
}

function PrefGroup({ label, kinds, draft, onToggle }: PrefGroupProps) {
  return (
    <div>
      <p className="border-b border-surface-border-subtle bg-surface-base/20 px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
        {label}
      </p>
      <ul className="divide-y divide-surface-border-subtle">
        {kinds.map((kind) => {
          const meta = NOTIFICATION_KIND_META[kind];
          return (
            <li
              key={kind}
              className="grid grid-cols-[1fr_80px_80px] items-center gap-4 px-6 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink-primary">{meta.label}</p>
                <p className="mt-0.5 text-xs text-ink-secondary">{meta.description}</p>
              </div>
              <Toggle
                checked={draft[kind].inApp}
                onChange={() => onToggle(kind, 'inApp')}
                ariaLabel={`Hub: ${meta.label}`}
              />
              <Toggle
                checked={draft[kind].email}
                onChange={() => onToggle(kind, 'email')}
                ariaLabel={`E-mail: ${meta.label}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}

function Toggle({ checked, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`mx-auto flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
        checked ? 'bg-brand-500' : 'bg-surface-border'
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
