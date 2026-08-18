'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Logo } from '../components/brand/logo';
import { useAuth } from '../lib/auth-context';
import { r } from '../lib/routes';
import { useTheme } from '../lib/theme-context';

export default function HomePage() {
  const router = useRouter();
  const { state, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (state) router.replace(r('/hub'));
  }, [loading, state, router]);

  if (loading || state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-ink-tertiary">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <PlatformBar />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* =========================================================================
 * NAV
 * ======================================================================= */
function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border-subtle bg-surface-base/70 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 translate-y-1 items-center" aria-label="DeliveryHub">
          <Logo size={160} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-ink-secondary md:flex">
          <a href="#features" className="hover:text-ink-primary">Recursos</a>
          <a href="#how" className="hover:text-ink-primary">Como funciona</a>
          <a href="#pricing" className="hover:text-ink-primary">Preços</a>
          <a href="#faq" className="hover:text-ink-primary">FAQ</a>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href={r('/login')}
            className="hidden text-sm font-medium text-ink-secondary transition hover:text-ink-primary md:inline"
          >
            Entrar
          </Link>
          <Link
            href={r('/signup')}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
      className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border-subtle bg-surface-raised text-ink-secondary transition hover:text-ink-primary"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/* =========================================================================
 * HERO
 * ======================================================================= */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 md:grid-cols-2 md:px-8 md:pb-24 md:pt-20">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-surface-border-subtle bg-surface-raised px-3 py-1 text-xs font-medium text-ink-secondary shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success-bright" />
            Beta aberto — 14 dias grátis
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink-primary md:text-5xl md:leading-[1.05]">
            Todo o delivery do seu restaurante <span className="bg-brand-gradient bg-clip-text text-transparent">em um só painel.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-ink-secondary md:text-lg">
            Pedidos, cardápio, pausa e conciliação de várias plataformas — sem
            abrir dez apps ao mesmo tempo. Comece pelo 99Food, expanda quando
            quiser.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={r('/signup')}
              className="rounded-lg bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Criar conta grátis
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-surface-border bg-surface-raised px-5 py-3 text-sm font-semibold text-ink-primary transition hover:bg-surface-overlay"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-tertiary">
            Sem cartão de crédito. Cancele em 1 clique.
          </p>
        </div>

        {/* Hero mock — miniatura do Hub */}
        <div className="relative flex items-center justify-center">
          <HeroMock />
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-brand-gradient opacity-20 blur-3xl" aria-hidden />
      <div className="surface-card overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-surface-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span className="text-xs font-medium text-ink-tertiary">Hub — ao vivo</span>
        </div>
        <div className="divide-y divide-surface-border-subtle">
          <MockOrder platform="99food" name="#3421 · Ana C." items="1x X-Salada, 1x Coca" total="R$ 38,90" status="Aceitar" />
          <MockOrder platform="ifood" name="#3420 · Pedro L." items="2x Pizza M" total="R$ 74,00" status="Preparando" />
          <MockOrder platform="99food" name="#3419 · Julia S." items="1x Combo Kids" total="R$ 29,90" status="Saiu p/ entrega" />
          <MockOrder platform="rappi" name="#3418 · Marcos R." items="1x Marmita Fit" total="R$ 22,50" status="Entregue" muted />
        </div>
        <div className="flex items-center justify-between border-t border-surface-border-subtle bg-surface-overlay/50 px-4 py-3 text-xs text-ink-tertiary">
          <span>Hoje: 47 pedidos</span>
          <span className="tabular font-medium text-ink-secondary">R$ 1.842,50</span>
        </div>
      </div>
    </div>
  );
}

