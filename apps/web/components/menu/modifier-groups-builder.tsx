'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Box,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  PackageOpen,
  Plus,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { api } from '../../lib/api';
import { formatCents } from '../../lib/format';
import type {
  MenuItemSummary,
  ModifierGroupKind,
  ModifierGroupResponse,
  ModifierResponse,
} from '../../lib/menu-types';
import {
  MODIFIER_GROUP_KIND_DESCRIPTIONS,
  MODIFIER_GROUP_KIND_LABELS,
} from '../../lib/menu-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ModifierGroupsBuilderProps {
  menuItemId: string;
  storeId: string;
}

const KIND_ICONS: Record<ModifierGroupKind, LucideIcon> = {
  ingredients: PackageOpen,
  specifications: HelpCircle,
  cross_sell: Sparkles,
  disposables: UtensilsCrossed,
};

/**
 * Gerencia ModifierGroups de um MenuItem (estilo iFood).
 *
 * Fluxo:
 *  1. Lista grupos existentes (com seus modifiers) em accordions.
 *  2. "Adicionar grupo" abre um inline form de 3 passos consolidados:
 *     a. Escolher tipo (ingredients / specifications / cross_sell / disposables)
 *     b. Definir nome + obrigatório + min/max
 *     c. Adicionar complementos (novos ou linkando MenuItem existente)
 *  3. Editar grupo: clica em qualquer grupo e altera campos inline.
 *  4. Modifier dentro do grupo: nome + preço (delta) + (opcional) link pra
 *     MenuItem existente como reuso ("Copiar complemento" do iFood).
 *
 * Persistência: cria/atualiza grupo via POST/PATCH; cada modifier também.
 * O componente é fully controlled pelo servidor — cada save invalida a query.
 */
export function ModifierGroupsBuilder({
  menuItemId,
  storeId,
}: ModifierGroupsBuilderProps) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['modifier-groups', menuItemId],
    queryFn: () =>
      api<ModifierGroupResponse[]>(`/menu/items/${menuItemId}/modifier-groups`),
    enabled: !!menuItemId,
  });

  const { data: availableItems = [] } = useQuery({
    queryKey: ['menu', storeId, 'all'],
    queryFn: () => api<MenuItemSummary[]>(`/menu/items?storeId=${storeId}`),
    enabled: !!storeId,
  });

  const removeGroup = useMutation({
    mutationFn: (id: string) =>
      api(`/menu/modifier-groups/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['modifier-groups', menuItemId] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-primary">
          Grupos de complementos
        </h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAdding(true)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Adicionar grupo
        </Button>
      </div>

      {groups.length === 0 && !adding && (
        <p className="rounded-md border border-surface-border-subtle bg-surface-base px-3 py-4 text-center text-xs text-ink-tertiary">
          Sem grupos de complementos. Clientes amam — você vende mais.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {groups.map((g) => {
          const Icon = KIND_ICONS[g.kind];
          const isOpen = expanded === g.id;
          return (
            <li
              key={g.id}
              className="overflow-hidden rounded-lg border border-surface-border-subtle bg-surface-raised"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : g.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay/30"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-primary">{g.name}</p>
                    <span className="rounded-md bg-surface-base px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-tertiary">
                      {MODIFIER_GROUP_KIND_LABELS[g.kind]}
                    </span>
                    {g.required && (
                      <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-danger-bright">
                        obrigatório
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-tertiary">
                    {g.modifiers.length}{' '}
                    {g.modifiers.length === 1 ? 'complemento' : 'complementos'} ·
                    {' '}min {g.minSelect} / max {g.maxSelect}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-ink-tertiary" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-ink-tertiary" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-surface-border-subtle">
                  <ModifierListEditor
                    group={g}
                    availableItems={availableItems}
                    onChange={() =>
                      qc.invalidateQueries({
                        queryKey: ['modifier-groups', menuItemId],
                      })
                    }
                  />
                  <div className="flex justify-end gap-2 border-t border-surface-border-subtle bg-surface-base/30 px-4 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Apagar grupo "${g.name}"?`)) {
                          removeGroup.mutate(g.id);
                          setExpanded(null);
                        }
                      }}
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Apagar grupo
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <NewGroupForm
          menuItemId={menuItemId}
          onCancel={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            setExpanded(id);
            qc.invalidateQueries({ queryKey: ['modifier-groups', menuItemId] });
          }}
        />
      )}
    </div>
  );
}

