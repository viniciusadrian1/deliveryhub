'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Inbox, Radio, Volume2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { OrderCard } from '../../../components/hub/order-card';
import { OrderDrawer } from '../../../components/hub/order-drawer';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { OrderEventPayload, OrderListItem, OrderStatus } from '../../../lib/hub-types';
import { getSocket } from '../../../lib/socket';
import { playOrderAlert } from '../../../lib/sound';

const COLUMNS: {
  status: OrderStatus | OrderStatus[];
  title: string;
  accent?: boolean;
  variant?: 'danger';
}[] = [
  { status: 'placed', title: 'Novos', accent: true },
  { status: ['accepted', 'preparing'], title: 'Em preparo' },
  { status: 'ready', title: 'Prontos' },
  { status: 'dispatched', title: 'Despachados' },
  { status: 'delivered', title: 'Concluídos' },
  { status: 'cancelled', title: 'Cancelados', variant: 'danger' },
];

function HubBoard() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useAuth();
  const orderParam = searchParams.get('order');
  const [selectedId, setSelectedId] = useState<string | null>(orderParam);
  const [soundOn, setSoundOn] = useState(true);
  const [, setClock] = useState(() => Date.now());
  const storeId = state?.storeId ?? null;

  // Mantém o texto "há X minutos" atualizado sem recarregar a página.
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
        `/orders?storeId=${encodeURIComponent(storeId ?? '')}&since=${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}&limit=100&withItems=true`,
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
      void qc.invalidateQueries({ queryKey: ['fin'] });
      if (soundOn) {
        playOrderAlert();
      }
    };
    const onUpdated = (payload: OrderEventPayload) => {
      void qc.invalidateQueries({ queryKey: ['orders', storeId] });
      void qc.invalidateQueries({ queryKey: ['order', payload.orderId] });
      void qc.invalidateQueries({ queryKey: ['fin'] });
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
      map[col.title] = (data ?? [])
        .filter((o) => statuses.includes(o.status))
        .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next) playOrderAlert();
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              soundOn
                ? 'border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-surface-border-subtle bg-surface-raised/50 text-ink-tertiary'
            }`}
            title={soundOn ? 'Som ativo (clique para silenciar)' : 'Som desligado (clique para ativar e testar)'}
          >
            <Volume2 className="h-3.5 w-3.5" />
            Som {soundOn ? 'ligado' : 'desligado'}
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
          Não foi possível carregar os pedidos.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 xl:gap-2.5 flex-1 min-h-0 w-full items-start">
        {COLUMNS.map((col) => {
          const orders = grouped[col.title] ?? [];
          return (
            <section
              key={col.title}
              className="flex min-w-0 flex-col rounded-xl border border-surface-border-subtle bg-surface-base/40 overflow-hidden shadow-xs"
            >
              <header className="flex items-center justify-between border-b border-surface-border-subtle px-2.5 py-2 bg-surface-base/60 shrink-0">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary truncate">
                  {col.title}
                </h2>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-bold tabular shrink-0',
                    col.accent && orders.length > 0
                      ? 'bg-brand-500/15 text-brand-400 font-extrabold'
                      : col.variant === 'danger' && orders.length > 0
                        ? 'bg-danger-soft text-danger-bright'
                        : 'bg-surface-overlay text-ink-tertiary',
                  )}
                >
                  {orders.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-2 min-h-[380px]">
                {isLoading && orders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-surface-border-subtle/70 p-4 text-center text-xs text-ink-tertiary">
                    Carregando…
                  </div>
                )}
                {!isLoading && orders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-surface-border-subtle/70 p-3.5 text-center text-xs text-ink-tertiary">
                    {col.accent ? 'Aguardando pedidos' : 'Vazio'}
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
