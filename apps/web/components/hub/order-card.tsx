'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock,
  Loader2,
  MessageSquare,
  Truck,
  User,
  XCircle,
} from 'lucide-react';

import { api } from '../../lib/api';
import { formatCents, formatOrderNumber, timeAgo } from '../../lib/format';
import type { OrderListItem, OrderStatus } from '../../lib/hub-types';
import { PlatformLogo } from '../ui/platform-logo';

interface OrderCardProps {
  order: OrderListItem;
  onClick: () => void;
  highlight?: boolean;
}

interface CardAction {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  buttonClass: string;
}

const CARD_ACTIONS: Partial<Record<OrderStatus, CardAction>> = {
  placed: {
    label: '✓ Aceitar Pedido',
    path: 'accept',
    icon: Check,
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md shadow-emerald-950/20 active:bg-emerald-700',
  },
  accepted: {
    label: 'Iniciar Preparo',
    path: 'preparing',
    icon: ChefHat,
    buttonClass: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold',
  },
  preparing: {
    label: 'Pronto p/ Entrega',
    path: 'ready',
    icon: Check,
    buttonClass: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold',
  },
  ready: {
    label: 'Despachar Pedido',
    path: 'dispatch',
    icon: Truck,
    buttonClass: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 font-bold',
  },
  dispatched: {
    label: 'Concluir Pedido',
    path: 'delivered',
    icon: Check,
    buttonClass: 'bg-surface-overlay hover:bg-surface-raised text-ink-primary border border-surface-border font-bold',
  },
};

