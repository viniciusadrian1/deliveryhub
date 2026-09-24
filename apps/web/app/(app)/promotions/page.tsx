'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  BadgePercent,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { PlatformLogo } from '../../../components/ui/platform-logo';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { PLATFORM_META, type PlatformConnection } from '../../../lib/integrations-types';
import type { MenuItemSummary } from '../../../lib/menu-types';

interface Promotion {
  id: string;
  name: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  status: 'processing' | 'active' | 'error';
  lastError: string | null;
  lastCheckedAt: string | null;
  items: Array<{ menuItemId: string; externalId: string; name: string }>;
  platform: { code: string; name: string; colorHex: string };
  createdAt: string;
}

const STATUS_META: Record<
  Promotion['status'],
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  processing: { label: 'Em processamento', variant: 'warning' },
  active: { label: 'Ativa na plataforma', variant: 'success' },
  error: { label: 'Erro de ativação', variant: 'danger' },
};

function humanizeErrorMessage(err: unknown): string {
  const body = (err as { body?: { message?: string } })?.body;
  const raw = body?.message ?? (err instanceof Error ? err.message : 'Erro ao processar');
  if (raw.startsWith('items_not_published_on_platform')) {
    return 'Os produtos selecionados precisam estar previamente publicados no cardápio desta plataforma antes de receberem a promoção.';
  }
  if (raw === 'no_active_connection') {
    return 'A conexão com esta plataforma não está ativa no momento. Verifique na aba Integrações.';
  }
  if (raw === 'promotion_unsupported') {
    return 'Esta plataforma não permite criação de promoções automatizadas via integração.';
  }
  return raw;
}

