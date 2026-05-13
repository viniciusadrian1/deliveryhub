'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api';
import type { PlatformConnection } from '../../lib/integrations-types';
import { PLATFORM_META } from '../../lib/integrations-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface PlatformCardProps {
  code: string;
  connection?: PlatformConnection;
  onConnect: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  revoked: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente — finalize a conexão',
  active: 'Ativo',
  error: 'Erro na integração',
  revoked: 'Desconectado',
};

export function PlatformCard({ code, connection, onConnect }: PlatformCardProps) {
  const qc = useQueryClient();
  const meta = PLATFORM_META[code] ?? { name: code, colorHex: '#888', enabled: false };

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      await api(`/integrations/connections/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const finalize = useMutation({
    mutationFn: async (id: string) => {
      return api(`/integrations/connections/${id}/finalize`, { method: 'POST' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge color={meta.colorHex}>{meta.name}</Badge>
            {!meta.enabled && <Badge>Em breve</Badge>}
          </div>
          {connection ? (
            <p className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[connection.status]}`}>
              {STATUS_LABELS[connection.status] ?? connection.status}
            </p>
          ) : meta.enabled ? (
            <p className="mt-3 text-sm text-zinc-500">Não conectado</p>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Em breve no DeliveryHub</p>
          )}
        </div>
      </div>

      {connection?.externalMerchantId && (
        <p className="mt-2 font-mono text-xs text-zinc-500">
          merchant: {connection.externalMerchantId}
        </p>
      )}
      {connection?.lastSyncAt && (
        <p className="mt-1 text-xs text-zinc-500">
          última sincronização: {new Date(connection.lastSyncAt).toLocaleString('pt-BR')}
        </p>
      )}
      {connection?.lastErrorMessage && (
        <p className="mt-1 text-xs text-status-error">{connection.lastErrorMessage}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!connection && meta.enabled && (
          <Button size="sm" onClick={onConnect}>
            Conectar {meta.name}
          </Button>
        )}
        {connection?.status === 'pending' && (
          <Button
            size="sm"
            onClick={() => finalize.mutate(connection.id)}
            disabled={finalize.isPending}
          >
            {finalize.isPending ? 'Verificando…' : 'Já autorizei →'}
          </Button>
        )}
        {connection?.status === 'active' && (
          <>
            <Button size="sm" variant="secondary" onClick={onConnect}>
              Reconectar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirm(`Desconectar ${meta.name}? Você não receberá mais pedidos por aqui.`)) {
                  disconnect.mutate(connection.id);
                }
              }}
              disabled={disconnect.isPending}
            >
              Desconectar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
