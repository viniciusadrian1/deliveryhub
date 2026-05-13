'use client';

import clsx from 'clsx';

import { formatCents, STATUS_LABELS, timeAgo } from '../../lib/format';
import type { OrderListItem } from '../../lib/hub-types';
import { Badge } from '../ui/badge';

interface OrderCardProps {
  order: OrderListItem;
  onClick: () => void;
  highlight?: boolean;
}

export function OrderCard({ order, onClick, highlight = false }: OrderCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group w-full rounded-lg border bg-white p-3 text-left transition-all hover:shadow-md dark:bg-zinc-900',
        highlight
          ? 'border-status-open border-2 shadow-md'
          : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge color={order.platform.colorHex}>{order.platform.name}</Badge>
            <span className="text-xs font-mono text-zinc-500">
              #{order.externalId.slice(0, 6)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium">
            {order.customer?.name ?? 'Cliente anônimo'}
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{timeAgo(order.placedAt)}</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-base font-semibold">{formatCents(order.totalCents)}</span>
        <span className="text-xs text-zinc-500">
          Líquido {formatCents(order.netCents)}
        </span>
      </div>

      {order.notes && (
        <p className="mt-1 line-clamp-1 text-xs italic text-zinc-500">
          "{order.notes}"
        </p>
      )}

      <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-400">
        {STATUS_LABELS[order.status]}
      </div>
    </button>
  );
}
