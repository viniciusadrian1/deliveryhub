import { Check } from 'lucide-react';

export function AuthProductPreview() {
  return (
    <div className="flex flex-col justify-center pr-2 xl:pr-6">
      {/* Mensagem simples e humana, sem jargões de IA */}
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
          Operação Delivery
        </span>
        <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary leading-tight">
          Fila de pedidos em tempo real
        </h1>
        <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
          Receba pedidos do iFood, 99Food e Rappi em uma única tela e envie direto para a cozinha.
        </p>
      </div>

      {/* Janela de Demonstração Limpa e Bem Alinhada */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-lg">
        {/* Barra superior discreta */}
        <div className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-base/80 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" aria-hidden="true" />
            <span className="ml-2 font-mono text-[11px] text-ink-tertiary select-none">
              deliveryhub.app / operacao
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Tempo real</span>
          </div>
        </div>

        {/* Conteúdo com Grid Alinhado */}
        <div className="p-4 sm:p-5">
          <div className="mb-3.5 flex items-center justify-between border-b border-surface-border-subtle pb-2.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-ink-primary">
                Fila de Pedidos
              </h2>
              <p className="text-[11px] text-ink-tertiary mt-0.5">
                iFood, 99Food, Rappi e canais próprios
              </p>
            </div>
            <span className="text-[11px] text-ink-tertiary font-mono">
              3 pedidos ativos
            </span>
          </div>

          {/* Lista de Pedidos em Grid Rígido e Perfeitamente Alinhado */}
          <div className="space-y-2.5">
            {/* Pedido 1: iFood */}
            <div className="grid grid-cols-[50px_64px_1fr_68px_100px] items-center gap-2.5 rounded-xl border border-surface-border-subtle bg-surface-base p-2.5 text-xs transition-colors hover:border-surface-border">
              {/* Coluna 1: ID */}
              <div className="w-full text-center">
                <span className="font-mono text-[11px] font-bold text-ink-primary bg-surface-raised border border-surface-border px-1.5 py-1 rounded block shadow-sm">
                  #3421
                </span>
              </div>

              {/* Coluna 2: Canal (alinhado na própria coluna) */}
              <div className="w-full text-center">
                <span className="rounded bg-red-500/10 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400 block w-full">
                  iFood
                </span>
              </div>

              {/* Coluna 3: Cliente e Itens */}
              <div className="min-w-0">
                <span className="font-bold text-ink-primary text-xs block truncate">
                  Ana Costa
                </span>
                <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                  1 X-Salada, 1 Coca-Cola
                </p>
              </div>

              {/* Coluna 4: Valor e Tempo */}
              <div className="text-right">
                <p className="font-bold text-ink-primary tabular-nums text-xs">
                  R$ 38,90
                </p>
                <p className="text-[10px] text-ink-tertiary mt-0.5">2 min atrás</p>
              </div>

              {/* Coluna 5: Status */}
              <div className="w-full text-center">
                <span className="inline-flex w-full items-center justify-center rounded-full bg-[#FF6B00]/15 py-1 text-[11px] font-bold text-[#C2410C] dark:text-[#FF6B00]">
                  Aguardando
                </span>
              </div>
            </div>

            {/* Pedido 2: 99Food */}
            <div className="grid grid-cols-[50px_64px_1fr_68px_100px] items-center gap-2.5 rounded-xl border border-surface-border-subtle bg-surface-base p-2.5 text-xs transition-colors hover:border-surface-border">
              {/* Coluna 1: ID */}
              <div className="w-full text-center">
                <span className="font-mono text-[11px] font-bold text-ink-primary bg-surface-raised border border-surface-border px-1.5 py-1 rounded block shadow-sm">
                  #3420
                </span>
              </div>

              {/* Coluna 2: Canal */}
              <div className="w-full text-center">
                <span className="rounded bg-amber-500/10 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-400 block w-full">
                  99Food
                </span>
              </div>

              {/* Coluna 3: Cliente e Itens */}
              <div className="min-w-0">
                <span className="font-bold text-ink-primary text-xs block truncate">
                  Pedro Lima
                </span>
                <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                  2 Pizzas Médias
                </p>
              </div>

              {/* Coluna 4: Valor e Tempo */}
              <div className="text-right">
                <p className="font-bold text-ink-primary tabular-nums text-xs">
                  R$ 74,00
                </p>
                <p className="text-[10px] text-ink-tertiary mt-0.5">8 min atrás</p>
              </div>

              {/* Coluna 5: Status */}
              <div className="w-full text-center">
                <span className="inline-flex w-full items-center justify-center rounded-full bg-blue-500/15 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                  Em preparo
                </span>
              </div>
            </div>

            {/* Pedido 3: Rappi */}
            <div className="grid grid-cols-[50px_64px_1fr_68px_100px] items-center gap-2.5 rounded-xl border border-surface-border-subtle bg-surface-base p-2.5 text-xs transition-colors hover:border-surface-border">
              {/* Coluna 1: ID */}
              <div className="w-full text-center">
                <span className="font-mono text-[11px] font-bold text-ink-primary bg-surface-raised border border-surface-border px-1.5 py-1 rounded block shadow-sm">
                  #3419
                </span>
              </div>

              {/* Coluna 2: Canal */}
              <div className="w-full text-center">
                <span className="rounded bg-orange-500/10 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-400 block w-full">
                  Rappi
                </span>
              </div>

              {/* Coluna 3: Cliente e Itens */}
              <div className="min-w-0">
                <span className="font-bold text-ink-primary text-xs block truncate">
                  Julia Souza
                </span>
                <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                  Combo Kids
                </p>
              </div>

              {/* Coluna 4: Valor e Tempo */}
              <div className="text-right">
                <p className="font-bold text-ink-primary tabular-nums text-xs">
                  R$ 29,90
                </p>
                <p className="text-[10px] text-ink-tertiary mt-0.5">19 min atrás</p>
              </div>

              {/* Coluna 5: Status */}
              <div className="w-full text-center">
                <span className="inline-flex w-full items-center justify-center rounded-full bg-purple-500/15 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-400">
                  Saiu p/ entrega
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Provas Operacionais Diretas */}
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-ink-secondary">
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised/60 p-3 shadow-xs">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="font-medium text-ink-primary">Zero comissão</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised/60 p-3 shadow-xs">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="font-medium text-ink-primary">Sem fidelidade</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised/60 p-3 shadow-xs">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="font-medium text-ink-primary">14 dias grátis</span>
        </div>
      </div>
    </div>
  );
}
