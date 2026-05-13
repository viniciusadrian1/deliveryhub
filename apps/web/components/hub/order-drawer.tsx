'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api, ApiError } from '../../lib/api';
import { formatCents, STATUS_LABELS, timeAgo } from '../../lib/format';
import type { OrderDetail, OrderStatus } from '../../lib/hub-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface OrderDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

const NEXT_ACTION: Record<OrderStatus, { label: string; path: string } | null> = {
  placed: { label: 'Aceitar', path: 'accept' },
  accepted: { label: 'Iniciar preparo', path: 'preparing' },
  preparing: { label: 'Marcar pronto', path: 'ready' },
  ready: { label: 'Despachar', path: 'dispatch' },
  dispatched: { label: 'Marcar entregue', path: 'delivered' },
  delivered: null,
  cancelled: null,
};

export function OrderDrawer({ orderId, onClose }: OrderDrawerProps) {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api<OrderDetail>(`/orders/${orderId}`),
    enabled: !!orderId,
  });

  const advance = useMutation({
    mutationFn: async (path: string) => {
      return api<OrderDetail>(`/orders/${orderId}/${path}`, { method: 'POST' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const reject = useMutation({
    mutationFn: async (reason: string) => {
      return api<OrderDetail>(`/orders/${orderId}/reject`, {
        method: 'POST',
        body: { reason },
      });
    },
    onSuccess: () => {
      setShowRejectForm(false);
      setRejectReason('');
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  if (!orderId) return null;

  const nextAction = data ? NEXT_ACTION[data.status] : null;
  const canReject = data && !['delivered', 'cancelled'].includes(data.status);
  const apiErr = (advance.error ?? reject.error) as ApiError | null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="font-semibold">
            {data ? `Pedido #${data.externalId.slice(0, 8)}` : 'Pedido'}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}
          {error && (
            <p className="text-sm text-status-error">Erro ao carregar o pedido.</p>
          )}

          {data && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge color={data.platform.colorHex}>{data.platform.name}</Badge>
                <Badge>{STATUS_LABELS[data.status]}</Badge>
                <span className="text-xs text-zinc-500">{timeAgo(data.placedAt)}</span>
              </div>

              {data.customer && (
                <div>
                  <p className="text-sm font-medium">{data.customer.name}</p>
                  {data.customer.phone && (
                    <p className="text-xs text-zinc-500">{data.customer.phone}</p>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Itens
                </h3>
                <ul className="space-y-3">
                  {data.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {item.qty}× {item.nameSnapshot}
                          </p>
                          {item.notes && (
                            <p className="text-xs italic text-zinc-500">"{item.notes}"</p>
                          )}
                        </div>
                        <span className="text-sm font-mono">
                          {formatCents(item.totalCents)}
                        </span>
                      </div>
                      {item.modifiers.length > 0 && (
                        <ul className="mt-1 ml-4 space-y-0.5">
                          {item.modifiers.map((m) => (
                            <li
                              key={m.id}
                              className="flex justify-between text-xs text-zinc-500"
                            >
                              <span>
                                + {m.qty}× {m.nameSnapshot}
                              </span>
                              <span className="font-mono">
                                {formatCents(m.unitPriceCents * m.qty)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                <Row label="Subtotal" value={formatCents(data.subtotalCents)} />
                <Row label="Entrega" value={formatCents(data.deliveryFeeCents)} />
                <Row
                  label={`Taxa ${data.platform.name}`}
                  value={`–${formatCents(data.platformFeeCents)}`}
                  muted
                />
                {data.processingFeeCents > 0 && (
                  <Row
                    label="Processamento"
                    value={`–${formatCents(data.processingFeeCents)}`}
                    muted
                  />
                )}
                <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
                <Row label="Total" value={formatCents(data.totalCents)} bold />
                <Row label="Líquido pra você" value={formatCents(data.netCents)} bold />
              </div>

              {data.notes && (
                <div className="rounded-md bg-yellow-50 p-3 text-sm dark:bg-yellow-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-500">
                    Observação do cliente
                  </p>
                  <p className="mt-1 italic">"{data.notes}"</p>
                </div>
              )}

              {data.cancellationReason && (
                <div className="rounded-md bg-red-50 p-3 text-sm dark:bg-red-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-status-error">
                    Cancelado
                  </p>
                  <p className="mt-1">{data.cancellationReason}</p>
                </div>
              )}

              {apiErr && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-error dark:bg-red-950/40">
                  {apiErr.status === 400
                    ? 'Transição inválida.'
                    : 'Erro ao executar a ação.'}
                </p>
              )}

              {showRejectForm && (
                <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Motivo da rejeição
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex.: item esgotado"
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectReason('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!rejectReason.trim() || reject.isPending}
                      onClick={() => reject.mutate(rejectReason.trim())}
                    >
                      {reject.isPending ? 'Enviando…' : 'Confirmar rejeição'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {data && (canReject || nextAction) && !showRejectForm && (
          <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            {canReject && data.status === 'placed' && (
              <Button
                variant="secondary"
                onClick={() => setShowRejectForm(true)}
                disabled={advance.isPending}
              >
                Recusar
              </Button>
            )}
            {canReject && data.status !== 'placed' && (
              <Button
                variant="ghost"
                onClick={() => setShowRejectForm(true)}
                disabled={advance.isPending}
              >
                Cancelar pedido
              </Button>
            )}
            {nextAction && (
              <Button
                className="ml-auto"
                onClick={() => advance.mutate(nextAction.path)}
                disabled={advance.isPending}
              >
                {advance.isPending ? 'Enviando…' : `${nextAction.label} →`}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={
        'flex justify-between ' +
        (muted ? 'text-zinc-500 ' : '') +
        (bold ? 'font-semibold ' : '')
      }
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
