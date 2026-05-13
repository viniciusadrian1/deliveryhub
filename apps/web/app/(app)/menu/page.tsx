'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CategoryFormDialog } from '../../../components/menu/category-form-dialog';
import { ItemFormDialog } from '../../../components/menu/item-form-dialog';
import { PlatformConfigDialog } from '../../../components/menu/platform-config-dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatCents } from '../../../lib/format';
import type { Category, MenuItemSummary } from '../../../lib/menu-types';

export default function MenuPage() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: MenuItemSummary | null }>({
    open: false,
    editing: null,
  });
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
    return <p className="text-sm text-zinc-500">Crie/selecione uma loja primeiro.</p>;
  }

  return (
    <div className="flex flex-col">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cardápio</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            CMV por item (custo) + preço de venda por plataforma. Margem real visível no
            simulador.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setCategoryDialog({ open: true, editing: null })}
          >
            + Categoria
          </Button>
          <Button onClick={() => setItemDialog({ open: true, editing: null })}>+ Item</Button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <h2 className="font-semibold">Sem itens ainda</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Crie itens manualmente, ou faça <b>sincronização inicial</b> na tela de Integrações
            para importar do iFood.
          </p>
        </div>
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
              className="rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <header className="flex items-center justify-between bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
                <div>
                  <h2 className="font-semibold">
                    {group.category?.name ?? 'Sem categoria'}{' '}
                    <span className="text-sm font-normal text-zinc-500">
                      ({group.items.length} {group.items.length === 1 ? 'item' : 'itens'})
                    </span>
                  </h2>
                  {group.category?.description && (
                    <p className="text-xs text-zinc-500">{group.category.description}</p>
                  )}
                </div>
                {group.category && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCategoryDialog({ open: true, editing: group.category! })}
                  >
                    editar
                  </Button>
                )}
              </header>

              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">CMV</th>
                    <th className="px-4 py-2 text-right">Tempo</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-zinc-500">{item.description}</div>
                        )}
                        {item.allergens.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.allergens.map((a) => (
                              <Badge key={a}>{a}</Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCents(item.costCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        {item.prepTimeMinutes ? `${item.prepTimeMinutes}min` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPlatformsForItem(item)}
                          >
                            plataformas
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setItemDialog({ open: true, editing: item })}
                          >
                            editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remover "${item.name}"?`)) deleteItem.mutate(item.id);
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
