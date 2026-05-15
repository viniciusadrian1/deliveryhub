'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Check } from 'lucide-react';
import { useState } from 'react';

import { api, ApiError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { OrderActionRequest } from '../../lib/hub-types';
import { Button } from '../ui/button';

interface ResolveBody {
  approve: boolean;
  reason?: string;
  baseReasonId?: string;
  baseReason?: string;
}

/**
 * Banners de pedido de cancelamento/reembolso aberto pelo cliente na
 * plataforma. Pendentes ganham UI de aprovar/recusar; resolvidos viram
 * uma linha de histórico.
 */
export function OrderActionRequests({
  orderId,
  requests,
}: {
  orderId: string;
  requests: OrderActionRequest[];
}) {
  if (requests.length === 0) return null;
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <ActionRequestCard key={r.id} orderId={orderId} request={r} />
      ))}
    </div>
  );
}

function ActionRequestCard({
  orderId,
  request,
}: {
  orderId: string;
  request: OrderActionRequest;
}) {
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reasonId, setReasonId] = useState('');

  const resolve = useMutation({
    mutationFn: async (body: ResolveBody) =>
      api(`/order-requests/${request.id}/resolve`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const kindLabel = request.kind === 'cancellation' ? 'cancelamento' : 'reembolso';

  // ── Resolvido: linha compacta de histórico ──────────────────────
  if (request.status !== 'pending') {
    const approved = request.status === 'approved';
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          approved
            ? 'border-success/30 bg-success-soft text-success-bright'
            : 'border-surface-border-subtle bg-surface-raised text-ink-secondary'
        }`}
      >
        Pedido de {kindLabel} <b>{approved ? 'aprovado' : 'recusado'}</b>
        {request.resolvedReason ? ` — ${request.resolvedReason}` : ''}
        {request.resolvedAt ? ` · ${timeAgo(request.resolvedAt)}` : ''}
      </div>
    );
  }

  // ── Pendente: banner de ação ────────────────────────────────────
  const refundOptions = (request.reasonOptions ?? []).filter((o) => o.id);
  const err = resolve.error as ApiError | null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-soft p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning-bright" />
        <p className="text-sm font-semibold text-ink-primary">
          Cliente pediu {kindLabel}
        </p>
        <span className="ml-auto text-[11px] text-ink-tertiary">
          {timeAgo(request.createdAt)}
        </span>
      </div>

      {request.customerReason && (
        <p className="mt-2 text-sm italic text-ink-secondary">
          "{request.customerReason}"
        </p>
      )}

      {request.evidenceImages && request.evidenceImages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {request.evidenceImages.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer">
              <img
                src={src}
                alt="Evidência do cliente"
                className="h-16 w-16 rounded-md border border-surface-border object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-ink-tertiary">
        {request.kind === 'cancellation'
          ? 'Se aprovar, o pedido é cancelado na plataforma. Sem resposta, é recusado automaticamente.'
          : 'Se aprovar, o reembolso é processado. Sem resposta, é aprovado automaticamente.'}
      </p>

      {err && (
        <p className="mt-2 rounded-md border border-danger/30 bg-danger-soft px-2 py-1 text-xs text-danger-bright">
          Não foi possível enviar a resposta. Tente de novo.
        </p>
      )}

      {declining && request.kind === 'refund' ? (
        <div className="mt-3 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
            Motivo da recusa
          </label>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary focus:border-brand-500 focus:outline-none"
          >
            <option value="">Selecione um motivo…</option>
            {refundOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!reasonId || resolve.isPending}
              onClick={() => {
                const opt = refundOptions.find((o) => o.id === reasonId);
                if (opt) {
                  resolve.mutate({
                    approve: false,
                    baseReasonId: opt.id,
                    baseReason: opt.label,
                  });
                }
              }}
            >
              {resolve.isPending ? 'Enviando…' : 'Confirmar recusa'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={resolve.isPending}
            leftIcon={<Ban className="h-3.5 w-3.5" />}
            onClick={() => {
              if (request.kind === 'refund') setDeclining(true);
              else resolve.mutate({ approve: false });
            }}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            loading={resolve.isPending}
            leftIcon={!resolve.isPending && <Check className="h-3.5 w-3.5" />}
            onClick={() => resolve.mutate({ approve: true })}
          >
            Aprovar {kindLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