export default function PromotionsPage() {
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'processing' | 'error'>('all');
  const [search, setSearch] = useState('');

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions', storeId],
    queryFn: () => api<Promotion[]>(`/promotions?storeId=${storeId}`),
    enabled: !!storeId,
  });

  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchItem = p.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchName && !matchItem) return false;
      }
      return true;
    });
  }, [promotions, statusFilter, search]);

  if (!storeId) return null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Promoções &amp; Campanhas</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Crie campanhas de desconto percentual sincronizadas diretamente com os aplicativos de delivery conectados.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Nova promoção
        </Button>
      </header>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-surface-border bg-surface-base p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={clsx(
              'rounded-md px-3 py-1 font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-surface-raised text-ink-primary shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            Todas ({promotions.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={clsx(
              'rounded-md px-3 py-1 font-medium transition-colors',
              statusFilter === 'active'
                ? 'bg-surface-raised text-success-bright shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            Ativas ({promotions.filter((p) => p.status === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('processing')}
            className={clsx(
              'rounded-md px-3 py-1 font-medium transition-colors',
              statusFilter === 'processing'
                ? 'bg-surface-raised text-warning-bright shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            Em processamento ({promotions.filter((p) => p.status === 'processing').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('error')}
            className={clsx(
              'rounded-md px-3 py-1 font-medium transition-colors',
              statusFilter === 'error'
                ? 'bg-surface-raised text-danger-bright shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            Erros ({promotions.filter((p) => p.status === 'error').length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Buscar por campanha ou item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-64 rounded-lg border border-surface-border bg-surface-base pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="surface-card px-5 py-8 text-center text-sm text-ink-tertiary">
          Carregando promoções…
        </p>
      ) : filteredPromotions.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title={promotions.length === 0 ? 'Nenhuma promoção cadastrada' : 'Nenhuma promoção encontrada no filtro'}
          description={
            promotions.length === 0
              ? 'Crie campanhas com descontos percentuais para impulsionar suas vendas nos canais de delivery.'
              : 'Tente alterar os termos da busca ou selecione outro status de filtro.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPromotions.map((p) => (
            <PromotionCard key={p.id} promotion={p} storeId={storeId} />
          ))}
        </div>
      )}

      {open && <CreatePromotionDialog storeId={storeId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PromotionCard({ promotion, storeId }: { promotion: Promotion; storeId: string }) {
  const qc = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = useMutation({
    mutationFn: () => api(`/promotions/${promotion.id}/refresh`, { method: 'POST' }),
    onMutate: () => setRefreshError(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['promotions', storeId] }),
    onError: (err) => setRefreshError(humanizeErrorMessage(err)),
  });

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const parts = iso.slice(0, 10).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  const meta = STATUS_META[promotion.status];

  return (
    <div className="surface-card flex flex-col justify-between p-5 transition-all hover:border-surface-border">
      <div className="space-y-3">
        {/* Topo do Card */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlatformLogo platform={promotion.platform.code} size="xs" />
            <span className="text-xs font-semibold text-ink-secondary">
              {promotion.platform.name}
            </span>
          </div>
          <Badge variant={meta.variant} dot>
            {meta.label}
          </Badge>
        </div>

        {/* Título e Desconto */}
        <div>
          <h3 className="text-base font-bold text-ink-primary leading-tight">
            {promotion.name}
          </h3>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-bold text-brand-400">
            <Tag className="h-3 w-3" />
            {promotion.discountPercent}% de desconto
          </div>
        </div>

        {/* Vigência */}
        <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <Calendar className="h-3.5 w-3.5 text-ink-tertiary" />
          <span>{fmtDate(promotion.startsAt)}</span>
          <span className="text-ink-tertiary">até</span>
          <span>{fmtDate(promotion.endsAt)}</span>
        </div>

        {/* Itens contemplados */}
        <div className="rounded-lg border border-surface-border-subtle bg-surface-base/50 p-2 text-xs">
          <p className="font-semibold text-ink-tertiary">
            {promotion.items.length} {promotion.items.length === 1 ? 'produto incluso' : 'produtos inclusos'}:
          </p>
          <p className="mt-0.5 line-clamp-2 text-ink-secondary">
            {promotion.items.map((i) => i.name).join(', ')}
          </p>
        </div>

        {/* Mensagens de erro */}
        {promotion.lastError && (
          <div className="flex items-start gap-1.5 rounded-md border border-danger/30 bg-danger-soft p-2 text-xs text-danger-bright">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{humanizeErrorMessage(promotion.lastError)}</span>
          </div>
        )}
        {refreshError && (
          <div className="flex items-start gap-1.5 rounded-md border border-danger/30 bg-danger-soft p-2 text-xs text-danger-bright">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{refreshError}</span>
          </div>
        )}
      </div>

      {/* Rodapé com Ação de Atualização */}
      <div className="mt-4 flex items-center justify-between border-t border-surface-border-subtle pt-3">
        <span className="text-[11px] text-ink-tertiary">
          {promotion.lastCheckedAt
            ? `Verificado há instantes`
            : `Criada em ${fmtDate(promotion.createdAt)}`}
        </span>

        <Button
          size="xs"
          variant="secondary"
          onClick={() => refresh.mutate()}
          loading={refresh.isPending}
          leftIcon={<RefreshCw className="h-3 w-3" />}
        >
          Sincronizar status
        </Button>
      </div>
    </div>
  );
}

function CreatePromotionDialog({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [platformCodes, setPlatformCodes] = useState<Set<string>>(new Set(['ifood']));
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState('10');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Consulta de conexões ativas
  const { data: connections = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<PlatformConnection[]>('/integrations/connections'),
    enabled: !!storeId,
  });

  const activeConnections = connections.filter((c) => c.status === 'active');

  const { data: items = [] } = useQuery({
    queryKey: ['menu', storeId, 'items'],
    queryFn: () => api<MenuItemSummary[]>(`/menu/items?storeId=${storeId}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/promotions', {
        method: 'POST',
        body: {
          storeId,
          platformCodes: [...platformCodes],
          name,
          discountPercent: parseInt(discount, 10),
          startsAt,
          endsAt,
          menuItemIds: [...selected],
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['promotions', storeId] });
      onClose();
    },
    onError: (err) => setError(humanizeErrorMessage(err)),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const valid =
    platformCodes.size > 0 &&
    name.trim().length > 0 &&
    selected.size > 0 &&
    startsAt !== '' &&
    endsAt !== '' &&
    parseInt(discount, 10) >= 1 &&
    parseInt(discount, 10) <= 70;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Nova Campanha Promocional"
      description="Cadastre um desconto para itens publicados e sincronize diretamente com a plataforma selecionada."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending} loading={create.isPending}>
            Criar e sincronizar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Seletor de Plataforma */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Plataforma de Delivery
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeConnections.length === 0 ? (
              <p className="col-span-full rounded-md border border-warning/30 bg-warning-soft p-2.5 text-xs text-warning-bright">
                Nenhuma conexão ativa encontrada. Acesse Integrações para conectar seu restaurante.
              </p>
            ) : (
              activeConnections.map((c) => {
                const active = platformCodes.has(c.platformCode);
                return (
                  <button
                    key={c.platformCode}
                    type="button"
                    onClick={() => setPlatformCodes((current) => {
                      const next = new Set(current);
                      if (next.has(c.platformCode)) next.delete(c.platformCode);
                      else next.add(c.platformCode);
                      return next;
                    })}
                    className={clsx(
                      'flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all',
                      active
                        ? 'border-brand-500 bg-brand-500/10 shadow-sm'
                        : 'border-surface-border bg-surface-base hover:border-surface-border-strong',
                    )}
                  >
                    <PlatformLogo platform={c.platformCode} size="xs" />
                    <span className="text-xs font-semibold text-ink-primary">
                      {PLATFORM_META[c.platformCode]?.name ?? c.platformCode}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <p className="text-xs text-ink-tertiary">Selecione uma ou mais plataformas para publicar a mesma campanha em todos os canais escolhidos.</p>

        {/* Nome da Campanha */}
        <Input
          label="Nome da campanha"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Semana do Hambúrguer, Combo Casal com Desconto"
        />

        {/* Desconto e Vigência */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Desconto (%)"
            value={discount}
            onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            hint="Permitido entre 1% e 70%"
          />
          <Input
            label="Data de início"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <Input
            label="Data de término"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>

        {/* Seleção de Produtos */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Produtos participantes ({selected.size} selecionado{selected.size === 1 ? '' : 's'})
            </p>
            <span className="text-[11px] text-ink-tertiary">
              Apenas itens publicados no canal são aceitos
            </span>
          </div>

          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-surface-border p-2 bg-surface-base/40">
            {items
              .filter((it) => !it.archivedAt)
              .map((it) => (
                <label
                  key={it.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs hover:bg-surface-raised transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4 rounded border-surface-border text-brand-500"
                  />
                  <span className="font-medium text-ink-primary">{it.name}</span>
                </label>
              ))}
            {items.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-ink-tertiary">
                Nenhum produto cadastrado no cardápio.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-bright">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
