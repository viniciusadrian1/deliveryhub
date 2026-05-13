'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { OrderCard } from '../../../components/hub/order-card';
import { OrderDrawer } from '../../../components/hub/order-drawer';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { OrderEventPayload, OrderListItem, OrderStatus } from '../../../lib/hub-types';
import { getSocket } from '../../../lib/socket';

const COLUMNS: { status: OrderStatus | OrderStatus[]; title: string }[] = [
  { status: 'placed', title: 'Novos' },
  { status: ['accepted', 'preparing'], title: 'Em preparo' },
  { status: 'ready', title: 'Prontos' },
  { status: 'dispatched', title: 'Despachados' },
];

export default function HubPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const storeId = state?.storeId ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', storeId],
    queryFn: () =>
      api<OrderListItem[]>(
        `/orders?storeId=${encodeURIComponent(storeId ?? '')}&limit=100`,
      ),
    enabled: !!storeId,
    refetchInterval: 30_000, // fallback caso o WS caia
  });

  // Conexão Socket.IO + invalida cache em eventos.
  useEffect(() => {
    if (!storeId) return;
    const socket = getSocket();
    if (!socket) return;

    const onCreated = (_payload: OrderEventPayload) => {
      void qc.invalidateQueries({ queryKey: ['orders', storeId] });
      try {
        // bip curto base64 — fallback silencioso se navegador bloquear autoplay
        const audio = new Audio(
          'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        );
        audio.play().catch(() => undefined);
      } catch {
        // autoplay bloqueado pelo navegador — esperado em algumas situações
      }
    };
    const onUpdated = (payload: OrderEventPayload) => {
      void qc.invalidateQueries({ queryKey: ['orders', storeId] });
      void qc.invalidateQueries({ queryKey: ['order', payload.orderId] });
    };

    socket.on('order.created', onCreated);
    socket.on('order.updated', onUpdated);
    return () => {
      socket.off('order.created', onCreated);
      socket.off('order.updated', onUpdated);
    };
  }, [storeId, qc]);

  const grouped = useMemo(() => {
    const map: Record<string, OrderListItem[]> = {};
    for (const col of COLUMNS) {
      const statuses = Array.isArray(col.status) ? col.status : [col.status];
      map[col.title] = (data ?? []).filter((o) => statuses.includes(o.status));
    }
    return map;
  }, [data]);

  if (!storeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold">Nenhuma loja configurada</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Antes de receber pedidos, conecte sua primeira plataforma de delivery.
          (Onboarding completo virá na próxima sprint de UI.)
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hub de Pedidos</h1>
        <div className="text-sm text-zinc-500">
          {data?.length ?? 0} pedidos · atualiza em tempo real
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-error dark:bg-red-950/40">
          Não foi possível carregar os pedidos.
        </p>
      )}

      <div className="grid flex-1 min-h-0 gap-3 overflow-x-auto md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const orders = grouped[col.title] ?? [];
          return (
            <section
              key={col.title}
              className="flex min-w-[250px] flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  {col.title}
                </h2>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">
                  {orders.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {isLoading && orders.length === 0 && (
                  <div className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
                    Carregando…
                  </div>
                )}
                {!isLoading && orders.length === 0 && (
                  <div className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
                    Nenhum pedido nesta coluna
                  </div>
                )}
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onClick={() => setSelectedId(order.id)}
                    highlight={col.status === 'placed'}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selectedId && (
        <OrderDrawer orderId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
