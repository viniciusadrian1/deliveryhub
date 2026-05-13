'use client';

import { useQuery } from '@tanstack/react-query';
import { Plug } from 'lucide-react';
import { useState } from 'react';

import { ConnectDialog } from '../../../components/integrations/connect-dialog';
import { PlatformCard } from '../../../components/integrations/platform-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { PlatformConnection } from '../../../lib/integrations-types';
import { PLATFORM_META } from '../../../lib/integrations-types';

export default function IntegrationsPage() {
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [connectingCode, setConnectingCode] = useState<string | null>(null);

  const { data: connections = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<PlatformConnection[]>('/integrations/connections'),
    enabled: !!storeId,
  });

  if (!storeId) {
    return (
      <EmptyState
        icon={Plug}
        title="Nenhuma loja configurada"
        description="Crie uma loja antes de conectar plataformas de delivery."
      />
    );
  }

  const connectionByCode = new Map(connections.map((c) => [c.platformCode, c]));
  const allCodes = Object.keys(PLATFORM_META);
  const activeCount = connections.filter((c) => c.status === 'active').length;

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <h1>Integrações</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Conecte suas plataformas de delivery. Pedidos, cardápio e preços ficam
          sincronizados a partir do Hub.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="rounded-md bg-success-soft px-2 py-1 font-semibold text-success-bright">
            {activeCount} conectada{activeCount === 1 ? '' : 's'}
          </span>
          <span className="text-ink-tertiary">
            de {allCodes.length} plataformas suportadas
          </span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {allCodes.map((code) => (
          <PlatformCard
            key={code}
            code={code}
            connection={connectionByCode.get(code)}
            onConnect={() => setConnectingCode(code)}
          />
        ))}
      </div>

      {connectingCode && (
        <ConnectDialog
          open
          onClose={() => setConnectingCode(null)}
          storeId={storeId}
          platformCode={connectingCode}
          platformName={PLATFORM_META[connectingCode]?.name ?? connectingCode}
        />
      )}
    </div>
  );
}
