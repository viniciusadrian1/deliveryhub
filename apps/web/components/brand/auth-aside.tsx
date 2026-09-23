import { Logo } from './logo';
import { Layers, CheckCircle2, Clock } from 'lucide-react';

interface AuthAsideProps {
  subtitle?: string;
}

export function AuthAside({ subtitle }: AuthAsideProps) {
  return (
    <aside className="hidden flex-col justify-between border-r border-surface-border-subtle bg-surface-raised p-12 lg:flex lg:w-[480px]">
      <div>
        <Logo size={42} />
      </div>

      <div className="space-y-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border-subtle bg-surface-base px-3 py-1 text-xs font-medium text-ink-secondary">
            <Layers className="h-3.5 w-3.5 text-brand-500" />
            Software Operacional
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-ink-primary">
            Centralização de ponta a ponta na sua operação.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            {subtitle ??
              'Gerencie pedidos, produtos e integrações em um único lugar, com mais velocidade e sem conflitos de cardápio.'}
          </p>
        </div>

        {/* Card Operacional Realista */}
        <div className="rounded-xl border border-surface-border-subtle bg-surface-base p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-surface-border-subtle pb-3">
            <span className="text-xs font-semibold text-ink-primary">Status da Operação</span>
            <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-500">
              Painel Integrado
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-surface-raised p-3 text-xs">
              <span className="flex items-center gap-2 text-ink-secondary">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Canais de venda conectados
              </span>
              <span className="font-semibold text-ink-primary">Sincronizados</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-raised p-3 text-xs">
              <span className="flex items-center gap-2 text-ink-secondary">
                <Clock className="h-4 w-4 text-brand-500" />
                Tempo médio de resposta
              </span>
              <span className="font-semibold text-ink-primary">Em tempo real</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-tertiary">
        DeliveryHub: Tecnologia e controle para restaurantes
      </p>
    </aside>
  );
}
