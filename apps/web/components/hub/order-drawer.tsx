'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChefHat,
  Clock,
  Loader2,
  Phone,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { api, ApiError } from '../../lib/api';
import { formatCents, timeAgo } from '../../lib/format';
import type { OrderDetail, OrderStatus, PaymentMethod } from '../../lib/hub-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CourierDispatchDialog } from './courier-dispatch-dialog';
import { OrderActionRequests } from './order-action-requests';

interface OrderDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

interface NextAction {
  label: string;
  path: string;
  icon: typeof CheckCircle2;
}

const NEXT_ACTION: Record<OrderStatus, NextAction | null> = {
  placed: { label: 'Aceitar pedido', path: 'accept', icon: CheckCircle2 },
  accepted: { label: 'Iniciar preparo', path: 'preparing', icon: ChefHat },
  preparing: { label: 'Marcar pronto', path: 'ready', icon: CheckCircle2 },
  ready: { label: 'Despachar', path: 'dispatch', icon: Truck },
  dispatched: { label: 'Marcar entregue', path: 'delivered', icon: CheckCircle2 },
  delivered: null,
  cancelled: null,
};

const STATUS_VARIANT: Record<
  OrderStatus,
  'brand' | 'info' | 'warning' | 'success' | 'neutral' | 'danger'
> = {
  placed: 'brand',
  accepted: 'info',
  preparing: 'warning',
  ready: 'success',
  dispatched: 'info',
  delivered: 'success',
  cancelled: 'danger',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Novo',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  ready: 'Pronto',
  dispatched: 'Despachado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  online: 'Online',
  cash: 'Dinheiro',
  other: 'Outro',
};

