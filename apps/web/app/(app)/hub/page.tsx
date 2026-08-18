'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Radio, Volume2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { OrderCard } from '../../../components/hub/order-card';
import { OrderDrawer } from '../../../components/hub/order-drawer';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { OrderEventPayload, OrderListItem, OrderStatus } from '../../../lib/hub-types';
import { getSocket } from '../../../lib/socket';

const COLUMNS: { status: OrderStatus | OrderStatus[]; title: string; accent?: boolean }[] = [
  { status: 'placed', title: 'Novos', accent: true },
  { status: ['accepted', 'preparing'], title: 'Em preparo' },
  { status: 'ready', title: 'Prontos' },
  { status: 'dispatched', title: 'Despachados' },
  // ponytail: entregue + cancelado = "concluído" no sentido do iFood (pedido finalizado).
  // limit=100 na query já corta o histórico; se crescer, filtrar por data aqui.
  { status: ['delivered', 'cancelled'], title: 'Concluídos' },
];

function HubBoard() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useAuth();
  const orderParam = searchParams.get('order');
  const [selectedId, setSelectedId] = useState<string | null>(orderParam);
  const [soundOn, setSoundOn] = useState(true);
  const storeId = state?.storeId ?? null;

  // Deep-link: notificações de cancelamento/reembolso abrem o pedido direto.
  useEffect(() => {
    if (orderParam) setSelectedId(orderParam);
  }, [orderParam]);

  const closeDrawer = () => {
    setSelectedId(null);
    if (orderParam) router.replace('/hub');
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', storeId],
    queryFn: () =>
      api<OrderListItem[]>(
        `/orders?storeId=${encodeURIComponent(storeId ?? '')}&limit=100`,
      ),
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!storeId) return;
    const socket = getSocket();
    if (!socket) return;

    const onCreated = (_payload: OrderEventPayload) => {
      void qc.invalidateQueries({ queryKey: ['orders', storeId] });
      if (soundOn) {
        try {
          const audio = new Audio(
            'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
          );
          audio.play().catch(() => undefined);
        } catch {
          /* autoplay bloqueado */
        }
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
  }, [storeId, qc, soundOn]);

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
      <div className="surface-card flex h-full flex-col items-center justify-center p-10 text-center">
        <Inbox className="mb-4 h-10 w-10 text-ink-tertiary" />
        <h1 className="text-xl font-bold">Nenhuma loja configurada</h1>
        <p className="mt-2 max-w-md text-sm text-ink-secondary">
          Para receber pedidos, conecte sua primeira plataforma de delivery.
          A conexão é feita na tela de Integrações.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Hub de Pedidos</h1>
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-ink-secondary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success-bright" />
            </span>
            <Radio className="h-3.5 w-3.5" />
            atualizando em tempo real · {data?.length ?? 0} pedido{data?.length === 1 ? '' : 's'} no total
          </p>
        </div>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            soundOn
              ? 'border-surface-border-strong bg-surface-raised text-ink-primary'
              : 'border-surface-border-subtle bg-surface-raised/50 text-ink-tertiary'
          }`}
        >
          <Volume2 className="h-3.5 w-3.5" />
          Som {soundOn ? 'ligado' : 'desligado'}
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
          Não foi possível carregar os pedidos.
        </p>
      )}

      <div className="grid flex-1 min-h-0 gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const orders = grouped[col.title] ?? [];
          return (
            <section
              key={col.title}
              className="flex min-w-[280px] flex-col rounded-xl border border-surface-border-subtle bg-surface-base/40"
            >
              <header className="flex items-center justify-between border-b border-surface-border-subtle px-3 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                  {col.title}
                </h2>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    col.accent && orders.length > 0
                      ? 'bg-brand-500/15 text-brand-300'
                      : 'bg-surface-overlay text-ink-secondary'
                  }`}
                >
                  {orders.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {isLoading && orders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-surface-border-subtle p-4 text-center text-xs text-ink-tertiary">
                    Carregando…
                  </div>
                )}
                {!isLoading && orders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-surface-border-subtle p-4 text-center text-xs text-ink-tertiary">
                    {col.accent ? 'Aguardando novos pedidos' : 'Vazio'}
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

      {selectedId && <OrderDrawer orderId={selectedId} onClose={closeDrawer} />}
    </div>
  );
}

export default function HubPage() {
  return (
    <Suspense fallback={null}>
      <HubBoard />
    </Suspense>
  );
}