// ===================================================================
// Sub: form de criação de novo grupo
// ===================================================================

function NewGroupForm({
  menuItemId,
  onCancel,
  onCreated,
}: {
  menuItemId: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<ModifierGroupKind | null>(null);
  const [name, setName] = useState('');
  const [required, setRequired] = useState(false);
  const [minSelect, setMinSelect] = useState(0);
  const [maxSelect, setMaxSelect] = useState(1);

  const create = useMutation({
    mutationFn: async () => {
      return api<{ id: string }>('/menu/modifier-groups', {
        method: 'POST',
        body: { menuItemId, kind, name, required, minSelect, maxSelect },
      });
    },
    onSuccess: (created) => onCreated(created.id),
  });

  if (!kind) {
    return (
      <div className="surface-card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ink-primary">
            Tipo de grupo
          </h4>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MODIFIER_GROUP_KIND_LABELS) as ModifierGroupKind[]).map(
            (k) => {
              const Icon = KIND_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="flex flex-col items-start gap-1.5 rounded-lg border border-surface-border-subtle bg-surface-raised p-3 text-left transition-all hover:border-brand-500/60"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-semibold text-ink-primary">
                    {MODIFIER_GROUP_KIND_LABELS[k]}
                  </p>
                  <p className="text-[11px] leading-relaxed text-ink-tertiary">
                    {MODIFIER_GROUP_KIND_DESCRIPTIONS[k]}
                  </p>
                </button>
              );
            },
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink-primary">
          Novo grupo · {MODIFIER_GROUP_KIND_LABELS[kind]}
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setKind(null)}>
          Voltar
        </Button>
      </div>

      <Input
        label="Nome do grupo"
        placeholder="Ex.: Escolha o molho"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
            Obrigatório?
          </label>
          <select
            value={required ? 'yes' : 'no'}
            onChange={(e) => setRequired(e.target.value === 'yes')}
            className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
          >
            <option value="no">Opcional</option>
            <option value="yes">Obrigatório</option>
          </select>
        </div>
        <NumberStepper label="Qtd mínima" value={minSelect} onChange={setMinSelect} min={0} max={50} />
        <NumberStepper
          label="Qtd máxima"
          value={maxSelect}
          onChange={(v) => setMaxSelect(Math.max(v, minSelect))}
          min={1}
          max={50}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!name.trim()}
        >
          Criar grupo
        </Button>
      </div>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
        {label}
      </label>
      <div className="flex h-11 items-center rounded-lg border border-surface-border bg-surface-raised">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-full px-3 text-ink-secondary hover:text-ink-primary"
          aria-label="Diminuir"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
          className="flex-1 bg-transparent text-center text-sm tabular outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-full px-3 text-ink-secondary hover:text-ink-primary"
          aria-label="Aumentar"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// Sub: editor da lista de modifiers dentro de um grupo
// ===================================================================

