'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Download, Lock, X } from 'lucide-react';
import { useState } from 'react';

import { api, API_BASE_URL } from '../../../lib/api';
import { type ConsentLogEntry } from '../../../lib/settings-types';
import { readTokens } from '../../../lib/tokens';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { SettingsSection } from '../section';

export function PrivacySection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ['my-consents'],
    queryFn: () => api<ConsentLogEntry[]>('/me/consents'),
  });

  const anonymize = useMutation({
    mutationFn: () => api('/me/anonymize', { method: 'POST' }),
    onSuccess: () => {
      // After anonymization the session is invalid; force the user out.
      window.location.href = '/login';
    },
  });

  async function downloadExport() {
    setDownloading(true);
    try {
      const tokens = readTokens();
      const res = await fetch(`${API_BASE_URL}/api/me/data-export`, {
        headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao gerar exportação.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deliveryhub-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Exportar meus dados"
        description="Receba uma cópia completa dos dados associados à sua conta (LGPD)."
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            Inclui seu perfil, organizações, lojas, integrações, configurações e
            histórico de pedidos.
          </p>
          <Button
            variant="secondary"
            onClick={() => void downloadExport()}
            loading={downloading}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Baixar JSON
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Histórico de consentimentos"
        description="Registro auditável de cada termo que você aceitou ou recusou."
      >
        {isLoading ? (
          <p className="text-sm text-ink-tertiary">Carregando…</p>
        ) : consents.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            Nenhum consentimento registrado ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consents.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-surface-border-subtle px-3 py-2.5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    c.accepted ? 'bg-success-soft text-success-bright' : 'bg-danger-soft text-danger-bright'
                  }`}
                >
                  {c.accepted ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-primary">{c.kind}</p>
                  <p className="truncate text-[11px] text-ink-tertiary">
                    versão {c.version} · {new Date(c.at).toLocaleString('pt-BR')}
                    {c.ip ? ` · IP ${c.ip}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Anonimizar minha conta"
        description="Operação irreversível garantida pela LGPD."
        action={<Lock className="h-4 w-4 text-danger-bright" />}
      >
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-bright" />
          <div className="flex-1 text-sm text-ink-primary">
            <p className="font-medium">Esta ação é permanente.</p>
            <p className="mt-1 text-ink-secondary">
              Seus dados pessoais serão substituídos por valores anônimos. Pedidos
              e movimentações financeiras serão preservados (apenas
              desidentificados) para integridade fiscal e contábil.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Quero anonimizar minha conta
          </Button>
        </div>
      </SettingsSection>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar anonimização"
        description="Esta ação não pode ser desfeita."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={anonymize.isPending}
              onClick={() => anonymize.mutate()}
            >
              Confirmar e anonimizar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-secondary">
          Ao confirmar, você será desconectado imediatamente e seus dados pessoais
          (nome, e-mail) serão substituídos por identificadores anônimos. Esta
          ação é registrada no log de consentimentos.
        </p>
      </Dialog>
    </div>
  );
}
