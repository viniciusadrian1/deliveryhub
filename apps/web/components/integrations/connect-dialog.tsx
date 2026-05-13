'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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

  const start = useMutation({
    mutationFn: async () => {
      return api<StartConnectionResponse>('/integrations/connect', {
        method: 'POST',
        body: { storeId, platformCode },
      });
    },
    onSuccess: (data) => {
      setStarted(data);
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!started) throw new Error('not_started');
      return api(`/integrations/connections/${started.connectionId}/finalize`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
      setStarted(null);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setStarted(null);
      }}
      title={`Conectar ${platformName}`}
      description="Autorize o DeliveryHub a acessar sua loja na plataforma."
      footer={
        started ? (
          <>
            <Button variant="ghost" onClick={() => { onClose(); setStarted(null); }}>
              Cancelar
            </Button>
            <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              {finalize.isPending ? 'Verificando…' : 'Já autorizei →'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? 'Iniciando…' : 'Iniciar conexão →'}
            </Button>
          </>
        )
      }
    >
      {!started ? (
        <div className="space-y-3 text-sm">
          <p>Ao iniciar a conexão, o DeliveryHub vai:</p>
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>✓ Receber seus pedidos em tempo real</li>
            <li>✓ Sincronizar cardápio e preços</li>
            <li>✓ Pausar/reabrir sua loja a seu pedido</li>
          </ul>
          <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
            ⓘ Nunca acessamos dados de outras lojas nem alteramos nada sem sua confirmação.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {started.isMock && (
            <div className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
              <Badge>MOCK</Badge> Sem credenciais reais do iFood — usando adapter simulado.
            </div>
          )}
          <ol className="space-y-3 text-sm">
            <li>
              <span className="font-semibold">1.</span> Abra esta URL em outra aba:
              <br />
              <a
                href={started.verificationUrlComplete}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block break-all rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs underline dark:bg-zinc-800"
              >
                {started.verificationUrl}
              </a>
            </li>
            <li>
              <span className="font-semibold">2.</span> Digite este código:
              <div className="mt-2 select-all rounded-lg bg-zinc-100 px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest dark:bg-zinc-800">
                {started.userCode}
              </div>
            </li>
            <li>
              <span className="font-semibold">3.</span> Volte aqui e clique em{' '}
              <b>"Já autorizei →"</b>.
            </li>
          </ol>
          <p className="text-xs text-zinc-500">
            O código expira em{' '}
            {Math.round((new Date(started.expiresAt).getTime() - Date.now()) / 60000)} min.
          </p>
        </div>
      )}
    </Dialog>
  );
}