export function OrderDrawer({ orderId, onClose }: OrderDrawerProps) {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showCourier, setShowCourier] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api<OrderDetail>(`/orders/${orderId}`),
    enabled: !!orderId,
  });

  const advance = useMutation({
    mutationFn: async (path: string) =>
      api<OrderDetail>(`/orders/${orderId}/${path}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const reject = useMutation({
    mutationFn: async (reason: string) =>
      api<OrderDetail>(`/orders/${orderId}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      setShowRejectForm(false);
      setRejectReason('');
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const confirmCash = useMutation({
    mutationFn: async () =>
      api<OrderDetail>(`/orders/${orderId}/confirm-cash`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  if (!orderId) return null;

  const nextAction = data ? NEXT_ACTION[data.status] : null;
  const canReject = data && !['delivered', 'cancelled'].includes(data.status);
  const apiErr = (advance.error ?? reject.error) as ApiError | null;
  const NextIcon = nextAction?.icon;
  // Despacho de pedido 99Food de entrega própria precisa dos dados do
  // entregador — abre um diálogo em vez do POST /dispatch direto.
  const needsCourierDialog =
    !!data &&
    nextAction?.path === 'dispatch' &&
    data.platform.code === '99food' &&
    data.deliveryBy === 'store';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-surface-border bg-surface-overlay shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border-subtle px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-tertiary">
              Pedido
            </p>
            <h2 className="font-mono text-sm font-semibold text-ink-primary">
              {data ? `#${data.externalId.slice(0, 12)}` : '…'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-surface-raised hover:text-ink-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-ink-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
              Erro ao carregar o pedido.
            </p>
          )}

          {data && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Badge color={data.platform.colorHex}>{data.platform.name}</Badge>
                <Badge variant={STATUS_VARIANT[data.status]} dot>
                  {STATUS_LABELS[data.status]}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
                  <Clock className="h-3 w-3" />
                  {timeAgo(data.placedAt)}
                </span>
              </div>

              {(data.paymentMethod || data.deliveryBy || data.courierName) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-tertiary">
                  {data.paymentMethod && (
                    <span>
                      Pagamento:{' '}
                      <b className="text-ink-secondary">
                        {PAYMENT_LABELS[data.paymentMethod]}
                      </b>
                    </span>
                  )}
                  {data.deliveryBy && (
                    <span>
                      Entrega:{' '}
                      <b className="text-ink-secondary">
                        {data.deliveryBy === 'platform'
                          ? data.platform.name
                          : 'Loja própria'}
                      </b>
                    </span>
                  )}
                  {data.courierName && (
                    <span>
                      Entregador:{' '}
                      <b className="text-ink-secondary">
                        {data.courierName}
                        {data.courierPhone ? ` · ${data.courierPhone}` : ''}
                      </b>
                    </span>
                  )}
                </div>
              )}

              {data.actionRequests.length > 0 && (
                <OrderActionRequests orderId={data.id} requests={data.actionRequests} />
              )}

              {data.customer && (
                <div className="surface-card flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-primary">
                      {data.customer.name}
                    </p>
                    {data.customer.phone && (
                      <p className="inline-flex items-center gap-1 text-xs text-ink-secondary">
                        <Phone className="h-3 w-3" />
                        {data.customer.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  Itens · {data.items.length}
                </h3>
                <ul className="space-y-2">
                  {data.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-surface-border-subtle bg-surface-raised p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-primary">
                            <span className="text-ink-tertiary">{item.qty}×</span>{' '}
                            {item.nameSnapshot}
                          </p>
                          {item.notes && (
                            <p className="mt-0.5 text-xs italic text-ink-secondary">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-mono tabular text-ink-primary">
                          {formatCents(item.totalCents)}
                        </span>
                      </div>
                      {item.modifiers.length > 0 && (
                        <ul className="mt-2 space-y-1 border-l-2 border-surface-border-subtle pl-3">
                          {item.modifiers.map((m) => (
                            <li
                              key={m.id}
                              className="flex justify-between text-xs text-ink-secondary"
                            >
                              <span>+ {m.qty}× {m.nameSnapshot}</span>
                              <span className="font-mono tabular">
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

              <div className="surface-card p-4">
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
                <div className="my-2 h-px bg-surface-border-subtle" />
                <Row label="Total" value={formatCents(data.totalCents)} bold />
                <Row
                  label="Líquido pra você"
                  value={formatCents(data.netCents)}
                  bold
                  tone="success"
                />
              </div>

              {data.platform.code === '99food' && data.paymentMethod === 'cash' && (
                <div className="rounded-lg border border-info/30 bg-info-soft p-3">
                  {data.cashPaymentConfirmedAt ? (
                    <p className="flex items-center gap-2 text-sm text-info">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Recebimento em dinheiro confirmado.
                    </p>
                  ) : (
                    <>
                      <p className="flex items-center gap-2 text-sm font-medium text-ink-primary">
                        <Banknote className="h-4 w-4 shrink-0 text-info" />
                        Pedido pago em dinheiro
                      </p>
                      <p className="mt-1 text-xs text-ink-secondary">
                        Confirme quando receber o valor em mãos do entregador 99Food.
                      </p>
                      {confirmCash.error != null && (
                        <p className="mt-2 text-xs text-danger-bright">
                          {(confirmCash.error as ApiError).status === 400
                            ? 'Não foi possível confirmar agora — verifique o status do pedido.'
                            : 'Erro ao confirmar o recebimento.'}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="mt-2"
                        loading={confirmCash.isPending}
                        leftIcon={
                          !confirmCash.isPending && <Banknote className="h-3.5 w-3.5" />
                        }
                        onClick={() => confirmCash.mutate()}
                      >
                        Confirmar recebimento
                      </Button>
                    </>
                  )}
                </div>
              )}

              {data.notes && (
                <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-warning-bright">
                    Observação do cliente
                  </p>
                  <p className="mt-1 italic text-ink-primary">"{data.notes}"</p>
                </div>
              )}

              {data.cancellationReason && (
                <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-danger-bright">
                    Cancelado
                  </p>
                  <p className="mt-1 text-ink-primary">{data.cancellationReason}</p>
                </div>
              )}

              {apiErr && (
                <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
                  {apiErr.status === 400 ? 'Transição inválida.' : 'Erro ao executar a ação.'}
                </p>
              )}

              {showRejectForm && (
                <div className="surface-card p-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                    Motivo da rejeição
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex.: item esgotado"
                    className="mt-2 w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none"
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
                      leftIcon={<XCircle className="h-3.5 w-3.5" />}
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
          <footer className="flex items-center gap-2 border-t border-surface-border-subtle bg-surface-base/40 px-5 py-3">
            {canReject && data.status === 'placed' && (
              <Button
                variant="secondary"
                onClick={() => setShowRejectForm(true)}
                disabled={advance.isPending}
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
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
                onClick={() => {
                  if (needsCourierDialog) setShowCourier(true);
                  else advance.mutate(nextAction.path);
                }}
                loading={advance.isPending}
                leftIcon={NextIcon && <NextIcon className="h-4 w-4" />}
                rightIcon={!advance.isPending && <ArrowRight className="h-4 w-4" />}
              >
                {nextAction.label}
              </Button>
            )}
          </footer>
        )}

        {data && showCourier && (
          <CourierDispatchDialog
            orderId={data.id}
            onClose={() => setShowCourier(false)}
          />
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
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  tone?: 'success';
}) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <span className={clsx('text-ink-secondary', muted && 'text-ink-tertiary')}>{label}</span>
      <span
        className={clsx(
          'font-mono tabular',
          bold && 'font-semibold',
          tone === 'success' && 'text-success-bright',
          !tone && !muted && 'text-ink-primary',
          muted && 'text-ink-tertiary',
        )}
      >
        {value}
      </span>
    </div>
  );
}
