'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  ChefHat,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { OrderEventPayload, OrderStatus } from '../../../lib/hub-types';
import { r } from '../../../lib/routes';
import { getSocket } from '../../../lib/socket';

/** Os status que importam pra cozinha: pedido aceito até ficar pronto. */
const KITCHEN_STATUSES: readonly OrderStatus[] = ['accepted', 'preparing', 'ready'];

interface KdsOrderItem {
  id: string;
  nameSnapshot: string;
  qty: number;
  notes: string | null;
  modifiers: Array<{ id: string; nameSnapshot: string; qty: number }>;
}

interface KdsOrder {
  id: string;
  externalId: string;
  status: OrderStatus;
  placedAt: string;
  acceptedAt: string | null;
  notes: string | null;
  platform: { code: string; name: string; colorHex: string };
  customer: { id: string; name: string } | null;
  items: KdsOrderItem[];
}

/**
 * Kitchen Display System — tela dedicada para a cozinha.
 *
 * Filosofia: máximo contraste, fonte grande, mínimo de distrações. Roda
 * num tablet/monitor 24" preso na parede. Não compete com o Hub — o
 * operador do balcão usa o /hub; a cozinha usa /kds.
 *
 * Funcionalidades:
 *  - Mostra apenas pedidos em `accepted`, `preparing` ou `ready`
 *  - Auto-atualiza via Socket.IO (mesma infra do Hub)
 *  - Timer real-time desde quando o pedido foi aceito (cor escala:
 *    < 10 min verde, 10-20 amarelo, 20+ vermelho)
 *  - Som opcional ao chegar pedido novo (toggle no header)
 *  - Botão grande "Iniciar preparo" (accepted → preparing) e "Pronto"
 *    (preparing → ready). Quando ready, fica visível até alguém despachar
 *    do Hub principal.
 *  - Fullscreen toggle pra modo kiosque
 *  - Sem sidebar, sem topbar — layout próprio definido em (kds)/layout.tsx
 */
