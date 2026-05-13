'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../lib/api';
import { formatCents } from '../../lib/format';
import type { MenuItemSummary, PlatformConfig } from '../../lib/menu-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  item: MenuItemSummary;
}

export function PlatformConfigDialog({ open, onClose, storeId, item }: Props) {
  const qc = useQueryClient();
  const [priceByPlatform, setPriceByPlatform] = useState<Record<string, string>>({});
  const [availByPlatform, setAvailByPlatform] = useState<Record<string, boolean>>({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['item-platforms', item.id],
    queryFn: () => api<PlatformConfig[]>(`/menu/items/${item.id}/platforms`),
    enabled: open,
  });

  useEffect(() => {
    if (!configs.length) return;
    const p: Record<string, string> = {};
    const a: Record<string, boolean> = {};
    for (const c of configs) {
      p[c.platform.code] = (c.sellingPriceCents / 100).toFixed(2);
      a[c.platform.code] = c.isAvailable;
    }
    setPriceByPlatform(p);
    setAvailByPlatform(a);
  }, [configs]);

  const save = useMutation({
    mutationFn: async (platformCode: string) => {
      const cents = Math.round(
        parseFloat((priceByPlatform[platformCode] ?? '0').replace(',', '.')) * 100,
      );
      return api(`/menu/items/${item.id}/platforms/${platformCode}`, {
        method: 'PUT',
        body: {
          sellingPriceCents: cents,
          isAvailable: availByPlatform[platformCode] ?? true,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['item-platforms', item.id] });
      void qc.invalidateQueries({ queryKey: ['menu', storeId] });
    },
  });

  const syncPrice = useMutation({
    mutationFn: async (platformCode: string) => {
      return api(`/menu/items/${item.id}/platforms/${platformCode}/sync-price`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['item-platforms', item.id] });
    },
  });

  const marginForPlatform = useMemo(() => {
    return (cfg: PlatformConfig) => {
      const price = cfg.sellingPriceCents;
      if (price === 0) return null;
      // breakdown simples — visualização, não substitui /api/pricing
      const margin = price - item.costCents;
      const pct = (margin / price) * 100;
      return { marginCents: margin, marginPct: pct };
    };
  }, [item.costCents]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`"${item.name}" por plataforma`}
      description={`CMV: ${formatCents(item.costCents)}`}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-ink-tertiary">Carregando…</p>}
      {!isLoading && configs.length === 0 && (
        <p className="rounded-md border border-surface-border-subtle bg-surface-base px-4 py-3 text-sm text-ink-secondary">
          Este item ainda não tem configuração em nenhuma plataforma. Faça a{' '}
          <b>sincronização inicial</b> em Integrações para importar do iFood, ou
          publique-o manualmente:
        </p>
      )}

      <div className="mt-2 space-y-3">
        {configs.map((cfg) => {
          const m = marginForPlatform(cfg);
          return (
            <div
              key={cfg.id}
              className="rounded-lg border border-surface-border-subtle bg-surface-raised p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color={cfg.platform.colorHex}>{cfg.platform.name}</Badge>
                  {cfg.externalId && (
                    <span className="font-mono text-xs text-ink-tertiary">
                      ext:{cfg.externalId.slice(0, 12)}
                    </span>
                  )}
                </div>
                {cfg.lastSyncError && (
                  <span className="text-xs text-danger-bright">
                    erro: {cfg.lastSyncError.slice(0, 40)}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 items-end">
                <Input
                  label="Preço (R$)"
                  value={priceByPlatform[cfg.platform.code] ?? ''}
                  onChange={(e) =>
                    setPriceByPlatform((p) => ({
                      ...p,
                      [cfg.platform.code]: e.target.value,
                    }))
                  }
                  inputMode="decimal"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={availByPlatform[cfg.platform.code] ?? true}
                    onChange={(e) =>
                      setAvailByPlatform((a) => ({
                        ...a,
                        [cfg.platform.code]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Disponível
                </label>
                <div className="text-right">
                  {m && (
                    <p
                      className={
                        m.marginPct >= 35
                          ? 'text-success-bright'
                          : m.marginPct >= 20
                            ? 'text-warning-bright'
                            : 'text-danger-bright'
                      }
                    >
                      Margem (bruta){' '}
                      <b>{m.marginPct.toFixed(1)}%</b> · {formatCents(m.marginCents)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => save.mutate(cfg.platform.code)}
                  disabled={save.isPending}
                >
                  Salvar local
                </Button>
                <Button
                  size="sm"
                  onClick={() => syncPrice.mutate(cfg.platform.code)}
                  disabled={syncPrice.isPending || !cfg.externalId}
                  title={cfg.externalId ? '' : 'Item ainda não sincronizado com a plataforma'}
                >
                  Sincronizar preço →
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
