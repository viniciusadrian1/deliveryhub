import { CheckCircle2, Sparkles } from 'lucide-react';

import { Logo } from './logo';

interface Highlight {
  title: string;
  description: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    title: 'Margem cross-platform',
    description:
      'Defina margem-alvo. O DeliveryHub calcula o preço bruto certo em cada plataforma — comissão diferente, mesma margem líquida.',
  },
  {
    title: 'Pausa em segundos',
    description:
      'Pause iFood, Rappi, 99Food e demais — todos juntos ou só o canal certo. Reabertura agendada.',
  },
  {
    title: 'Conciliação automatizada',
    description:
      'Importe o extrato bancário, o sistema casa cada repasse com seus pedidos e sinaliza divergências.',
  },
];

export function AuthAside() {
  return (
    <aside className="hidden flex-col justify-between bg-surface-raised p-10 lg:flex lg:w-[480px]">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <Logo size={32} />
      </div>

      <div className="relative space-y-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          Foodtech B2B · MVP
        </div>
        <h2 className="text-2xl font-bold leading-tight text-ink-primary">
          O sistema que centraliza{' '}
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            todas as suas plataformas
          </span>{' '}
          em uma só tela.
        </h2>

        <ul className="space-y-4">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-ink-primary">{h.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-secondary">
                  {h.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative space-y-2 border-t border-surface-border-subtle pt-6">
        <p className="text-xs uppercase tracking-wider text-ink-tertiary">
          Construído para
        </p>
        <p className="text-sm text-ink-secondary">
          Restaurantes que vendem em iFood, Rappi, 99Food, Keeta e UberEats —
          e querem operar com a fricção de uma só plataforma.
        </p>
      </div>
    </aside>
  );
}
