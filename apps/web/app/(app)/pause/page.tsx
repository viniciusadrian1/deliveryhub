'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  CircleDot,
  Clock,
  PauseCircle,
  Play,
  PowerOff,
  RotateCcw,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
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
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: 'Indefinida', minutes: 0 },
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
    queryFn: () => api<Pause[]>(`/pauses/active?storeId=${encodeURIComponent(storeId ?? '')}`),
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

  if (!storeId) {
    return (
      <EmptyState
        icon={PauseCircle}
        title="Nenhuma loja configurada"
        description="Crie uma loja primeiro."
      />
    );
  }

  const isOpen = active.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start gap-2">
          <h1>Pausa Multiplataforma</h1>
          <Badge variant="brand" dot>
            Diferencial
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          Pause em uma, várias ou todas as plataformas — total, por categoria ou item.
          Reabertura automática no horário definido.
        </p>
      </header>

      {/* Status banner */}
      <section
        className={clsx(
          'surface-card relative overflow-hidden p-6',
          isOpen ? 'border-success/40' : 'border-warning/40',
        )}
      >
        <div
          className={clsx(
            'pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20 blur-3xl',
            isOpen ? 'bg-success' : 'bg-warning',
          )}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={clsx(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                isOpen
                  ? 'bg-success-soft text-success-bright'
                  : 'bg-warning-soft text-warning-bright',
              )}
            >
              {isOpen ? (
                <CircleDot className="h-6 w-6 animate-pulse" />
              ) : (
                <PauseCircle className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                Status atual
              </p>
              <p
                className={clsx(
                  'text-lg font-bold',
                  isOpen ? 'text-success-bright' : 'text-warning-bright',
                )}
              >
                {isOpen
                  ? 'Aberta em todas as plataformas conectadas'
                  : `${active.length} pausa${active.length === 1 ? '' : 's'} ativa${active.length === 1 ? '' : 's'}`}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                {isOpen
                  ? `${activeConnections.length} plataforma${activeConnections.length === 1 ? '' : 's'} ${activeConnections.length === 1 ? 'conectada' : 'conectadas'}`
                  : 'Pedidos podem não estar chegando em todas as plataformas'}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            variant={isOpen ? 'primary' : 'secondary'}
            onClick={() => setOpen(true)}
            leftIcon={<PauseCircle className="h-4 w-4" />}
          >
            Pausar loja
          </Button>
        </div>
      </section>

      {/* Pausas ativas */}
      {active.length > 0 && (
        <section className="surface-card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-surface-border-subtle px-5 py-3">
            <PauseCircle className="h-4 w-4 text-warning-bright" />
            <h2 className="text-sm font-semibold text-ink-primary">Pausas ativas</h2>
            <Badge variant="warning">{active.length}</Badge>
          </header>
          <ul className="divide-y divide-surface-border-subtle">
            {active.map((p) => (
              <PauseRow
                key={p.id}
                pause={p}
                onCancel={() => cancel.mutate(p.id)}
                cancelling={cancel.isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Histórico */}
      <section className="surface-card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-surface-border-subtle px-5 py-3">
          <RotateCcw className="h-4 w-4 text-ink-tertiary" />
          <h2 className="text-sm font-semibold text-ink-primary">Histórico</h2>
          <Badge variant="neutral">{history.length}</Badge>
        </header>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-ink-tertiary">
            Nenhuma pausa anterior registrada.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border-subtle">
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
        description="A pausa é propagada para as plataformas selecionadas em tempo real."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => create.mutate()}
              loading={create.isPending}
              leftIcon={<PauseCircle className="h-4 w-4" />}
            >
              Confirmar pausa
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* plataformas */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Plataformas
            </p>
            <p className="mt-1 text-xs text-ink-tertiary">
              Vazio = todas as plataformas conectadas ({activeConnections.length})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeConnections.length === 0 && (
                <p className="text-xs text-danger-bright">
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
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                      selected
                        ? 'text-white shadow-sm'
                        : 'border border-surface-border bg-surface-base text-ink-secondary hover:border-surface-border-strong hover:text-ink-primary',
                    )}
                    style={selected ? { backgroundColor: meta?.colorHex ?? '#888' } : {}}
                  >
                    {selected && '✓ '}
                    {meta?.name ?? c.platformCode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* duração */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Duração
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDuration(p.minutes)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                    duration === p.minutes
                      ? 'bg-brand-gradient text-white shadow-sm'
                      : 'border border-surface-border bg-surface-base text-ink-secondary hover:border-surface-border-strong hover:text-ink-primary',
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* motivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Motivo
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm text-ink-primary focus:border-brand-500 focus:outline-none"
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
            placeholder="Ex.: voltamos em 30 min"
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
  const ScopeIcon =
    pause.scope === 'store' ? Store : pause.scope === 'item' ? UtensilsCrossed : PowerOff;

  return (
    <li className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="flex flex-1 items-start gap-3 min-w-0">
        <div
          className={clsx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isActive
              ? 'bg-warning-soft text-warning-bright'
              : 'bg-surface-overlay text-ink-tertiary',
          )}
        >
          <ScopeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <Badge variant="warning" dot>
                Ativa
              </Badge>
            ) : pause.cancelledAt ? (
              <Badge variant="neutral">Cancelada</Badge>
            ) : (
              <Badge variant="success">Reaberta</Badge>
            )}
            <p className="text-sm font-medium text-ink-primary">
              {pause.scope === 'store' && 'Loja inteira'}
              {pause.scope === 'category' && `Categoria · ${pause.category?.name ?? '—'}`}
              {pause.scope === 'item' && `Item · ${pause.menuItem?.name ?? '—'}`}
            </p>
            <span className="text-xs text-ink-tertiary">
              {REASON_LABEL[pause.reason] ?? pause.reason}
            </span>
          </div>
          {pause.reasonNote && (
            <p className="mt-1 text-xs italic text-ink-secondary">"{pause.reasonNote}"</p>
          )}
          <p className="mt-1 text-xs text-ink-tertiary">
            Início: {new Date(pause.startsAt).toLocaleString('pt-BR')}
            {pause.endsAt && ` · Termina: ${new Date(pause.endsAt).toLocaleString('pt-BR')}`}
            {!pause.endsAt && isActive && ' · Indefinida'}
          </p>
          {pause.errorMessage && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-2 py-1.5 text-xs text-danger-bright">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {pause.errorMessage}
            </div>
          )}
        </div>
      </div>
      {onCancel && isActive && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onCancel}
          loading={cancelling}
          leftIcon={<Play className="h-3 w-3" />}
        >
          Reabrir agora
        </Button>
      )}
      {!isActive && pause.cancelledAt && (
        <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
          <X className="h-3 w-3" />
          {new Date(pause.cancelledAt).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      )}
    </li>
  );
}
