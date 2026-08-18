'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
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

const STATUS_LABEL: Record<Promotion['status'], string> = {
  processing: 'Processando',
  active: 'Ativa',
  error: 'Erro',
};

const STATUS_CLASS: Record<Promotion['status'], string> = {
  processing: 'text-warning-bright',
  active: 'text-success-bright',
  error: 'text-danger-bright',
};

/** Erros da API vêm como `api_<status>`; a razão real fica no body. */
function apiErrorMessage(err: unknown): string {
  const body = (err as { body?: { message?: string } })?.body;
  const raw = body?.message ?? (err instanceof Error ? err.message : 'erro');
  if (raw.startsWith('items_not_published_on_platform')) {
    return 'Alguns itens selecionados ainda não foram publicados no iFood — publique-os no Cardápio (botão "Publicar item") antes de criar a promoção.';
  }
  if (raw === 'no_active_connection') return 'A conexão com a plataforma não está ativa.';
  if (raw === 'promotion_unsupported') return 'Esta plataforma não suporta promoções via API.';
  return raw;
}

export default function PromotionsPage() {
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;
  const [open, setOpen] = useState(false);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions', storeId],
    queryFn: () => api<Promotion[]>(`/promotions?storeId=${storeId}`),
    enabled: !!storeId,
  });

  if (!storeId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Promoções</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Descontos enviados direto pra plataforma (iFood). Processamento é
            assíncrono — use “Atualizar” pra conferir se ativou.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Nova promoção</Button>
      </div>

      {isLoading && <p className="text-sm text-ink-tertiary">Carregando…</p>}

      {!isLoading && promotions.length === 0 && (
        <EmptyState
          icon={BadgePercent}
          title="Nenhuma promoção ainda"
          description="Crie um desconto percentual pra itens já publicados na plataforma."
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {promotions.map((p) => (
          <PromotionCard key={p.id} promotion={p} storeId={storeId} />
        ))}
      </div>

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
    onError: (err) => setRefreshError(apiErrorMessage(err)),
  });

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge color={promotion.platform.colorHex}>{promotion.platform.name}</Badge>
            <span className={`text-xs font-semibold ${STATUS_CLASS[promotion.status]}`}>
              {STATUS_LABEL[promotion.status]}
            </span>
          </div>
          <h3 className="mt-2">{promotion.name}</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            <b>{promotion.discountPercent}%</b> de desconto · {fmt(promotion.startsAt)} →{' '}
            {fmt(promotion.endsAt)}
          </p>
          <p className="mt-1 text-xs text-ink-tertiary">
            {promotion.items.length}{' '}
            {promotion.items.length === 1 ? 'item' : 'itens'}:{' '}
            {promotion.items
              .slice(0, 3)
              .map((i) => i.name)
              .join(', ')}
            {promotion.items.length > 3 ? '…' : ''}
          </p>
          {promotion.lastError && (
            <p className="mt-1 text-xs text-danger-bright">erro: {promotion.lastError}</p>
          )}
          {refreshError && (
            <p className="mt-1 text-xs text-danger-bright">{refreshError}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          title="Consulta o status do processamento na plataforma"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}

function CreatePromotionDialog({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState('10');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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
          platformCode: 'ifood',
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
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const valid =
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
      title="Nova promoção"
      description="Desconto percentual aplicado na plataforma (iFood aceita 1–70%). Só itens já publicados entram."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? 'Enviando…' : 'Criar promoção'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nome da promoção"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Semana do burger"
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Desconto (%)"
            value={discount}
            onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
          />
          <Input
            label="Início"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <Input
            label="Fim"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-primary">
            Itens ({selected.size} selecionado{selected.size === 1 ? '' : 's'})
          </p>
          <p className="mb-1.5 text-xs text-ink-tertiary">
            Somente itens já publicados no iFood (Cardápio → Publicar item) são aceitos.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-surface-border-subtle p-2">
            {items
              .filter((it) => !it.archivedAt)
              .map((it) => (
                <label
                  key={it.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-base"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4"
                  />
                  {it.name}
                </label>
              ))}
            {items.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-ink-tertiary">Nenhum item no cardápio.</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-danger-bright">{error}</p>}
      </div>
    </Dialog>
  );
}