function ModifierListEditor({
  group,
  availableItems,
  onChange,
}: {
  group: ModifierGroupResponse;
  availableItems: MenuItemSummary[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const removeModifier = useMutation({
    mutationFn: (id: string) =>
      api(`/menu/modifiers/${id}`, { method: 'DELETE' }),
    onSuccess: () => onChange(),
  });

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {group.modifiers.length === 0 && (
        <p className="rounded-md bg-surface-base/40 px-3 py-2 text-xs text-ink-tertiary">
          Sem complementos. Adicione opções pro cliente escolher.
        </p>
      )}
      <ul className="divide-y divide-surface-border-subtle">
        {group.modifiers.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <div className="flex-1">
              <p className="text-sm text-ink-primary">{m.name}</p>
              {m.description && (
                <p className="text-[11px] text-ink-tertiary">{m.description}</p>
              )}
            </div>
            <span
              className={clsx(
                'tabular text-xs font-semibold',
                m.costDeltaCents > 0
                  ? 'text-brand-500'
                  : m.costDeltaCents < 0
                    ? 'text-success-bright'
                    : 'text-ink-tertiary',
              )}
            >
              {m.costDeltaCents === 0
                ? 'grátis'
                : (m.costDeltaCents > 0 ? '+' : '') + formatCents(m.costDeltaCents)}
            </span>
            {m.linkedMenuItemId && (
              <span
                className="rounded-md bg-info-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-info"
                title="Reutiliza um item existente do cardápio"
              >
                copiado
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remover "${m.name}"?`)) removeModifier.mutate(m.id);
              }}
              className="rounded-md p-1 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
              aria-label="Remover complemento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <NewModifierForm
          groupId={group.id}
          availableItems={availableItems}
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            onChange();
          }}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAdding(true)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          className="self-start"
        >
          Complemento
        </Button>
      )}
    </div>
  );
}

function NewModifierForm({
  groupId,
  availableItems,
  onCancel,
  onCreated,
}: {
  groupId: string;
  availableItems: MenuItemSummary[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<'new' | 'link'>('new');
  const [name, setName] = useState('');
  const [priceReais, setPriceReais] = useState('');
  const [linkedMenuItemId, setLinkedMenuItemId] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const linked = availableItems.find((i) => i.id === linkedMenuItemId);
      const finalName = mode === 'link' && linked ? linked.name : name;
      const cents = Math.round(parseFloat(priceReais.replace(',', '.')) * 100) || 0;
      return api<ModifierResponse>('/menu/modifiers', {
        method: 'POST',
        body: {
          modifierGroupId: groupId,
          name: finalName,
          costDeltaCents: cents,
          linkedMenuItemId: mode === 'link' ? (linkedMenuItemId || null) : null,
        },
      });
    },
    onSuccess: () => onCreated(),
  });

  return (
    <div className="rounded-lg border border-surface-border-subtle bg-surface-base/30 p-3">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('new')}
          className={clsx(
            'flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold',
            mode === 'new'
              ? 'border-brand-500 bg-brand-500/10 text-brand-500'
              : 'border-surface-border-subtle text-ink-secondary',
          )}
        >
          <Box className="mr-1 inline h-3 w-3" /> Novo complemento
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={clsx(
            'flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold',
            mode === 'link'
              ? 'border-brand-500 bg-brand-500/10 text-brand-500'
              : 'border-surface-border-subtle text-ink-secondary',
          )}
        >
          Reusar item existente
        </button>
      </div>

      {mode === 'new' ? (
        <div className="grid grid-cols-2 gap-2">
          <Input label="Nome" placeholder="Ex.: Cheddar extra" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Preço (R$)"
            placeholder="0,00"
            value={priceReais}
            onChange={(e) => setPriceReais(e.target.value)}
            inputMode="decimal"
            hint="Use 0 pra grátis; pode ser negativo (desconto)."
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
              Item existente
            </label>
            <select
              value={linkedMenuItemId}
              onChange={(e) => setLinkedMenuItemId(e.target.value)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
            >
              <option value="">— selecione —</option>
              {availableItems
                .filter((i) => !i.archivedAt && i.productKind === 'single')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </div>
          <Input
            label="Preço aqui (R$)"
            placeholder="Vazio = preço do item"
            value={priceReais}
            onChange={(e) => setPriceReais(e.target.value)}
            inputMode="decimal"
            hint="Sobrescreve o preço quando vendido como complemento."
          />
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={mode === 'new' ? !name.trim() : !linkedMenuItemId}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
