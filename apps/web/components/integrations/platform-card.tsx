'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Power,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { api } from '../../lib/api';
import type { PlatformConnection, PlatformMeta } from '../../lib/integrations-types';
import { PLATFORM_META } from '../../lib/integrations-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DeliveryAreasDialog } from './delivery-areas-dialog';

interface PlatformCardProps {
  code: string;
  connection?: PlatformConnection;
  onConnect: () => void;
}

const FALLBACK_META: PlatformMeta = {
  name: '',
  colorHex: '#888',
  enabled: false,
  availability: 'unavailable',
  logo: '',
};

export function PlatformCard({ code, connection, onConnect }: PlatformCardProps) {
  const qc = useQueryClient();
  const meta = PLATFORM_META[code] ?? { ...FALLBACK_META, name: code };
  const [showAreas, setShowAreas] = useState(false);

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      await api(`/integrations/connections/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const finalize = useMutation({
    mutationFn: async (id: string) =>
      api(`/integrations/connections/${id}/finalize`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const renderStatus = () => {
    if (!connection) {
      switch (meta.availability) {
        case 'available':
          return (
            <Badge variant="neutral" dot>
              Não conectado
            </Badge>
          );
        case 'roadmap':
          return <Badge variant="neutral">Em breve</Badge>;
        case 'unavailable':
          return <Badge variant="danger">Indisponível</Badge>;
      }
    }
    switch (connection.status) {
      case 'active':
        return (
          <Badge variant="success" dot>
            Conectado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="warning" dot>
            Aguardando autorização
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" dot>
            Erro
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="neutral" dot>
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <div className="surface-card relative flex flex-col overflow-hidden p-5">
      {/* faixa colorida da plataforma no topo */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: meta.colorHex }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="relative flex h-12 w-20 items-center justify-center overflow-hidden rounded-lg border border-surface-border-subtle bg-white p-2">
          {meta.logo ? (
            <Image
              src={meta.logo}
              alt={`${meta.name} logo`}
              width={64}
              height={32}
              className="h-full w-full object-contain"
              style={meta.logoScale ? { transform: `scale(${meta.logoScale})` } : undefined}
              unoptimized
            />
          ) : (
            <span
              className="text-sm font-bold uppercase"
              style={{ color: meta.colorHex }}
            >
              {meta.name.slice(0, 2)}
            </span>
          )}
        </div>
        {renderStatus()}
      </div>

      <h3 className="mt-3 text-base font-semibold text-ink-primary">{meta.name}</h3>

      <div className="mt-3 flex-1 space-y-1 text-xs text-ink-tertiary">
        {connection?.externalMerchantId && (
          <p className="flex items-center gap-1.5 font-mono">
            <span className="text-ink-secondary">merchant:</span>
            <span className="truncate">{connection.externalMerchantId}</span>
          </p>
        )}
        {connection?.lastSyncAt && (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {new Date(connection.lastSyncAt).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        )}
        {connection?.lastErrorMessage && (
          <p className="flex items-start gap-1.5 text-danger-bright">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{connection.lastErrorMessage}</span>
          </p>
        )}
        {!connection && meta.availability === 'available' && (
          <p>Conecte para começar a receber pedidos e sincronizar cardápio.</p>
        )}
        {!connection && meta.availability === 'roadmap' && (
          <p>{meta.reason ?? 'Integração no roadmap — credenciais pendentes.'}</p>
        )}
        {!connection && meta.availability === 'unavailable' && (
          <p>{meta.reason ?? 'Plataforma sem API disponível para integração.'}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!connection && meta.availability === 'available' && (
          <Button size="sm" onClick={onConnect} leftIcon={<Power className="h-3.5 w-3.5" />}>
            Conectar
          </Button>
        )}
        {connection?.status === 'pending' && (
          <>
            <Button
              size="sm"
              onClick={() => finalize.mutate(connection.id)}
              loading={finalize.isPending}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Já autorizei
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onConnect}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Gerar novo link
            </Button>
            {finalize.isError && (
              <p className="w-full text-xs text-warning-bright">
                Ainda não autorizado. Conclua no portal da plataforma ou gere um
                novo link.
              </p>
            )}
          </>
        )}
        {connection?.status === 'active' && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={onConnect}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Reconectar
            </Button>
            {code === '99food' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAreas(true)}
                leftIcon={<MapPin className="h-3.5 w-3.5" />}
              >
                Áreas de entrega
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Desconectar ${meta.name}?`)) disconnect.mutate(connection.id);
              }}
              loading={disconnect.isPending}
              leftIcon={<XCircle className="h-3.5 w-3.5" />}
            >
              Desconectar
            </Button>
          </>
        )}
        {connection?.status === 'error' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onConnect}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Tentar de novo
          </Button>
        )}
      </div>

      {showAreas && connection && (
        <DeliveryAreasDialog
          storeId={connection.storeId}
          onClose={() => setShowAreas(false)}
        />
      )}
    </div>
  );
}
