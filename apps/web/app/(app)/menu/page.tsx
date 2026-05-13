'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { CategoryFormDialog } from '../../../components/menu/category-form-dialog';
import { ItemFormDialog } from '../../../components/menu/item-form-dialog';
import { PlatformConfigDialog } from '../../../components/menu/platform-config-dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';
import type { Category, MenuItemSummary } from '../../../lib/menu-types';

export default function MenuPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    editing: Category | null;
  }>({ open: false, editing: null });
  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    editing: MenuItemSummary | null;
  }>({ open: false, editing: null });
  const [platformsForItem, setPlatformsForItem] = useState<MenuItemSummary | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['menu', storeId, 'categories'],
    queryFn: () =>
      api<Category[]>(`/menu/categories?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu', storeId, 'items'],
    queryFn: () =>
      api<MenuItemSummary[]>(`/menu/items?storeId=${encodeURIComponent(storeId ?? '')}`),
    enabled: !!storeId,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => api(`/menu/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu', storeId] }),
  });

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItemSummary[]>();
    map.set('__uncat', []);
    for (const c of categories) map.set(c.id, []);
    for (const it of items) {
      const key = it.category?.id ?? '__uncat';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [categories, items]);

  if (!storeId) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Nenhuma loja configurada"
        description="Crie uma loja primeiro para gerenciar o cardápio."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Cardápio</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            CMV por item + preço por plataforma. A margem real fica visível no{' '}
            <b className="text-ink-primary">Simulador de Margem</b>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setCategoryDialog({ open: true, editing: null })}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Categoria
          </Button>
          <Button
            onClick={() => setItemDialog({ open: true, editing: null })}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Item
          </Button>
        </div>
      </header>

      {!isLoading && items.length === 0 && categories.length === 0 && (
        <EmptyState
          icon={UtensilsCrossed}
          title="Sem itens ainda"
          description="Crie categorias e itens, ou faça a sincronização inicial em Integrações para importar do iFood automaticamente."
          action={
            <Button
              onClick={() => setItemDialog({ open: true, editing: null })}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Criar primeiro item
            </Button>
          }
        />
      )}

      <div className="space-y-4">
        {[
          ...categories.map((c) => ({ category: c, items: itemsByCategory.get(c.id) ?? [] })),
          { category: null, items: itemsByCategory.get('__uncat') ?? [] },
        ]
          .filter((g) => g.items.length > 0 || g.category)
          .map((group) => (
            <section
              key={group.category?.id ?? '__uncat'}
              className="surface-card overflow-hidden"
            >
              <header className="flex items-center justify-between border-b border-surface-border-subtle px-5 py-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-ink-primary">
                    {group.category?.name ?? 'Sem categoria'}
                  </h2>
                  <Badge variant="neutral">
                    {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
                {group.category && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCategoryDialog({ open: true, editing: group.category! })
                    }
                    leftIcon={<Pencil className="h-3 w-3" />}
                  >
                    editar
                  </Button>
                )}
              </header>

              {group.items.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-tertiary">
                  Nenhum item nesta categoria.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border-subtle text-left text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                      <th className="px-5 py-2">Item</th>
                      <th className="px-5 py-2 text-right">CMV</th>
                      <th className="px-5 py-2 text-right">Tempo</th>
                      <th className="px-5 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-surface-border-subtle/60 transition-colors hover:bg-surface-overlay/40"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink-primary">{item.name}</div>
                          {item.description && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-ink-secondary">
                              {item.description}
                            </div>
                          )}
                          {item.allergens.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.allergens.map((a) => (
                                <Badge key={a} variant="warning">
                                  {a}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular text-ink-primary">
                          {formatCents(item.costCents)}
                        </td>
                        <td className="px-5 py-3 text-right text-ink-tertiary">
                          {item.prepTimeMinutes ? `${item.prepTimeMinutes}min` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPlatformsForItem(item)}
                              rightIcon={<ChevronRight className="h-3 w-3" />}
                              leftIcon={<Settings2 className="h-3 w-3" />}
                            >
                              plataformas
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setItemDialog({ open: true, editing: item })}
                              leftIcon={<Pencil className="h-3 w-3" />}
                            >
                              editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Remover "${item.name}"?`))
                                  deleteItem.mutate(item.id);
                              }}
                              leftIcon={<Trash2 className="h-3 w-3" />}
                            >
                              <span className="sr-only">remover</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
      </div>

      <CategoryFormDialog
        open={categoryDialog.open}
        editing={categoryDialog.editing}
        onClose={() => setCategoryDialog({ open: false, editing: null })}
        storeId={storeId}
      />
      <ItemFormDialog
        open={itemDialog.open}
        editing={itemDialog.editing}
        onClose={() => setItemDialog({ open: false, editing: null })}
        storeId={storeId}
        categories={categories}
      />
      {platformsForItem && (
        <PlatformConfigDialog
          open
          onClose={() => setPlatformsForItem(null)}
          storeId={storeId}
          item={platformsForItem}
        />
      )}
    </div>
  );
}
