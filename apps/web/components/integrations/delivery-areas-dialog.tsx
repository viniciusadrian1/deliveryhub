'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { api, ApiError } from '../../lib/api';
import { formatCents } from '../../lib/format';
import type { DeliveryArea } from '../../lib/integrations-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

const FIELD =
  'w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none';
const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary';

/**
 * Gerencia as áreas de entrega de uma loja no 99Food. Lista as existentes
 * (círculo ou polígono) e permite adicionar círculos / excluir.
 */
export function DeliveryAreasDialog({
  storeId,
  onClose,
}: {
  storeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const key = ['delivery-areas', storeId];

  const [radiusKm, setRadiusKm] = useState(3);
  const [priceReais, setPriceReais] = useState(5);
  const [etaMinutes, setEtaMinutes] = useState(30);
  const [start, setStart] = useState('00:00');
  const [end, setEnd] = useState('23:59');

  const { data: areas = [], isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api<DeliveryArea[]>(`/integrations/${storeId}/delivery-areas`),
  });

  const add = useMutation({
    mutationFn: async () =>
      api(`/integrations/${storeId}/delivery-areas`, {
        method: 'POST',
        body: {
          areaType: 0,
          radiusKm,
          avgDeliveryEtaSeconds: Math.round(etaMinutes * 60),
          enableTimes: [{ start, end }],
          priceCents: Math.round(priceReais * 100),
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (areaIds: string[]) =>
      api(`/integrations/${storeId}/delivery-areas/delete`, {
        method: 'POST',
        body: { areaIds },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const loadErr = error as ApiError | null;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Áreas de entrega — 99Food"
      description="Defina o raio de entrega, o preço e os horários da loja."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-5">
        {loadErr && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
            {loadErr.status === 400
              ? 'Conecte o 99Food a esta loja para gerenciar áreas.'
              : 'Não foi possível carregar as áreas.'}
          </p>
        )}

        {/* ── Áreas existentes ───────────────────────────────────── */}
        <div className="space-y-2">
          {isLoading && (
            <p className="text-sm text-ink-tertiary">Carregando áreas…</p>
          )}
          {!isLoading && !loadErr && areas.length === 0 && (
            <p className="rounded-lg border border-dashed border-surface-border-subtle px-3 py-4 text-center text-sm text-ink-tertiary">
              Nenhuma área de entrega configurada ainda.
            </p>
          )}
          {areas.map((a) => (
            <div
              key={a.areaIds.join(',')}
              className="flex items-center gap-3 rounded-lg border border-surface-border-subtle bg-surface-raised p-3"
            >
              <MapPin className="h-4 w-4 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-primary">
                  {a.areaType === 0
                    ? `Círculo · raio ${a.radiusKm} km`
                    : `Polígono · ${a.pointCount} pontos`}
                </p>
                <p className="text-xs text-ink-tertiary">
                  {formatCents(a.priceCents)} ·{' '}
                  {Math.round(a.avgDeliveryEtaSeconds / 60)} min ·{' '}
                  {a.enableTimesLabel || 'sem horário'}
                </p>
              </div>
              <button
                onClick={() => remove.mutate(a.areaIds)}
                disabled={remove.isPending}
                className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-soft hover:text-danger-bright disabled:opacity-50"
                aria-label="Excluir área"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {remove.error != null && (
            <p className="text-xs text-danger-bright">Erro ao excluir a área.</p>
          )}
        </div>

        {/* ── Adicionar círculo ──────────────────────────────────── */}
        <div className="border-t border-surface-border-subtle pt-4">
          <p className="mb-3 text-sm font-semibold text-ink-primary">
            Adicionar área circular
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Raio (km)</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className={`mt-1 ${FIELD}`}
              />
            </div>
            <div>
              <label className={LABEL}>Preço (R$)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={priceReais}
                onChange={(e) => setPriceReais(Number(e.target.value))}
                className={`mt-1 ${FIELD}`}
              />
            </div>
            <div>
              <label className={LABEL}>Entrega (min)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Number(e.target.value))}
                className={`mt-1 ${FIELD}`}
              />
            </div>
            <div className="flex items-end gap-1">
              <div>
                <label className={LABEL}>Abre</label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={`mt-1 ${FIELD}`}
                />
              </div>
              <div>
                <label className={LABEL}>Fecha</label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={`mt-1 ${FIELD}`}
                />
              </div>
            </div>
          </div>
          {add.error != null && (
            <p className="mt-2 text-xs text-danger-bright">
              Não foi possível adicionar a área.
            </p>
          )}
          <Button
            size="sm"
            className="mt-3"
            loading={add.isPending}
            disabled={radiusKm <= 0}
            leftIcon={!add.isPending && <Plus className="h-3.5 w-3.5" />}
            onClick={() => add.mutate()}
          >
            Adicionar área
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