function MockOrder({
  platform, name, items, total, status, muted,
}: {
  platform: 'ifood' | '99food' | 'rappi' | 'keeta';
  name: string;
  items: string;
  total: string;
  status: string;
  muted?: boolean;
}) {
  const dot: Record<string, string> = {
    ifood: 'bg-platform-ifood',
    '99food': 'bg-platform-99food',
    rappi: 'bg-platform-rappi',
    keeta: 'bg-platform-keeta',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 text-sm ${muted ? 'opacity-55' : ''}`}>
      <span className={`h-2 w-2 rounded-full ${dot[platform]}`} aria-hidden />
      <div className="flex-1">
        <div className="font-medium text-ink-primary">{name}</div>
        <div className="text-xs text-ink-tertiary">{items}</div>
      </div>
      <div className="text-right">
        <div className="tabular text-xs font-semibold text-ink-primary">{total}</div>
        <div className="text-[10px] uppercase tracking-wide text-ink-tertiary">{status}</div>
      </div>
    </div>
  );
}

/* =========================================================================
 * PLATFORM BAR
 * ======================================================================= */
function PlatformBar() {
  const platforms = [
    { name: '99Food', color: 'bg-platform-99food', status: 'Ao vivo', live: true },
    { name: 'iFood', color: 'bg-platform-ifood', status: 'Em breve' },
    { name: 'Keeta', color: 'bg-platform-keeta', status: 'Em breve' },
    { name: 'Rappi', color: 'bg-platform-rappi', status: 'Roadmap' },
    { name: 'Uber Eats', color: 'bg-platform-ubereats', status: 'Roadmap' },
    { name: 'AiQfome', color: 'bg-platform-aiqfome', status: 'Roadmap' },
  ];
  return (
    <section className="relative overflow-hidden border-y border-surface-border-subtle bg-surface-raised/30">
      <div className="pointer-events-none absolute inset-0 bg-body-radial opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">Plataformas</span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-primary md:text-3xl">
            As principais do Brasil, num painel só
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="surface-card group relative flex flex-col items-center justify-center overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              {p.live && (
                <span className="absolute right-3 top-3 flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-bright opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success-bright" />
                </span>
              )}
              <div
                className={`mb-3 h-10 w-10 rounded-full ${p.color} shadow-sm ring-4 ring-surface-border-subtle transition group-hover:scale-110`}
                aria-hidden
              />
              <div className="text-sm font-semibold text-ink-primary">{p.name}</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-tertiary">
                {p.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * FEATURES
 * ======================================================================= */
function Features() {
  const items = [
    {
      title: 'Hub unificado',
      body: 'Todos os pedidos das plataformas conectadas em uma única fila — aceitar, preparar, despachar, sem alternar app.',
      tag: 'Core',
      span: 'lg:col-span-2',
      icon: <path d="M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z" />,
    },
    {
      title: 'Pausa multiplataforma',
      body: 'Estourou a demanda? 1 clique pausa a loja em todas as plataformas ao mesmo tempo. Volta com outro clique.',
      tag: 'Diferencial',
      span: 'lg:col-span-2',
      icon: (
        <>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </>
      ),
    },
    {
      title: 'Cardápio unificado',
      body: 'Edite em um lugar e publique nas plataformas conectadas. Preço, disponibilidade e foto sempre em sincronia.',
      icon: (
        <>
          <path d="M4 4h12l4 4v12H4z" />
          <path d="M8 12h8M8 16h8M8 8h4" />
        </>
      ),
    },
    {
      title: 'Financeiro',
      body: 'Receita bruta, taxas, taxa de entrega e líquido — plataforma por plataforma, dia a dia.',
      icon: (
        <>
          <path d="M3 20V4M3 20h18" />
          <path d="M7 16v-6M11 16v-4M15 16v-9M19 16v-3" />
        </>
      ),
    },
    {
      title: 'KDS de cozinha',
      body: 'Tela de cozinha em tempo real, otimizada pra tablet. Funciona 100% na rede local.',
      icon: (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8" />
        </>
      ),
    },
    {
      title: 'Cancelamentos',
      body: 'Solicitações de cancelamento e reembolso na inbox — você aprova, contesta ou resolve com 2 cliques.',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </>
      ),
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-24 md:px-8">
      <div className="mb-14 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">Recursos</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
          Feito para quem opera em várias plataformas ao mesmo tempo.
        </h2>
        <p className="mt-4 text-ink-secondary">
          Cada recurso resolve uma dor real de restaurante — não é feature-list
          pra parecer completo.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((f) => (
          <div
            key={f.title}
            className={`surface-card group relative overflow-hidden p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${f.span ?? ''}`}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-gradient opacity-0 blur-3xl transition duration-500 group-hover:opacity-25"
              aria-hidden
            />
            <div className="relative">
              <div className="mb-5 flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    {f.icon}
                  </svg>
                </div>
                {f.tag && (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    {f.tag}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-ink-primary">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================
 * HOW IT WORKS
 * ======================================================================= */
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Crie sua conta em 30s',
      body: 'Signup por email, sem cartão. Já sai com uma loja pronta pra conectar plataformas.',
      icon: (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      ),
    },
    {
      n: '02',
      title: 'Conecte suas plataformas',
      body: 'Login OAuth oficial de cada plataforma. Nunca vemos sua senha — apenas o token gerado.',
      icon: (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      ),
    },
    {
      n: '03',
      title: 'Pedidos chegam no Hub',
      body: 'Conexão fica verde e os pedidos aparecem em tempo real. Aceite, prepare, despache.',
      icon: (
        <>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </>
      ),
    },
  ];
  return (
    <section id="how" className="border-y border-surface-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-8">
        <div className="mb-16 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">Como funciona</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
            Do cadastro ao primeiro pedido em menos de 10 minutos.
          </h2>
        </div>
        <div className="relative grid gap-6 md:grid-cols-3">
          {/* Linha conectora entre os passos (só desktop) */}
          <div
            className="pointer-events-none absolute left-16 right-16 top-14 hidden h-px md:block"
            aria-hidden
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
          </div>
          {steps.map((s) => (
            <div
              key={s.n}
              className="surface-card relative overflow-hidden p-8 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    {s.icon}
                  </svg>
                </div>
                <span className="text-5xl font-black tracking-tight text-ink-tertiary/30">
                  {s.n}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-ink-primary">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 md:px-8">
      <div className="mb-14 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Números
        </span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
          Feito pra operar como uma máquina.
        </h2>
        <p className="mt-4 text-ink-secondary">
          As garantias que você leva assim que assinar — sem letras miúdas.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          value="6"
          label="Plataformas suportadas"
          hint="99Food ao vivo · iFood e Keeta em breve"
          visual={<PlatformDots />}
        />
        <StatCard
          value="<10"
          suffix="min"
          label="Do signup ao 1º pedido"
          hint="Setup guiado, sem código"
          visual={<TimerRing />}
        />
        <StatCard
          value="0"
          suffix="%"
          label="Taxa por pedido"
          hint="Preço fixo mensal, sempre"
          visual={<ZeroFee />}
        />
        <StatCard
          value="24/7"
          label="Operação em tempo real"
          hint="WebSocket + polling contínuo"
          visual={<LiveWave />}
        />
      </div>
    </section>
  );
}

function StatCard({
  value,
  suffix,
  label,
  hint,
  visual,
}: {
  value: string;
  suffix?: string;
  label: string;
  hint: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="surface-card group relative flex flex-col justify-between overflow-hidden p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-gradient opacity-0 blur-3xl transition duration-500 group-hover:opacity-20"
        aria-hidden
      />
      <div className="relative flex h-14 items-center justify-between gap-4">
        <div className="flex items-baseline gap-1 leading-none tabular">
          <span className="font-brand bg-brand-gradient bg-clip-text text-5xl font-black not-italic tracking-tight text-transparent md:text-6xl">
            {value}
          </span>
          {suffix && (
            <span className="font-brand text-2xl font-bold not-italic text-brand-600 md:text-3xl">
              {suffix}
            </span>
          )}
        </div>
        <div className="flex h-full flex-none items-center">{visual}</div>
      </div>
      <div className="relative mt-8">
        <div className="text-sm font-semibold text-ink-primary">{label}</div>
        <div className="mt-1 text-xs leading-relaxed text-ink-tertiary">{hint}</div>
      </div>
    </div>
  );
}

/* Visuais únicos por stat — cada um "conta" o número visualmente */

function PlatformDots() {
  const colors = [
    'bg-platform-99food',
    'bg-platform-ifood',
    'bg-platform-keeta',
    'bg-platform-rappi',
    'bg-platform-ubereats',
    'bg-platform-aiqfome',
  ];
  return (
    <div className="grid h-12 grid-cols-3 place-content-center gap-1.5" aria-hidden>
      {colors.map((c) => (
        <span key={c} className={`h-3 w-3 rounded-full ${c} shadow-sm`} />
      ))}
    </div>
  );
}

function TimerRing() {
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12" aria-hidden>
      <circle cx="20" cy="20" r="16" className="stroke-surface-border-subtle" strokeWidth="3" fill="none" />
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke="url(#timer-grad)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="100.5"
        strokeDashoffset="83"
        transform="rotate(-90 20 20)"
      />
      <defs>
        <linearGradient id="timer-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <text x="20" y="24" textAnchor="middle" className="fill-brand-600 text-[10px] font-bold">
        1/6
      </text>
    </svg>
  );
}

function ZeroFee() {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center" aria-hidden>
      <span className="font-brand text-4xl font-black not-italic text-brand-500/25">%</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="h-0.5 w-full origin-center rotate-[-20deg] bg-danger-bright/70" />
      </span>
    </div>
  );
}

function LiveWave() {
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden>
      {[0.4, 0.7, 0.55, 0.9, 0.5, 0.75].map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-sm bg-brand-gradient"
          style={{ height: `${h * 100}%`, animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </div>
  );
}

/* =========================================================================
 * PRICING
 * ======================================================================= */
function Pricing() {
  const features = [
    'Hub unificado (pedidos em tempo real)',
    'Pausa multiplataforma',
    'Cardápio unificado',
    'Financeiro consolidado + relatórios',
    'KDS de cozinha (tablet)',
    'Inbox de cancelamentos e reembolsos',
    'Suporte por email e WhatsApp',
    'Atualizações incluídas para sempre',
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">Preços</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
          Um plano só. Sem pegadinha.
        </h2>
        <p className="mt-4 text-ink-secondary">
          Enquanto crescemos, um plano único cobre tudo. Sem taxa por pedido, sem
          limite de plataformas.
        </p>
      </div>
      <div className="mx-auto max-w-lg">
        <div className="surface-card relative overflow-hidden p-8 shadow-lg">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-gradient opacity-20 blur-2xl" aria-hidden />
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-semibold text-brand-600">Loja</div>
              <div className="mt-1 text-xs text-ink-tertiary">para 1 restaurante</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold tabular text-ink-primary">
                R$ 149<span className="text-lg text-ink-tertiary">/mês</span>
              </div>
              <div className="text-xs text-ink-tertiary">14 dias grátis</div>
            </div>
          </div>
          <ul className="mt-8 space-y-3 text-sm">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-ink-secondary">
                <CheckIcon />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={r('/signup')}
            className="mt-8 block rounded-lg bg-brand-gradient px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Começar grátis
          </Link>
          <p className="mt-3 text-center text-xs text-ink-tertiary">
            Sem cartão. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-5 w-5 flex-none text-success-bright" aria-hidden>
      <circle cx="10" cy="10" r="10" className="fill-current opacity-15" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =========================================================================
 * FAQ
 * ======================================================================= */
function FAQ() {
  const items = [
    {
      q: 'Preciso de cartão de crédito pra testar?',
      a: 'Não. Você cria a conta, testa por 14 dias e só depois decide se assina. Sem cobrança automática.',
    },
    {
      q: 'E se meu restaurante opera em apenas 1 plataforma?',
      a: 'Ainda faz sentido. O Hub concentra pedidos, o cardápio unificado deixa a atualização mais rápida, e o financeiro consolidado mostra taxas, líquido e ranking de itens — coisas que a plataforma sozinha não te dá.',
    },
    {
      q: 'O iFood já está disponível?',
      a: 'A integração técnica está pronta e o adapter roda em produção. Estamos aguardando a homologação do app dentro do processo oficial do iFood. Ao entrar, seus dados migram sem esforço — é o mesmo botão de conectar.',
    },
    {
      q: 'É seguro conectar minha conta de cada plataforma?',
      a: 'Sim. Usamos o fluxo OAuth oficial de cada uma delas: você entra na plataforma e autoriza o acesso, e nós recebemos um token — nunca sua senha. Você pode revogar o acesso a qualquer momento pela própria plataforma.',
    },
    {
      q: 'Como funciona o KDS?',
      a: 'Abre em qualquer navegador em modo tela cheia (tablet, notebook velho, o que estiver na cozinha). Os pedidos aparecem em tempo real via WebSocket — não precisa apertar F5.',
    },
    {
      q: 'Posso cancelar quando quiser?',
      a: 'Sim, 1 clique nas configurações. Sem multa, sem ligação, sem formulário longo. Seus dados ficam disponíveis pra exportar por 90 dias.',
    },
  ];
  return (
    <section id="faq" className="border-t border-surface-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-3xl px-4 py-20 md:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">FAQ</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
            Perguntas frequentes
          </h2>
        </div>
        <div className="space-y-3">
          {items.map((it) => (
            <details
              key={it.q}
              className="surface-card group p-5 transition open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-ink-primary">
                <span>{it.q}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 flex-none text-ink-tertiary transition group-open:rotate-45"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-ink-secondary">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * FINAL CTA
 * ======================================================================= */
function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
      <div className="surface-card relative overflow-hidden p-10 md:p-14">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-70" aria-hidden />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink-primary md:text-3xl">
              Comece grátis. Cancele em 1 clique.
            </h2>
            <p className="mt-3 text-ink-secondary">
              14 dias sem cartão de crédito. Configure em 10 minutos e veja seus
              pedidos entrarem no Hub.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={r('/signup')}
              className="rounded-lg bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Criar conta grátis
            </Link>
            <Link
              href={r('/login')}
              className="rounded-lg border border-surface-border bg-surface-raised px-5 py-3 text-sm font-semibold text-ink-primary transition hover:bg-surface-overlay"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * FOOTER
 * ======================================================================= */
function Footer() {
  return (
    <footer className="border-t border-surface-border-subtle bg-surface-base">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-3 text-sm text-ink-tertiary">
          <Logo size={96} />
          <span>· {new Date().getFullYear()} · Todos os direitos reservados</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-tertiary">
          <Link href={r('/login')} className="hover:text-ink-primary">Entrar</Link>
          <Link href={r('/signup')} className="hover:text-ink-primary">Criar conta</Link>
          <a href="#pricing" className="hover:text-ink-primary">Preços</a>
          <a href="#faq" className="hover:text-ink-primary">FAQ</a>
          <a href="mailto:contato@deliveryhub.com.br" className="hover:text-ink-primary">Contato</a>
        </nav>
      </div>
    </footer>
  );
}
