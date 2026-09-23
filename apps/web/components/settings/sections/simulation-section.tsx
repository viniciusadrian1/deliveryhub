'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  ArrowRight,
  ChefHat,
  CheckCircle2,
  ExternalLink,
  Layers,
  LayoutGrid,
  PlayCircle,
  PlusCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '../../ui/button';
import { PlatformLogo } from '../../ui/platform-logo';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { SettingsSection } from '../section';

interface PlatformOption {
  code: string;
  name: string;
  color: string;
  feeDesc: string;
}

const SUPPORTED_PLATFORMS: PlatformOption[] = [
  { code: 'ifood', name: 'iFood', color: '#EA1D2C', feeDesc: '12% comissão + 3% taxa' },
  { code: 'keeta', name: 'Keeta', color: '#FFCC00', feeDesc: '10% comissão + 2.5% taxa' },
  { code: '99food', name: '99Food', color: '#FE3324', feeDesc: '12% comissão + 3% taxa' },
  { code: 'rappi', name: 'Rappi', color: '#FF441F', feeDesc: '14% comissão + 3.2% taxa' },
  { code: 'aiqfome', name: 'AiQfome', color: '#E2231A', feeDesc: '12% comissão + 2.8% taxa' },
];

export function SimulationSection() {
  const qc = useQueryClient();
  const { state } = useAuth();
  const storeId = state?.storeId ?? null;

  const [lastFeedback, setLastFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [cooldown, setCooldown] = useState(false);

  // Consulta de conexões ativas na loja
  const { data: connections = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<Array<{ platformCode: string; status: string }>>('/integrations/connections'),
    enabled: !!storeId,
  });

  const activeCodes = new Set(
    connections.filter((c) => c.status === 'active').map((c) => c.platformCode),
  );

  const simulateMutation = useMutation({
    mutationFn: async (opts?: { platformCode?: string; allIntegrated?: boolean }) => {
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      return api<{ simulated?: number; order?: { id: string } }>('/orders/simulate', {
        method: 'POST',
        body: {
          storeId,
          platformCode: opts?.platformCode,
          allIntegrated: opts?.allIntegrated,
        },
      });
    },
    onSuccess: (res, variables) => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['fin'] });
      void qc.invalidateQueries({ queryKey: ['kds-orders'] });

      if (variables?.allIntegrated) {
        setLastFeedback({
          type: 'success',
          message: `${res.simulated ?? 'Todos os'} pedidos gerados com sucesso nas plataformas integradas!`,
        });
      } else if (variables?.platformCode) {
        const plat = SUPPORTED_PLATFORMS.find((p) => p.code === variables.platformCode);
        setLastFeedback({
          type: 'success',
          message: `Pedido simulado no ${plat?.name ?? variables.platformCode} enviado com sucesso!`,
        });
      } else {
        setLastFeedback({
          type: 'success',
          message: 'Pedido simulado com sucesso (alternância automática)!',
        });
      }
    },
    onError: (err: any) => {
      setCooldown(false);
      setLastFeedback({
        type: 'error',
        message: err?.message || 'Falha ao simular pedido. Verifique se há uma loja ativa.',
      });
    },
  });

  const clearSimulatedMutation = useMutation({
    mutationFn: async () => api('/orders/clear-simulated', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['fin'] });
      void qc.invalidateQueries({ queryKey: ['kds-orders'] });
      setLastFeedback({
        type: 'success',
        message: 'Todos os pedidos simulados de teste foram removidos do sistema.',
      });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Simulador de Pedidos & Ambiente de Testes"
        description="Gere pedidos fictícios para testar e validar em tempo real o fluxo no Hub de Pedidos, no KDS Cozinha e no painel Financeiro."
      >
        <div className="space-y-6">
          {/* Feedback temporário */}
          {lastFeedback && (
            <div
              className={clsx(
                'flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-medium',
                lastFeedback.type === 'success'
                  ? 'border-success/30 bg-success-soft text-success-bright'
                  : 'border-danger/30 bg-danger-soft text-danger-bright',
              )}
            >
              {lastFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{lastFeedback.message}</span>
            </div>
          )}

          {/* Cards de Ação Rápida */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Simular Automático */}
            <div className="surface-card flex flex-col justify-between rounded-xl border border-surface-border p-4 transition-all hover:border-brand-500/50">
              <div>
                <div className="flex items-center gap-2 text-brand-400">
                  <PlayCircle className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-ink-primary">
                    Simular Pedido Avulso
                  </h3>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">
                  Gera 1 pedido aleatório alternando entre as plataformas integradas à sua loja.
                </p>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => simulateMutation.mutate({})}
                  loading={simulateMutation.isPending && !simulateMutation.variables?.allIntegrated && !simulateMutation.variables?.platformCode}
                  disabled={cooldown || simulateMutation.isPending}
                  leftIcon={<PlusCircle className="h-4 w-4" />}
                >
                  Gerar pedido teste
                </Button>
              </div>
            </div>

            {/* Simular Todas as Integradas */}
            <div className="surface-card flex flex-col justify-between rounded-xl border border-surface-border p-4 transition-all hover:border-brand-500/50">
              <div>
                <div className="flex items-center gap-2 text-brand-400">
                  <Layers className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-ink-primary">
                    Simular em Todas as Conectadas
                  </h3>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">
                  Gera simultaneamente 1 pedido de teste para cada canal com conexão ativa.
                </p>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => simulateMutation.mutate({ allIntegrated: true })}
                  loading={simulateMutation.isPending && simulateMutation.variables?.allIntegrated === true}
                  disabled={cooldown || simulateMutation.isPending}
                  leftIcon={<Sparkles className="h-4 w-4 text-brand-400" />}
                >
                  Simular todas de uma vez
                </Button>
              </div>
            </div>
          </div>

          {/* Seleção por Plataforma Específica */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Ou simular por plataforma específica
            </h3>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Dispare um pedido exatamente na plataforma desejada para conferir comissão e formatação.
            </p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {SUPPORTED_PLATFORMS.map((plat) => {
                const isConnected = activeCodes.has(plat.code);
                const isCurrentPending =
                  simulateMutation.isPending &&
                  simulateMutation.variables?.platformCode === plat.code;

                return (
                  <div
                    key={plat.code}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border-subtle bg-surface-base/60 p-3 transition-colors hover:border-surface-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlatformLogo platform={plat.code} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-ink-primary truncate">
                            {plat.name}
                          </p>
                          {isConnected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-success-bright" title="Conexão ativa" />
                          )}
                        </div>
                        <p className="text-[10px] text-ink-tertiary truncate">
                          {plat.feeDesc}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => simulateMutation.mutate({ platformCode: plat.code })}
                      loading={isCurrentPending}
                      disabled={cooldown || simulateMutation.isPending}
                    >
                      Testar
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Atalhos para visualização e Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border-subtle pt-4">
            <div className="flex items-center gap-2">
              <Link
                href="/hub"
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:bg-surface-overlay"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-brand-400" />
                Ver pedidos no Hub
                <ArrowRight className="h-3 w-3 text-ink-tertiary" />
              </Link>
              <Link
                href="/kds"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:bg-surface-overlay"
              >
                <ChefHat className="h-3.5 w-3.5 text-brand-400" />
                Abrir KDS Cozinha
                <ExternalLink className="h-3 w-3 text-ink-tertiary" />
              </Link>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('Deseja excluir todos os pedidos simulados (de teste) do sistema?')) {
                  clearSimulatedMutation.mutate();
                }
              }}
              loading={clearSimulatedMutation.isPending}
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-ink-tertiary hover:text-danger-bright" />}
              className="text-xs text-ink-secondary hover:text-danger-bright"
            >
              Limpar pedidos de teste
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