export default function KdsPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const storeId = state?.storeId ?? null;

  // Tick a cada segundo pra atualizar os timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Detectar mudança de fullscreen externa (ESC pra sair)
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kds-orders', storeId],
    queryFn: () =>
      api<KdsOrder[]>(
        `/orders?storeId=${encodeURIComponent(
          storeId ?? '',
        )}&statusIn=${KITCHEN_STATUSES.join(',')}&withItems=true&limit=100`,
      ),
    enabled: !!storeId,
    refetchInterval: 15_000, // failsafe se socket cair
  });

  // Live updates
  useEffect(() => {
    if (!storeId) return;
    const socket = getSocket();
    if (!socket) return;

    const refetch = () => {
      void qc.invalidateQueries({ queryKey: ['kds-orders', storeId] });
    };
    const onCreated = (_p: OrderEventPayload) => {
      refetch();
      if (soundOn) playBeep();
    };
    const onUpdated = (_p: OrderEventPayload) => refetch();

    socket.on('order.created', onCreated);
    socket.on('order.updated', onUpdated);
    return () => {
      socket.off('order.created', onCreated);
      socket.off('order.updated', onUpdated);
    };
  }, [storeId, qc, soundOn]);

  // Mutations para transições — não bloqueiam UI (otimista invalida)
  const accept = useMutation({
    mutationFn: (id: string) => api(`/orders/${id}/start-preparing`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-orders', storeId] }),
  });
  const markReady = useMutation({
    mutationFn: (id: string) => api(`/orders/${id}/ready`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-orders', storeId] }),
  });

  /** Ordena por mais antigo primeiro (mais urgente na cozinha). */
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      // ready sempre por último; resto por idade
      if (a.status === 'ready' && b.status !== 'ready') return 1;
      if (b.status === 'ready' && a.status !== 'ready') return -1;
      const ta = new Date(a.acceptedAt ?? a.placedAt).getTime();
      const tb = new Date(b.acceptedAt ?? b.placedAt).getTime();
      return ta - tb;
    });
  }, [orders]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-surface-base text-ink-primary">
      {/* Header minimalista */}
      <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-raised px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={r('/hub')}
            className="rounded-lg p-2 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
            aria-label="Voltar pro app"
            title="Voltar pro app"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cozinha</h1>
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-tertiary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-bright" />
              </span>
              <Radio className="h-3 w-3" />
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} na fila
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ClockDisplay />
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              soundOn
                ? 'bg-surface-raised text-ink-primary'
                : 'bg-surface-base text-ink-tertiary',
            )}
            title={soundOn ? 'Som ligado' : 'Som desligado'}
            aria-label="Toggle som"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised text-ink-primary hover:bg-surface-overlay"
            title="Tela cheia"
            aria-label="Toggle tela cheia"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Grid de pedidos */}
      <main className="flex-1 overflow-auto p-4">
        {isLoading && (
          <p className="py-12 text-center text-ink-tertiary">Carregando…</p>
        )}
        {!isLoading && sortedOrders.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ChefHat className="h-16 w-16 text-ink-tertiary opacity-30" />
            <h2 className="mt-4 text-2xl font-bold text-ink-secondary">
              Nenhum pedido em preparo
            </h2>
            <p className="mt-2 text-sm text-ink-tertiary">
              Quando um pedido for aceito no Hub, aparece aqui.
            </p>
          </div>
        )}
        <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sortedOrders.map((order) => (
            <KdsOrderTile
              key={order.id}
              order={order}
              now={now}
              onStartPreparing={() => accept.mutate(order.id)}
              onMarkReady={() => markReady.mutate(order.id)}
              isPending={accept.isPending || markReady.isPending}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// Card de pedido (KDS)
// =====================================================================

function KdsOrderTile({
  order,
  now,
  onStartPreparing,
  onMarkReady,
  isPending,
}: {
  order: KdsOrder;
  now: number;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  isPending: boolean;
}) {
  const start = new Date(order.acceptedAt ?? order.placedAt).getTime();
  const elapsedMs = Math.max(0, now - start);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const elapsedSec = Math.floor((elapsedMs % 60_000) / 1000);
  const elapsedLabel = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

  /** Cor escalonada baseada em tempo: <10min ok / 10-20 atenção / 20+ crítico. */
  const urgency = elapsedMin < 10 ? 'ok' : elapsedMin < 20 ? 'warn' : 'critical';
  const borderClass = clsx(
    order.status === 'ready' && 'border-success',
    order.status === 'preparing' && urgency === 'critical' && 'border-danger',
    order.status === 'preparing' && urgency === 'warn' && 'border-warning',
    order.status === 'preparing' && urgency === 'ok' && 'border-brand-500',
    order.status === 'accepted' && 'border-brand-500',
  );

  return (
    <article
      className={clsx(
        'flex flex-col overflow-hidden rounded-xl border-2 bg-surface-raised',
        borderClass,
      )}
    >
      {/* Cabeçalho do card */}
      <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-base/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge color={order.platform.colorHex}>{order.platform.name}</Badge>
          <span className="font-mono text-xs text-ink-tertiary">
            #{order.externalId.slice(0, 8)}
          </span>
        </div>
        <div
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-base font-bold tabular',
            order.status === 'ready'
              ? 'bg-success-soft text-success-bright'
              : urgency === 'critical'
                ? 'bg-danger-soft text-danger-bright'
                : urgency === 'warn'
                  ? 'bg-warning-soft text-warning-bright'
                  : 'bg-brand-500/10 text-brand-400',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {elapsedLabel}
        </div>
      </header>

      {/* Cliente */}
      {order.customer && (
        <div className="border-b border-surface-border-subtle px-4 py-2 text-sm text-ink-secondary">
          <span className="text-ink-tertiary">Cliente:</span>{' '}
          <span className="font-medium text-ink-primary">{order.customer.name}</span>
        </div>
      )}

      {/* Itens — corpo principal */}
      <div className="flex-1 px-4 py-3">
        <ul className="space-y-2.5">
          {order.items.map((item) => (
            <li key={item.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular text-brand-400">
                  {item.qty}×
                </span>
                <span className="text-base font-semibold leading-snug text-ink-primary">
                  {item.nameSnapshot}
                </span>
              </div>
              {item.modifiers.length > 0 && (
                <ul className="ml-9 mt-1 space-y-0.5 text-xs">
                  {item.modifiers.map((m) => (
                    <li key={m.id} className="text-ink-secondary">
                      + {m.qty}× {m.nameSnapshot}
                    </li>
                  ))}
                </ul>
              )}
              {item.notes && (
                <p className="ml-9 mt-1 italic text-warning-bright text-xs">
                  &ldquo;{item.notes}&rdquo;
                </p>
              )}
            </li>
          ))}
        </ul>

        {order.notes && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs italic text-warning-bright">
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* Footer: ação principal grande */}
      <footer className="border-t border-surface-border-subtle p-2">
        {order.status === 'accepted' && (
          <button
            onClick={onStartPreparing}
            disabled={isPending}
            className="w-full rounded-lg bg-brand-gradient py-3 text-base font-bold text-white shadow-sm hover:shadow-glow active:translate-y-px disabled:opacity-50"
          >
            Iniciar preparo
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={onMarkReady}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-success py-3 text-base font-bold text-white shadow-sm active:translate-y-px disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Pronto
          </button>
        )}
        {order.status === 'ready' && (
          <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-success-soft py-3 text-base font-bold text-success-bright">
            <CheckCircle2 className="h-4 w-4" />
            Aguardando despacho
          </div>
        )}
      </footer>
    </article>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function ClockDisplay() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime(new Date())), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden font-mono text-base font-bold tabular text-ink-primary md:inline-block">
      {time}
    </span>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function playBeep() {
  try {
    const audio = new Audio(
      // Tom de 880Hz por ~250ms (pra cozinha barulhenta — som mais agudo)
      'data:audio/wav;base64,UklGRsQDAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YaADAAB/f3+AgIB/f3+AgICAgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgICAgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgIB/f3+AgICAgIB/f3+AgIA=',
    );
    audio.play().catch(() => undefined);
  } catch {
    /* autoplay bloqueado */
  }
}
