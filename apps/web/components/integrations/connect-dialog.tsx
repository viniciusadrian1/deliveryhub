'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ExternalLink, Info, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../lib/api';
import type { StartConnectionResponse } from '../../lib/integrations-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

interface ConnectDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  platformCode: string;
  platformName: string;
}

export function ConnectDialog({
  open,
  onClose,
  storeId,
  platformCode,
  platformName,
}: ConnectDialogProps) {
  const qc = useQueryClient();
  const [started, setStarted] = useState<StartConnectionResponse | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // iFood usa OAuth Device (mostra um código). 99Food não tem código — só
  // uma URL de autorização. Sem userCode, exibimos o fluxo simplificado.
  const hasCode = Boolean(started?.userCode);
  // Keeta: a loja autoriza no portal deles e a conexão ativa via webhook 1301 —
  // não há "finalize" por polling. O dialog só mostra a URL e orienta a aguardar.
  const webhookDriven = platformCode === 'keeta';
  const expiryMs = started ? new Date(started.expiresAt).getTime() - Date.now() : 0;
  const expiryLabel = hasCode
    ? `Código expira em ${Math.max(0, Math.round(expiryMs / 60_000))} min`
    : `Link expira em ${Math.max(0, Math.round(expiryMs / 86_400_000))} dias`;

  const start = useMutation({
    mutationFn: async () =>
      api<StartConnectionResponse>('/integrations/connect', {
        method: 'POST',
        body: { storeId, platformCode },
      }),
    onMutate: () => setStartError(null),
    onSuccess: (data) => {
      setStarted(data);
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (err) => {
      const raw =
        (err as { body?: { message?: string } })?.body?.message ??
        (err instanceof Error ? err.message : 'erro_desconhecido');
      const msgs: Record<string, string> = {
        adapter_not_registered:
          'Plataforma sem credenciais no servidor — o adapter não foi registrado. Configure as chaves (CLIENT_ID/SECRET) na Render e aguarde o redeploy.',
        no_active_connections: 'Nenhuma conexão ativa encontrada.',
      };
      setStartError(msgs[raw] ?? `Não foi possível iniciar a conexão: ${raw}`);
    },
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!started) throw new Error('not_started');
      return api(`/integrations/connections/${started.connectionId}/finalize`, {
        method: 'POST',
        // iFood: manda o código que a plataforma devolveu ao autorizar.
        body: hasCode ? { authorizationCode: authCode.trim() } : {},
      });
    },
    onMutate: () => setFinalizeError(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      close();
    },
    onError: (err) => {
      const raw =
        (err as { body?: { message?: string } })?.body?.message ??
        (err instanceof Error ? err.message : 'erro');
      const msgs: Record<string, string> = {
        connection_still_pending:
          'Ainda não recebemos a autorização. Confira se você concluiu no portal da plataforma.',
        authorization_code_required:
          'Cole o código que a plataforma mostrou depois que você autorizou.',
        authorization_invalid_or_expired:
          'Código inválido ou expirado. Reinicie a conexão, autorize de novo e cole o código novo.',
      };
      setFinalizeError(msgs[raw] ?? raw);
    },
  });

  const close = () => {
    onClose();
    setStarted(null);
    setAuthCode('');
    setFinalizeError(null);
    setStartError(null);
  };

  // Pra iFood, só habilita "Já autorizei" quando o código foi colado.
  const canFinalize = !hasCode || authCode.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Conectar ${platformName}`}
      description={
        started
          ? 'Conclua a autorização no portal da plataforma.'
          : 'Autorize o DeliveryHub a acessar sua loja na plataforma.'
      }
      footer={
        started ? (
          webhookDriven ? (
            <Button onClick={close} rightIcon={<CheckCircle2 className="h-4 w-4" />}>
              Entendi, fechar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button
                onClick={() => finalize.mutate()}
                loading={finalize.isPending}
                disabled={!canFinalize}
                rightIcon={!finalize.isPending && <ArrowRight className="h-4 w-4" />}
              >
                {finalize.isPending ? 'Verificando…' : 'Já autorizei'}
              </Button>
            </>
          )
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              onClick={() => start.mutate()}
              loading={start.isPending}
              rightIcon={!start.isPending && <ArrowRight className="h-4 w-4" />}
            >
              {start.isPending ? 'Iniciando…' : 'Iniciar conexão'}
            </Button>
          </>
        )
      }
    >
      {!started ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">Ao iniciar, o DeliveryHub passa a:</p>
          <ul className="space-y-3">
            {[
              'Receber seus pedidos em tempo real',
              'Sincronizar cardápio e preços',
              'Pausar e reabrir sua loja a seu pedido',
            ].map((s) => (
              <li key={s} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-bright" />
                <span className="text-ink-primary">{s}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-ink-secondary">
              Suas credenciais ficam <b className="text-ink-primary">cifradas em vault</b>{' '}
              (AES-256-GCM). Nunca acessamos outras lojas e nada é alterado sem sua
              confirmação.
            </p>
          </div>
          {startError && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-bright">
              {startError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {started.isMock && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-bright" />
              <div>
                <Badge variant="warning">Sandbox mock</Badge>
                <p className="mt-1 text-ink-secondary">
                  Sem credenciais reais da plataforma — usando o adapter
                  simulado pra validar o fluxo.
                </p>
              </div>
            </div>
          )}

          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                1
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-primary">
                  Abra o portal {platformName}
                </p>
                <a
                  href={started.verificationUrlComplete}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 break-all rounded-lg border border-surface-border bg-surface-base px-3 py-2 font-mono text-xs text-brand-300 hover:border-surface-border-strong"
                >
                  <ExternalLink className="h-3 w-3" />
                  {started.verificationUrl}
                </a>
              </div>
            </li>
            {hasCode && (
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-primary">
                    Digite este código
                  </p>
                  <div className="mt-2 select-all rounded-xl border border-surface-border bg-surface-base px-5 py-4 text-center font-mono text-2xl font-bold tracking-[0.4em] text-ink-primary">
                    {started.userCode}
                  </div>
                </div>
              </li>
            )}
            {hasCode && (
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-primary">
                    Cole aqui o código que o {platformName} devolveu
                  </p>
                  <p className="mt-0.5 text-xs text-ink-tertiary">
                    Após autorizar a loja, o {platformName} mostra um código de
                    confirmação — cole ele abaixo.
                  </p>
                  <input
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Código de confirmação"
                    className="mt-2 w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 font-mono text-sm text-ink-primary outline-none focus:border-brand-500"
                    autoComplete="off"
                  />
                </div>
              </li>
            )}
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {hasCode ? 4 : 2}
              </span>
              <div className="flex-1">
                {webhookDriven ? (
                  <>
                    <p className="text-sm font-medium text-ink-primary">
                      A loja autoriza no portal da Keeta
                    </p>
                    <p className="mt-1 text-xs text-ink-tertiary">
                      Assim que a loja confirmar a autorização, a conexão ativa aqui
                      <b className="text-ink-secondary"> automaticamente</b> (via webhook,
                      pode levar alguns segundos). Pode fechar esta janela.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink-primary">
                      {hasCode ? 'Clique em' : 'Autorize a loja e clique'} em{' '}
                      <b className="text-brand-300">"Já autorizei"</b>
                    </p>
                    {!hasCode && (
                      <p className="mt-1 text-xs text-ink-tertiary">
                        O DeliveryHub detecta a loja vinculada automaticamente.
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          </ol>

          {finalizeError && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-bright">
              {finalizeError}
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            <Loader2 className="h-3 w-3 animate-pulse" />
            {expiryLabel}
          </p>
        </div>
      )}
    </Dialog>
  );
}
