'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
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
import { PlatformLogo } from '../../../components/ui/platform-logo';
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
  platforms?: Array<{ id: string; code: string; name: string }>;
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

interface StatusValidation {
  id: string;
  state?: string;
  message?: string;
}

interface MerchantStatus {
  operation?: string;
  available: boolean;
  state?: string;
  validations: StatusValidation[];
  message?: string;
}

interface StoreStatusEntry {
  platform: string;
  supported: boolean;
  error?: string;
  statuses: MerchantStatus[];
}

const REASON_LABEL: Record<string, string> = {
  kitchen_overloaded: 'Cozinha sobrecarregada / Alta demanda',
  end_of_shift: 'Fim de expediente',
  out_of_stock: 'Falta momentânea de insumo',
  maintenance: 'Manutenção ou limpeza no restaurante',
  scheduled: 'Pausa programada',
  other: 'Outro motivo operacional',
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

  const {
    data: storeStatus = [],
    isFetching: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['pauses', 'store-status', storeId],
    queryFn: () =>
      api<StoreStatusEntry[]>(
        `/pauses/store-status?storeId=${encodeURIComponent(storeId ?? '')}`,
      ),
    enabled: !!storeId,
    refetchInterval: 60_000,
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
      setSelectedPlatforms([]);
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => api(`/pauses/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pauses'] }),
  });

  const activeConnections = connections.filter((c) => c.status === 'active');
  const activePlatformNames = Array.from(
    new Set(
      active.flatMap((pause) =>
        (pause.platforms ?? []).map((platform) => platform.name),
      ),
    ),
  );
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
        description="Selecione ou configure uma loja nas configurações."
      />
    );
  }

  const isOpen = active.length === 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Controle de Disponibilidade &amp; Pausa</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Pause temporariamente o recebimento de novos pedidos em uma ou todas as plataformas integradas com reabertura programada.
          </p>
        </div>
      </header>

      {/* Banner de Status Principal */}
      <section
        className={clsx(
          'surface-card relative overflow-hidden p-6 border',
          isOpen ? 'border-success/30' : 'border-warning/30',
        )}
      >
        <div
          className={clsx(
            'pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-15 blur-3xl',
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
                <CircleDot className="h-7 w-7 animate-pulse" />
              ) : (
                <PauseCircle className="h-7 w-7" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">
                Status Operacional da Loja
              </p>
              <p
                className={clsx(
                  'text-xl font-extrabold',
                  isOpen ? 'text-success-bright' : 'text-warning-bright',
                )}
              >
                {isOpen
                  ? 'Aberta e operando em todos os canais conectados'
                  : `${active.length} ${active.length === 1 ? 'pausa ativa' : 'pausas ativas'}`}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                {isOpen
                  ? `${activeConnections.length} ${activeConnections.length === 1 ? 'plataforma conectada' : 'plataformas conectadas'} recebendo pedidos normalmente`
                  : 'O recebimento de pedidos está suspenso temporariamente nos canais selecionados'}
              </p>
              {!isOpen && activePlatformNames.length > 0 && (
                <p className="mt-1 text-xs font-medium text-warning-bright">
                  Plataformas pausadas: {activePlatformNames.join(', ')}
                </p>
              )}
            </div>
          </div>

          <Button
            size="lg"
            variant={isOpen ? 'primary' : 'secondary'}
            onClick={() => setOpen(true)}
            leftIcon={<PauseCircle className="h-4 w-4" />}
          >
            Pausar recebimento
          </Button>
        </div>
      </section>

      {/* Grid com Status da Loja por Plataforma */}
      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b border-surface-border-subtle px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-ink-primary">
              Status de Conexão por Plataforma
            </h2>
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => void refetchStatus()}
            loading={statusLoading}
            leftIcon={<RotateCcw className="h-3 w-3" />}
          >
            Sincronizar status
          </Button>
        </header>

        {storeStatus.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-tertiary">
            Nenhuma plataforma conectada no momento.
          </p>
        ) : (
          <div className="divide-y divide-surface-border-subtle">
            {storeStatus.map((entry) => {
              const meta = PLATFORM_META[entry.platform];
              const op = entry.statuses[0];
              const available = op?.available ?? false;

              return (
                <div key={entry.platform} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <PlatformLogo platform={entry.platform} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-ink-primary">
                        {meta?.name ?? entry.platform}
                      </p>
                      {op?.message ? (
                        <p className="text-xs text-ink-secondary">{op.message}</p>
                      ) : (
                        <p className="text-xs text-ink-tertiary">Canal integrado</p>
                      )}
                    </div>
                  </div>

                  <div>
                    {!entry.supported ? (
                      <Badge variant="neutral">Status indisponível</Badge>
                    ) : entry.error ? (
                      <Badge variant="danger" dot>Erro na plataforma</Badge>
                    ) : available ? (
                      <Badge variant="success" dot>Online e disponível</Badge>
                    ) : (
                      <Badge variant="warning" dot>Pausada / Fechada</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pausas Ativas */}
      {active.length > 0 && (
        <section className="surface-card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-surface-border-subtle px-5 py-3">
            <PauseCircle className="h-4 w-4 text-warning-bright" />
            <h2 className="text-sm font-semibold text-ink-primary">Pausas em Andamento</h2>
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

      {/* Histórico de Pausas */}
      <section className="surface-card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-surface-border-subtle px-5 py-3">
          <RotateCcw className="h-4 w-4 text-ink-tertiary" />
          <h2 className="text-sm font-semibold text-ink-primary">Histórico Recente</h2>
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

      {/* Modal de Pausa */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Pausar Recebimento de Pedidos"
        description="A pausa será comunicada em tempo real para os canais de delivery selecionados."
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
          {/* Seleção de Plataformas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Plataformas afetadas
              </label>
              <span className="text-[11px] text-ink-tertiary">
                {selectedPlatforms.length === 0
                  ? `Todas as ${activeConnections.length} conectadas`
                  : `${selectedPlatforms.length} selecionada(s)`}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeConnections.length === 0 ? (
                <p className="text-xs text-danger-bright">
                  Nenhuma plataforma ativa encontrada. Conecte em Integrações primeiro.
                </p>
              ) : (
                activeConnections.map((c) => {
                  const meta = PLATFORM_META[c.platformCode];
                  const selected = selectedPlatforms.includes(c.platformCode);
                  return (
                    <button
                      key={c.platformCode}
                      type="button"
                      onClick={() => togglePlatform(c.platformCode)}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
                        selected
                          ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-sm'
                          : 'border-surface-border bg-surface-base text-ink-secondary hover:border-surface-border-strong hover:text-ink-primary',
                      )}
                    >
                      <PlatformLogo platform={c.platformCode} size="xs" />
                      <span>{meta?.name ?? c.platformCode}</span>
                      {selected && <span className="text-brand-400">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Duração da Pausa */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Duração da pausa
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDuration(p.minutes)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                    duration === p.minutes
                      ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                      : 'border-surface-border bg-surface-base text-ink-secondary hover:border-surface-border-strong hover:text-ink-primary',
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo da Pausa */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Motivo operacional
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 rounded-lg border border-surface-border bg-surface-raised px-3 text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
            >
              {Object.entries(REASON_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Observação */}
          <Input
            label="Observação interna (opcional)"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Ex.: alta demanda de salão, reposição de estoque"
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

  const fmtDateTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
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
                Pausa ativa
              </Badge>
            ) : pause.cancelledAt ? (
              <Badge variant="neutral">Encerrada manualmente</Badge>
            ) : (
              <Badge variant="success">Reaberta</Badge>
            )}
            <p className="text-sm font-semibold text-ink-primary">
              {pause.scope === 'store' && 'Loja inteira'}
              {pause.scope === 'category' && `Categoria: ${pause.category?.name ?? '—'}`}
              {pause.scope === 'item' && `Produto: ${pause.menuItem?.name ?? '—'}`}
            </p>
            <span className="text-xs text-ink-secondary">
              · {REASON_LABEL[pause.reason] ?? pause.reason}
            </span>
          </div>

          {pause.reasonNote && (
            <p className="mt-0.5 text-xs italic text-ink-secondary">"{pause.reasonNote}"</p>
          )}

          <p className="mt-1 text-xs text-ink-tertiary">
            Início: {fmtDateTime(pause.startsAt)}
            {pause.endsAt && ` · Previsão de término: ${fmtDateTime(pause.endsAt)}`}
            {!pause.endsAt && isActive && ' · Sem previsão (manual)'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-tertiary">Canais:</span>
            {(pause.platforms ?? []).length > 0 ? pause.platforms?.map((platform) => (
              <span key={platform.id} className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-ink-secondary">
                <PlatformLogo platform={platform.code} size="xs" /> {platform.name}
              </span>
            )) : <span className="text-[11px] text-ink-secondary">Todos os canais conectados</span>}
          </div>

          {pause.errorMessage && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-xs text-danger-bright">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
          leftIcon={<Play className="h-3.5 w-3.5" />}
        >
          Reabrir agora
        </Button>
      )}

      {!isActive && pause.cancelledAt && (
        <span className="text-xs text-ink-tertiary">
          Reaberta às {fmtDateTime(pause.cancelledAt)}
        </span>
      )}
    </li>
  );
}
