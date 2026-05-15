'use client';

import clsx from 'clsx';
import { AlertTriangle, Clock, User } from 'lucide-react';

import { formatCents, timeAgo } from '../../lib/format';
import type { OrderListItem } from '../../lib/hub-types';
import { Badge } from '../ui/badge';

interface OrderCardProps {
  order: OrderListItem;
  onClick: () => void;
  highlight?: boolean;
}

export function OrderCard({ order, onClick, highlight = false }: OrderCardProps) {
  const pendingRequest = order.actionRequests[0];
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group w-full overflow-hidden rounded-xl border bg-surface-raised bg-surface-gradient p-4 text-left shadow-sm transition-all hover:border-surface-border-strong hover:shadow-DEFAULT',
        pendingRequest
          ? 'border-warning/50 ring-1 ring-warning/30'
          : highlight
            ? 'border-brand-500/40 ring-1 ring-brand-500/30'
            : 'border-surface-border-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge color={order.platform.colorHex}>{order.platform.name}</Badge>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary">
          <Clock className="h-3 w-3" />
          {timeAgo(order.placedAt)}
        </span>
      </div>

      {pendingRequest && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-bright">
          <AlertTriangle className="h-3 w-3" />
          {pendingRequest.kind === 'cancellation'
            ? 'Cancelamento solicitado'
            : 'Reembolso solicitado'}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm">
        <User className="h-3.5 w-3.5 text-ink-tertiary" />
        <span className="truncate font-medium text-ink-primary">
          {order.customer?.name ?? 'Cliente anônimo'}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-surface-border-subtle pt-3">
        <span className="text-lg font-bold tabular text-ink-primary">
          {formatCents(order.totalCents)}
        </span>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-ink-tertiary">Líquido</p>
          <p className="text-xs font-semibold tabular text-success-bright">
            {formatCents(order.netCents)}
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-[11px] font-mono text-ink-tertiary">
        #{order.externalId.slice(0, 10)}
      </p>
    </button>
  );
}
