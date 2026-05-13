'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ConnectDialog } from '../../../components/integrations/connect-dialog';
import { PlatformCard } from '../../../components/integrations/platform-card';
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
      <p className="text-sm text-zinc-500">
        Crie/selecione uma loja primeiro para conectar plataformas.
      </p>
    );
  }

  const connectionByCode = new Map(connections.map((c) => [c.platformCode, c]));
  const allCodes = Object.keys(PLATFORM_META);

  return (
    <div className="flex flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Conecte suas plataformas de delivery. Pedidos chegarão direto no Hub.
        </p>
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