export function OrderCard({ order, onClick, highlight = false }: OrderCardProps) {
  const qc = useQueryClient();
  const pendingRequest = order.actionRequests[0];
  const isCancelled = order.status === 'cancelled';
  const totalItemCount = order.items?.reduce((acc, item) => acc + item.qty, 0) ?? 0;
  const orderNumber = formatOrderNumber(order.externalId);
  const nextAction = CARD_ACTIONS[order.status];

  const advance = useMutation({
    mutationFn: async (path: string) =>
      api(`/orders/${order.id}/${path}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={clsx(
        'group relative w-full overflow-hidden rounded-xl border bg-surface-raised bg-surface-gradient p-2.5 sm:p-3 text-left shadow-xs transition-all hover:border-surface-border-strong hover:shadow-md cursor-pointer select-none',
        isCancelled
          ? 'border-danger/40 opacity-85 hover:opacity-100 hover:border-danger/60'
          : pendingRequest
            ? 'border-warning/50 ring-1 ring-warning/30'
            : highlight
              ? 'border-brand-500/40 ring-1 ring-brand-500/30'
              : 'border-surface-border-subtle',
      )}
    >
      {/* Faixa sutil no topo com a cor da plataforma estilo comanda */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: isCancelled ? '#EF4444' : order.platform.colorHex || '#FFCC00' }}
      />

      {/* Top Header: Logo da Plataforma + PEDIDO #NÚMERO + Horário */}
      <div className="mt-0.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <PlatformLogo code={order.platform.code} name={order.platform.name} size="sm" />
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-ink-tertiary shrink-0">
              #
            </span>
            <span className="font-mono text-sm sm:text-base font-black tracking-tight text-ink-primary truncate">
              {orderNumber}
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-ink-tertiary bg-surface-base/80 px-1.5 py-0.5 rounded border border-surface-border-subtle shrink-0">
          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          {timeAgo(order.placedAt)}
        </span>
      </div>

      {/* Alerta de Pedido Cancelado em destaque limpo e sem sobreposição */}
      {isCancelled && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-danger-soft/90 border border-danger/30 py-1.5 px-3 text-xs font-bold text-danger-bright uppercase tracking-wider">
          <XCircle className="h-4 w-4 shrink-0" />
          Pedido Cancelado
        </div>
      )}

      {/* Alerta de solicitação de cancelamento/reembolso pendente */}
      {pendingRequest && (
        <div className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-bright">
          <AlertTriangle className="h-3 w-3" />
          {pendingRequest.kind === 'cancellation'
            ? 'Cancelamento solicitado'
            : 'Reembolso solicitado'}
        </div>
      )}

      {/* Destinatário / Cliente estilo comanda */}
      <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-surface-border-subtle/80 pt-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="h-3.5 w-3.5 text-ink-tertiary shrink-0" />
          <span className="font-bold text-ink-primary truncate">
            {order.customer?.name ?? 'Cliente'}
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold text-ink-tertiary">
          {totalItemCount} {totalItemCount === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {/* Itens do Pedido no estilo bloco de notas / comanda */}
      {order.items && order.items.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-surface-border-subtle/80 bg-surface-base/70 p-2.5 space-y-2">
          <div className="space-y-2 divide-y divide-surface-border-subtle/40">
            {order.items.slice(0, 4).map((item) => (
              <div key={item.id} className="pt-2 first:pt-0">
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="shrink-0 font-mono font-bold text-brand-400 bg-brand-500/10 px-1 rounded text-[11px]">
                      {item.qty}x
                    </span>
                    <span className="font-medium text-ink-primary leading-snug">
                      {item.nameSnapshot}
                    </span>
                  </div>
                  {item.unitPriceCents > 0 && (
                    <span className="shrink-0 font-mono text-[11px] text-ink-secondary tabular font-medium">
                      {formatCents(item.unitPriceCents * item.qty)}
                    </span>
                  )}
                </div>

                {/* Complementos / Adicionais */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {item.modifiers.map((mod) => (
                      <p key={mod.id} className="text-[11px] text-ink-tertiary truncate">
                        + {mod.qty > 1 ? `${mod.qty}x ` : ''}{mod.nameSnapshot}
                      </p>
                    ))}
                  </div>
                )}

                {/* Observação individual do item */}
                {item.notes && (
                  <p className="ml-6 mt-1 text-[10px] text-warning-bright italic truncate">
                    Obs: {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {order.items.length > 4 && (
            <p className="mt-1 text-[11px] font-medium text-brand-400 text-center">
              + {order.items.length - 4} {order.items.length - 4 === 1 ? 'outro item' : 'outros itens'}
            </p>
          )}
        </div>
      )}

      {/* Observações gerais do pedido (estilo nota de atenção) */}
      {order.notes && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-md border-l-2 border-warning bg-warning-soft/20 px-2.5 py-1.5 text-xs text-ink-secondary">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-warning-bright mt-0.5" />
          <p className="text-[11px] leading-relaxed line-clamp-2">
            <span className="font-bold text-warning-bright">Obs: </span>
            {order.notes}
          </p>
        </div>
      )}

      {/* Rodapé: Linha de Totais da Comanda com Total e Líquido equilibrados */}
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-surface-border-subtle/80 pt-2.5">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-tertiary">Total</p>
          <p
            className={clsx(
              'font-mono text-lg font-black tabular',
              isCancelled ? 'line-through text-ink-tertiary' : 'text-ink-primary',
            )}
          >
            {formatCents(order.totalCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-tertiary">Líquido</p>
          <p
            className={clsx(
              'font-mono text-lg font-black tabular',
              isCancelled ? 'text-danger-bright' : 'text-success-bright',
            )}
          >
            {isCancelled ? 'R$ 0,00' : formatCents(order.netCents)}
          </p>
        </div>
      </div>

      {/* Botão de Ação Rápida de Restaurante (Avança de coluna instantaneamente) */}
      {nextAction && !isCancelled && (
        <div className="mt-2.5 pt-2 border-t border-surface-border-subtle/60">
          <button
            type="button"
            disabled={advance.isPending}
            onClick={(e) => {
              e.stopPropagation();
              advance.mutate(nextAction.path);
            }}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 disabled:pointer-events-none truncate',
              nextAction.buttonClass,
            )}
          >
            {advance.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <nextAction.icon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{nextAction.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
