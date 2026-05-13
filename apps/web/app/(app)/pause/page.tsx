'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import type { PlatformConnection } from '../../../lib/integrations-types';
import { PLATFORM_META } from '../../../lib/integrations-types';

interface Pause {
  id: string;
  storeId: string;
  scope: 'store' | 'category' | 'item';
  category: { id: string; name: string } | null;
  menuItem: { id: string; name: string } | null;
  platformIds: string[];
  startsAt: string;
  endsAt: string | null;
  reason: string;
  reasonNote: string | null;
  cancelledAt: string | null;
  reopenedAt: string | null;
  appliedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  kitchen_overloaded: 'Cozinha sobrecarregada',
  end_of_shift: 'Fim de expediente',
  out_of_stock: 'Falta de insumo',
  scheduled: 'Programada',
  other: 'Outro',
};

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: 'Até reabrir', minutes: 0 },
];

export default function PausePage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [open, setOpen] = useState(false);

  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState<string>('kitchen_overloaded');
  const [reasonNote, setReasonNote] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const { data: active = [] } = useQuery({
    queryKey: ['pauses', 'active', storeId],
    queryFn: () =>
      api<Pause[]>(`/pauses/active?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['pauses', 'history', storeId],
    queryFn: () =>
      api<Pause[]>(
        `/pauses?storeId=${encodeURIComponent(storeId ?? '')}&status=history&limit=20`,
      ),
    enabled: !!storeId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<PlatformConnection[]>('/integrations/connections'),
    enabled: !!storeId,
  });

  const create = useMutation({
    mutationFn: async () =>
      api('/pauses', {
        method: 'POST',
        body: {
          storeId,
          scope: 'store',
          platformCodes: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          durationMinutes: duration > 0 ? duration : undefined,
          reason,
          reasonNote: reasonNote || undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pauses'] });
      setOpen(false);
      setReasonNote('');
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => api(`/pauses/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pauses'] }),
  });

  const activeConnections = connections.filter((c) => c.status === 'active');
  const togglePlatform = (code: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  if (!storeId) return <p className="text-sm text-zinc-500">Crie/selecione uma loja primeiro.</p>;

  const storeStatus = active.length === 0 ? 'open' : 'paused';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pausa Multiplataforma ⭐</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pause a loja em uma, várias ou todas as plataformas. Reabertura automática
          no horário definido.
        </p>
      </header>

      {/* Status geral da loja */}
      <section
        className={`rounded-xl border p-5 ${
          storeStatus === 'open'
            ? 'border-status-open bg-green-50 dark:bg-green-950/20'
            : 'border-status-paused bg-yellow-50 dark:bg-yellow-950/20'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-zinc-500">Status atual</p>
            <p className="mt-1 text-xl font-bold">
              {storeStatus === 'open' ? (
                <span className="text-status-open">🟢 Aberta em todas as plataformas conectadas</span>
              ) : (
                <span className="text-status-paused">
                  🟡 {active.length} pausa{active.length === 1 ? '' : 's'} ativa{active.length === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            ⏸️ Pausar
          </Button>
        </div>
      </section>

      {/* Pausas ativas */}
      {active.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <header className="bg-zinc-50 px-4 py-2 font-semibold dark:bg-zinc-900">
            Pausas ativas
          </header>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {active.map((p) => (
              <PauseRow key={p.id} pause={p} onCancel={() => cancel.mutate(p.id)} cancelling={cancel.isPending} />
            ))}
          </ul>
        </section>
      )}

      {/* Histórico */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <header className="bg-zinc-50 px-4 py-2 font-semibold dark:bg-zinc-900">
          Histórico (últimas {history.length})
        </header>
        {history.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma pausa anterior.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {history.map((p) => (
              <PauseRow key={p.id} pause={p} />
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Pausar loja"
        description="A pausa será propagada para as plataformas selecionadas em tempo real."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Pausando…' : 'Confirmar pausa →'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Plataformas</p>
            <p className="mt-1 text-xs text-zinc-500">
              Vazio = todas as plataformas conectadas (
              {activeConnections.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeConnections.length === 0 && (
                <p className="text-xs text-status-error">
                  Nenhuma plataforma ativa. Conecte em Integrações primeiro.
                </p>
              )}
              {activeConnections.map((c) => {
                const meta = PLATFORM_META[c.platformCode];
                const selected = selectedPlatforms.includes(c.platformCode);
                return (
                  <button
                    key={c.platformCode}
                    type="button"
                    onClick={() => togglePlatform(c.platformCode)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selected
                        ? 'text-white'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                    style={selected ? { backgroundColor: meta?.colorHex ?? '#888' } : {}}
                  >
                    {selected && '✓ '}
                    {meta?.name ?? c.platformCode}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Duração</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDuration(p.minutes)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    duration === p.minutes
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {Object.entries(REASON_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Observação (opcional)"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Ex.: cancelar todos os pedidos novos por enquanto"
          />
        </div>
      </Dialog>
    </div>
  );
}

function PauseRow({
  pause,
  onCancel,
  cancelling,
}: {
  pause: Pause;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const isActive = !pause.cancelledAt && !pause.reopenedAt;
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Badge color="#CA8A04">ATIVA</Badge>
          ) : pause.cancelledAt ? (
            <Badge>cancelada</Badge>
          ) : (
            <Badge>reaberta</Badge>
          )}
          <span className="text-sm font-medium">
            {pause.scope === 'store' && 'Loja inteira'}
            {pause.scope === 'category' && `Categoria: ${pause.category?.name}`}
            {pause.scope === 'item' && `Item: ${pause.menuItem?.name}`}
          </span>
          <span className="text-xs text-zinc-500">{REASON_LABEL[pause.reason] ?? pause.reason}</span>
        </div>
        {pause.reasonNote && <p className="mt-1 text-xs text-zinc-500">"{pause.reasonNote}"</p>}
        <p className="mt-1 text-xs text-zinc-500">
          Início: {new Date(pause.startsAt).toLocaleString('pt-BR')}
          {pause.endsAt && ` · Termina: ${new Date(pause.endsAt).toLocaleString('pt-BR')}`}
          {!pause.endsAt && isActive && ' · Indefinida'}
        </p>
        {pause.errorMessage && (
          <p className="mt-1 text-xs text-status-error">⚠ {pause.errorMessage}</p>
        )}
      </div>
      {onCancel && isActive && (
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={cancelling}>
          Reabrir agora
        </Button>
      )}
    </li>
  );
}
