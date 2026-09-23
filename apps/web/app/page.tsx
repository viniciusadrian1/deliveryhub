'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Lock,
  Package,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Logo } from '../components/brand/logo';
import { ThemeToggle } from '../components/layout/theme-toggle';
import { r } from '../lib/routes';

type DemoTab = 'pedidos' | 'cardapio' | 'produto';


const faqItems = [
  {
    q: 'Como funciona a integração com iFood, Rappi e 99Food?',
    a: 'A conexão é realizada diretamente por meio das APIs oficiais e homologadas de cada aplicativo via autorização OAuth segura. Você conecta a sua conta atual em poucos cliques, sem necessidade de intermediários, sem risco de perder o histórico da sua loja e sem alterar suas condições contratuais com as plataformas.',
  },
  {
    q: 'O DeliveryHub cobra alguma porcentagem sobre as vendas ou pedidos?',
    a: 'Não. O DeliveryHub trabalha exclusivamente com planos de assinatura fixa, sem qualquer taxa percentual ou cobrança por pedido recebido. Todo o faturamento da sua operação fica 100% com o seu estabelecimento.',
  },
  {
    q: 'O sistema envia os pedidos automaticamente para impressoras de cozinha?',
    a: 'Sim. O sistema se comunica com impressoras térmicas padrão ESC/POS (USB, rede Ethernet e Wi-Fi) de 80mm e 58mm (como Epson, Elgin e Bematech). Você pode habilitar a impressão automática ao receber o pedido e definir roteamentos separados para a cozinha, bar e expedição.',
  },
  {
    q: 'Existe período de fidelidade ou multa caso eu queira cancelar?',
    a: 'Não. Nossos planos não possuem qualquer cláusula de fidelidade ou carência. O cancelamento pode ser feito pelo próprio administrador diretamente nas configurações da conta a qualquer momento, sem burocracia ou cobrança de multas.',
  },
  {
    q: 'Preciso comprar novos computadores ou tablets para usar a plataforma?',
    a: 'Não. O DeliveryHub é uma plataforma web moderna e responsiva. Você pode utilizá-la em computadores (Windows, Mac ou Linux), tablets (Android ou iPad) ou até mesmo em celulares. Não é necessário adquirir servidores locais nem instalar programas pesados.',
  },
  {
    q: 'Consigo pausar itens esgotados e atualizar preços em todos os canais ao mesmo tempo?',
    a: 'Sim. Ao pausar um produto ou atualizar seu preço no DeliveryHub, a alteração é sincronizada imediatamente nos canais integrados. Além disso, você pode definir regras de preços específicas por canal caso queira praticar valores diferentes em cada aplicativo.',
  },
  {
    q: 'O que acontece se a internet do restaurante cair temporariamente?',
    a: 'O DeliveryHub possui tolerância a falhas na rede. Os pedidos já carregados continuam disponíveis no painel e na tela de preparo (KDS), e a fila sincroniza os novos pedidos automaticamente assim que a conexão de internet da sua loja for restabelecida.',
  },
  {
    q: 'Como funciona o período de teste e o suporte técnico?',
    a: 'Você conta com 14 dias de teste com acesso a todos os recursos para experimentar o sistema na rotina real da sua cozinha. Nossa equipe oferece suporte guiado na configuração dos canais e atendimento contínuo para tirar dúvidas da sua equipe durante a operação.',
  },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>('pedidos');
  const [liveOrderUpdated, setLiveOrderUpdated] = useState(false);
  const [cardapioPaused, setCardapioPaused] = useState(false);
  const [productSimPrice, setProductSimPrice] = useState('R$ 28,00');
  const [productSyncStatus, setProductSyncStatus] = useState<'idle' | 'saving' | 'synced'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [legalModalDoc, setLegalModalDoc] = useState<'termos' | 'privacidade' | null>(null);

  // Loop contínuo automático (efeito GIF / demonstração viva)
  useEffect(() => {
    const tabs: DemoTab[] = ['pedidos', 'cardapio', 'produto'];
    const timer = setInterval(() => {
      setActiveTab((curr) => {
        const nextIdx = (tabs.indexOf(curr) + 1) % tabs.length;
        return tabs[nextIdx]!;
      });
    }, 7500);
    return () => clearInterval(timer);
  }, []);

  // Micro-animações por aba
  useEffect(() => {
    if (activeTab === 'pedidos') {
      setLiveOrderUpdated(false);
      const t = setTimeout(() => setLiveOrderUpdated(true), 2500);
      return () => clearTimeout(t);
    } else if (activeTab === 'cardapio') {
      setCardapioPaused(false);
      const t1 = setTimeout(() => setCardapioPaused(true), 2000);
      const t2 = setTimeout(() => setCardapioPaused(false), 4500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (activeTab === 'produto') {
      setProductSimPrice('R$ 28,00');
      setProductSyncStatus('idle');
      const t1 = setTimeout(() => setProductSimPrice('R$ 32,00'), 1500);
      const t2 = setTimeout(() => setProductSyncStatus('saving'), 2500);
      const t3 = setTimeout(() => setProductSyncStatus('synced'), 3800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeTab]);

  useEffect(() => {
    function checkHash() {
      if (typeof window !== 'undefined') {
        if (window.location.hash === '#termos') {
          setLegalModalDoc('termos');
        } else if (window.location.hash === '#privacidade') {
          setLegalModalDoc('privacidade');
        }
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  function closeLegalModal() {
    setLegalModalDoc(null);
    if (
      typeof window !== 'undefined' &&
      (window.location.hash === '#termos' || window.location.hash === '#privacidade')
    ) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }


  return (
    <main className="min-h-screen bg-surface-base text-ink-primary selection:bg-brand-500 selection:text-white">
      {/* =====================================================================
          1. HEADER FIXO (Sticky Navigation)
          ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-surface-border-subtle bg-surface-base/90 backdrop-blur-md">
        <nav
          aria-label="Navegação principal"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:px-8"
        >
          <Link href={r('/')} aria-label="DeliveryHub página inicial">
            <Logo size={34} />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#demonstracao"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              Demonstração
            </a>
            <a
              href="#plataformas"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              Plataformas
            </a>
            <a
              href="#beneficios"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              Benefícios
            </a>
            <a
              href="#precos"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              Preços
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href={r('/login')}
              className="hidden rounded-lg border border-surface-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:border-surface-border-strong hover:bg-surface-overlay sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href={r('/signup')}
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E85F00]"
            >
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      {/* =====================================================================
          2. HERO SECTION (MINIMALISTA)
          ===================================================================== */}
      <section className="relative overflow-hidden border-b border-surface-border-subtle pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink-primary sm:text-6xl lg:text-7xl sm:leading-[1.1]">
              Todos os seus pedidos em um só lugar.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base text-ink-secondary sm:text-lg">
              Receba pedidos do iFood, Rappi, 99Food e Keeta em uma única tela e envie direto para a cozinha.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={r('/signup')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E85F00] sm:w-auto"
              >
                <span>Começar agora</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#demonstracao"
                className="inline-flex w-full items-center justify-center rounded-lg border border-surface-border bg-surface-raised px-6 py-3 text-sm font-semibold text-ink-primary transition-colors hover:border-surface-border-strong hover:bg-surface-overlay sm:w-auto"
              >
                Ver demonstração
              </a>
            </div>
          </div>

          {/* =====================================================================
              3. DEMONSTRAÇÃO INTERATIVA
              ===================================================================== */}
          <div id="demonstracao" className="mt-14 scroll-mt-24 md:mt-20">
            <div className="mb-6 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
                Demonstração em Tempo Real
              </span>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                Veja como funciona na prática
              </h2>
              <p className="mt-2 text-sm text-ink-secondary">
                Uma única operação para todos os seus canais de venda.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-xl">
              {/* Moldura superior da janela do sistema */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle bg-surface-base/80 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-ink-tertiary">
                    deliveryhub.app / operacao
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Abas de navegação */}
                  <div className="flex items-center gap-1 rounded-lg border border-surface-border-subtle bg-surface-raised p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('pedidos')}
                      className={`relative rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'pedidos'
                          ? 'bg-[#FF6B00] text-white shadow-sm'
                          : 'text-ink-secondary hover:text-ink-primary'
                        }`}
                    >
                      Fila de Pedidos
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('cardapio')}
                      className={`relative rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'cardapio'
                          ? 'bg-[#FF6B00] text-white shadow-sm'
                          : 'text-ink-secondary hover:text-ink-primary'
                        }`}
                    >
                      Cardápio
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('produto')}
                      className={`relative rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'produto'
                          ? 'bg-[#FF6B00] text-white shadow-sm'
                          : 'text-ink-secondary hover:text-ink-primary'
                        }`}
                    >
                      Produto
                    </button>
                  </div>
                </div>
              </div>

              {/* CONTEÚDO DAS ABAS */}
              <div className="p-4 sm:p-6 md:p-8 min-h-[460px]">
                {/* ABA 1: FILA DE PEDIDOS */}
                {activeTab === 'pedidos' && (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-subtle pb-4">
                      <div>
                        <h3 className="text-base font-bold text-ink-primary">
                          Fila de Pedidos
                        </h3>
                        <p className="text-xs text-ink-tertiary">
                          Todos os pedidos organizados por ordem de chegada
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-base px-3 py-1 text-xs font-medium text-ink-secondary">
                        <Clock className="h-3.5 w-3.5 text-[#FF6B00]" />
                        <span>4 canais conectados</span>
                      </div>
                    </div>

                    {/* Banner de Novo Pedido em Tempo Real */}
                    <div className={`mb-3.5 flex items-center justify-between rounded-lg border px-3.5 py-2 text-xs transition-all ${liveOrderUpdated
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#C2410C] dark:text-[#FF6B00]'
                      }`}>
                      <div className="flex items-center gap-2">
                        {liveOrderUpdated ? (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current animate-ping" />
                        )}
                        <span>
                          {liveOrderUpdated ? (
                            <>Pedido <strong>#3421</strong> confirmado e direcionado para a cozinha</>
                          ) : (
                            <>Novo pedido recebido via iFood: <strong>#3421 (R$ 38,90)</strong></>
                          )}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] opacity-80">
                        {liveOrderUpdated ? 'Confirmado agora' : 'Recebido agora'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {/* Pedido 1: #3421 com status animado */}
                      <div className={`grid grid-cols-1 sm:grid-cols-[60px_84px_1fr_85px_140px] items-center gap-3 sm:gap-4 rounded-xl border bg-surface-base p-3 sm:p-3.5 transition-all ${liveOrderUpdated
                          ? 'border-emerald-500/40 shadow-sm'
                          : 'border-surface-border-subtle hover:border-surface-border'
                        }`}>
                        <div className="w-full text-center rounded-lg border border-surface-border bg-surface-raised py-1.5 font-mono text-xs font-bold text-ink-primary shadow-sm">
                          #3421
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-block w-full py-1 text-center rounded text-[11px] font-bold bg-red-500/10 text-red-700 dark:text-red-400">
                            iFood
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-ink-primary block truncate">
                            Ana Costa
                          </span>
                          <p className="mt-0.5 text-xs text-ink-secondary truncate">1 X-Salada, 1 Coca-Cola</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold tabular-nums text-ink-primary">
                            R$ 38,90
                          </p>
                          <p className="text-[11px] text-ink-tertiary">
                            {liveOrderUpdated ? 'Agora' : '2 min atrás'}
                          </p>
                        </div>
                        <div className="w-full text-center">
                          <span className={`inline-flex w-full items-center justify-center rounded-full py-1 text-xs font-bold transition-all ${liveOrderUpdated
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]'
                            }`}>
                            {liveOrderUpdated ? 'Em preparo' : 'Aguardando'}
                          </span>
                        </div>
                      </div>

                      {/* Pedido 2 */}
                      <div className="grid grid-cols-1 sm:grid-cols-[60px_84px_1fr_85px_140px] items-center gap-3 sm:gap-4 rounded-xl border border-surface-border-subtle bg-surface-base p-3 sm:p-3.5 transition-all hover:border-surface-border">
                        <div className="w-full text-center rounded-lg border border-surface-border bg-surface-raised py-1.5 font-mono text-xs font-bold text-ink-primary shadow-sm">
                          #3420
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-block w-full py-1 text-center rounded text-[11px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-400">
                            99Food
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-ink-primary block truncate">
                            Pedro Lima
                          </span>
                          <p className="mt-0.5 text-xs text-ink-secondary truncate">2 Pizzas Médias</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold tabular-nums text-ink-primary">
                            R$ 74,00
                          </p>
                          <p className="text-[11px] text-ink-tertiary">8 min atrás</p>
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-flex w-full items-center justify-center rounded-full py-1 text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400">
                            Em preparo
                          </span>
                        </div>
                      </div>

                      {/* Pedido 3 */}
                      <div className="grid grid-cols-1 sm:grid-cols-[60px_84px_1fr_85px_140px] items-center gap-3 sm:gap-4 rounded-xl border border-surface-border-subtle bg-surface-base p-3 sm:p-3.5 transition-all hover:border-surface-border">
                        <div className="w-full text-center rounded-lg border border-surface-border bg-surface-raised py-1.5 font-mono text-xs font-bold text-ink-primary shadow-sm">
                          #3419
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-block w-full py-1 text-center rounded text-[11px] font-bold bg-orange-500/10 text-orange-700 dark:text-orange-400">
                            Rappi
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-ink-primary block truncate">
                            Julia Souza
                          </span>
                          <p className="mt-0.5 text-xs text-ink-secondary truncate">Combo Kids</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold tabular-nums text-ink-primary">
                            R$ 29,90
                          </p>
                          <p className="text-[11px] text-ink-tertiary">19 min atrás</p>
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-flex w-full items-center justify-center rounded-full py-1 text-xs font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400">
                            Saiu p/ entrega
                          </span>
                        </div>
                      </div>

                      {/* Pedido 4 */}
                      <div className="grid grid-cols-1 sm:grid-cols-[60px_84px_1fr_85px_140px] items-center gap-3 sm:gap-4 rounded-xl border border-surface-border-subtle bg-surface-base p-3 sm:p-3.5 transition-all hover:border-surface-border">
                        <div className="w-full text-center rounded-lg border border-surface-border bg-surface-raised py-1.5 font-mono text-xs font-bold text-ink-primary shadow-sm">
                          #3418
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-block w-full py-1 text-center rounded text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400">
                            Keeta
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-ink-primary block truncate">
                            Marcos Rocha
                          </span>
                          <p className="mt-0.5 text-xs text-ink-secondary truncate">Marmita Fit</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold tabular-nums text-ink-primary">
                            R$ 22,50
                          </p>
                          <p className="text-[11px] text-ink-tertiary">25 min atrás</p>
                        </div>
                        <div className="w-full text-center">
                          <span className="inline-flex w-full items-center justify-center rounded-full py-1 text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            Entregue
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-surface-border-subtle pt-3 text-xs text-ink-tertiary">
                      <span>4 pedidos ativos</span>
                      <span>Tempo médio de preparo: 14 minutos</span>
                    </div>
                  </div>
                )}

                {/* ABA 2: CARDÁPIO */}
                {activeTab === 'cardapio' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between border-b border-surface-border-subtle pb-4">
                      <div>
                        <h3 className="text-base font-bold text-ink-primary">
                          Cardápio
                        </h3>
                        <p className="text-xs text-ink-tertiary">
                          Preços e disponibilidade sincronizados com todas as plataformas
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Sincronização ativa</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-surface-border-subtle text-ink-tertiary">
                            <th className="pb-2.5 font-semibold">Produto</th>
                            <th className="pb-2.5 font-semibold">Categoria</th>
                            <th className="pb-2.5 font-semibold">Preço</th>
                            <th className="pb-2.5 font-semibold">Canais integrados</th>
                            <th className="pb-2.5 text-right font-semibold">Disponibilidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border-subtle">
                          {/* Item 1 animado */}
                          <tr className="hover:bg-surface-base/50">
                            <td className="py-3 font-bold text-ink-primary">X-Salada Especial</td>
                            <td className="py-3 text-ink-secondary">Hambúrgueres</td>
                            <td className="py-3 font-bold tabular-nums text-ink-primary">
                              R$ 28,00
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">iFood</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">99Food</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Rappi</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Keeta</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setCardapioPaused(!cardapioPaused)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${cardapioPaused
                                    ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${cardapioPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                <span>{cardapioPaused ? 'Pausado' : 'Disponível'}</span>
                              </button>
                            </td>
                          </tr>

                          {/* Item 2 */}
                          <tr className="hover:bg-surface-base/50">
                            <td className="py-3 font-bold text-ink-primary">Pizza Calabresa</td>
                            <td className="py-3 text-ink-secondary">Pizzas</td>
                            <td className="py-3 font-bold tabular-nums text-ink-primary">
                              R$ 58,00
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">iFood</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">99Food</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Rappi</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Keeta</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>Disponível</span>
                              </span>
                            </td>
                          </tr>

                          {/* Item 3 */}
                          <tr className="hover:bg-surface-base/50">
                            <td className="py-3 font-bold text-ink-primary">Marmita Fit</td>
                            <td className="py-3 text-ink-secondary">Pratos Executivos</td>
                            <td className="py-3 font-bold tabular-nums text-ink-primary">
                              R$ 26,50
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">iFood</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">99Food</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Rappi</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Keeta</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>Disponível</span>
                              </span>
                            </td>
                          </tr>

                          {/* Item 4 */}
                          <tr className="hover:bg-surface-base/50">
                            <td className="py-3 font-bold text-ink-primary">Refrigerante Lata</td>
                            <td className="py-3 text-ink-secondary">Bebidas</td>
                            <td className="py-3 font-bold tabular-nums text-ink-primary">
                              R$ 7,50
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">iFood</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">99Food</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Rappi</span>
                                <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">Keeta</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>Disponível</span>
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <span>✓ Todos os itens estão sincronizados entre os 4 canais.</span>
                      <span className="font-mono text-[11px]">0 divergências</span>
                    </div>
                  </div>
                )}

                {/* ABA 3: PRODUTO (ATUALIZAÇÃO DE CARDÁPIO E PREÇOS) */}
                {activeTab === 'produto' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between border-b border-surface-border-subtle pb-4">
                      <div>
                        <h3 className="text-base font-bold text-ink-primary">
                          Atualização de Item e Preço
                        </h3>
                        <p className="text-xs text-ink-tertiary">
                          Altere o produto no painel e mantenha todos os seus canais de venda sincronizados
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        <span>Sincronização em tempo real</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      {/* Coluna 1: Edição Rápida */}
                      <div className="rounded-xl border border-surface-border-subtle bg-surface-base p-4 sm:p-5 lg:col-span-7">
                        <div className="mb-3.5 flex items-center justify-between border-b border-surface-border-subtle pb-2.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                            Dados do Produto
                          </span>
                          <span className="font-mono text-[11px] text-ink-tertiary">Cód: #1042</span>
                        </div>

                        <div className="grid gap-3.5 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                              Nome do produto
                            </label>
                            <input
                              type="text"
                              value="X-Salada Especial"
                              readOnly
                              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-ink-primary focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                              Categoria
                            </label>
                            <input
                              type="text"
                              value="Hambúrgueres"
                              readOnly
                              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-ink-primary focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                              Preço de venda
                            </label>
                            <input
                              type="text"
                              value={productSimPrice}
                              readOnly
                              className={`w-full rounded-lg border px-3 py-2 text-xs font-bold transition-all focus:outline-none ${productSimPrice === 'R$ 32,00'
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border-surface-border bg-surface-raised text-ink-primary'
                                }`}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                              Disponibilidade
                            </label>
                            <div className="flex h-9 items-center">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Disponível em todos os canais
                              </span>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                              Descrição do prato
                            </label>
                            <textarea
                              rows={2}
                              value="Pão brioche artesanal, hambúrguer 160g, queijo cheddar, alface americana e maionese da casa."
                              readOnly
                              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-ink-primary focus:outline-none resize-none"
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-2">
                          <button
                            type="button"
                            className={`w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold text-white shadow-sm transition-all ${productSyncStatus === 'saving'
                                ? 'bg-blue-600'
                                : productSyncStatus === 'synced'
                                  ? 'bg-emerald-600'
                                  : 'bg-[#FF6B00] hover:bg-[#E85F00]'
                              }`}
                          >
                            {productSyncStatus === 'saving' && (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {productSyncStatus === 'synced' && (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {productSyncStatus === 'saving'
                                ? 'Atualizando nos 4 canais de venda...'
                                : productSyncStatus === 'synced'
                                  ? 'Cardápios sincronizados com sucesso'
                                  : 'Salvar e atualizar cardápios'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Coluna 2: Status de Atualização nos Canais */}
                      <div className="flex flex-col justify-between rounded-xl border border-surface-border-subtle bg-surface-base/80 p-4 sm:p-5 lg:col-span-5">
                        <div>
                          <div className="mb-3.5 flex items-center justify-between border-b border-surface-border-subtle pb-2.5">
                            <span className="text-xs font-bold text-ink-primary">
                              Status nos canais de venda
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {productSyncStatus === 'saving' ? 'Atualizando...' : 'Sincronizado'}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {/* iFood */}
                            <div className="flex items-center justify-between rounded-lg border border-surface-border-subtle bg-surface-raised p-2.5 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                                  iFood
                                </span>
                                <span className="font-mono font-bold text-ink-primary">
                                  {productSimPrice}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                <span>{productSyncStatus === 'saving' ? 'Enviando' : 'Confirmado'}</span>
                              </span>
                            </div>

                            {/* 99Food */}
                            <div className="flex items-center justify-between rounded-lg border border-surface-border-subtle bg-surface-raised p-2.5 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  99Food
                                </span>
                                <span className="font-mono font-bold text-ink-primary">
                                  {productSimPrice}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                <span>{productSyncStatus === 'saving' ? 'Enviando' : 'Confirmado'}</span>
                              </span>
                            </div>

                            {/* Rappi */}
                            <div className="flex items-center justify-between rounded-lg border border-surface-border-subtle bg-surface-raised p-2.5 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="rounded bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                  Rappi
                                </span>
                                <span className="font-mono font-bold text-ink-primary">
                                  {productSimPrice}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                <span>{productSyncStatus === 'saving' ? 'Enviando' : 'Confirmado'}</span>
                              </span>
                            </div>

                            {/* Keeta */}
                            <div className="flex items-center justify-between rounded-lg border border-surface-border-subtle bg-surface-raised p-2.5 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                  Keeta
                                </span>
                                <span className="font-mono font-bold text-ink-primary">
                                  {productSimPrice}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                <span>{productSyncStatus === 'saving' ? 'Enviando' : 'Confirmado'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-surface-border-subtle pt-3 text-[11px] text-ink-tertiary">
                          <span>Status: <strong>Valores atualizados em todas as lojas</strong></span>
                          <span>4 canais sincronizados</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3.1. PLATAFORMAS CONECTADAS (Logo após a demonstração)
          ===================================================================== */}
      <section id="plataformas" className="border-b border-surface-border-subtle bg-surface-raised/40 py-16">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
              Integração Direta
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
              Conecte os canais que você já utiliza
            </h2>
            <p className="mt-2 text-xs text-ink-secondary sm:text-sm">
              Trabalhe com as principais plataformas do mercado sem mudar o fluxo que seus clientes já conhecem.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {/* iFood */}
            <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img
                  src="/platforms/ifood.png"
                  alt="iFood"
                  className="h-full w-full object-contain rounded-full drop-shadow-sm"
                />
              </div>
              <p className="text-sm font-bold text-ink-primary">iFood</p>
            </div>

            {/* Rappi */}
            <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img
                  src="/platforms/rappi.png"
                  alt="Rappi"
                  className="h-full w-full object-contain rounded-full drop-shadow-sm"
                />
              </div>
              <p className="text-sm font-bold text-ink-primary">Rappi</p>
            </div>

            {/* 99Food */}
            <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img
                  src="/platforms/99food.png"
                  alt="99Food"
                  className="h-full w-full object-contain rounded-full drop-shadow-sm"
                />
              </div>
              <p className="text-sm font-bold text-ink-primary">99Food</p>
            </div>

            {/* Aiqfome */}
            <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img
                  src="/platforms/aiqfome.png"
                  alt="Aiqfome"
                  className="h-full w-full object-contain rounded-full drop-shadow-sm"
                />
              </div>
              <p className="text-sm font-bold text-ink-primary">Aiqfome</p>
            </div>

            {/* Keeta */}
            <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img
                  src="/platforms/keeta.png"
                  alt="Keeta"
                  className="h-full w-full object-contain rounded-full drop-shadow-sm"
                />
              </div>
              <p className="text-sm font-bold text-ink-primary">Keeta</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. SEÇÃO DE PROBLEMA (Antes vs Depois)
          ===================================================================== */}
      <section className="border-b border-surface-border-subtle bg-surface-raised/30 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
              A Realidade Operacional
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              Sua equipe ainda precisa acompanhar vários aplicativos ao mesmo tempo?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary sm:text-base">
              Veja a diferença que a centralização traz para a rotina diária da sua cozinha e do seu balcão.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* ANTES */}
            <div className="rounded-2xl border border-red-500/20 bg-surface-raised p-6 shadow-sm md:p-8">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-500">
                  ✕
                </span>
                <h3 className="text-lg font-bold text-ink-primary">ANTES</h3>
              </div>

              <div className="mt-6 space-y-3.5">
                <div className="flex items-start gap-3 rounded-lg border border-surface-border-subtle bg-surface-base p-3.5 text-xs">
                  <TabletIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-bold text-ink-primary">Tablet iFood, Tablet Rappi, Tablet 99Food e WhatsApp</p>
                    <p className="mt-0.5 text-ink-secondary">Vários aparelhos ocupando espaço no balcão e carregadores espalhados.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-surface-border-subtle bg-surface-base p-3.5 text-xs">
                  <BellOffIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-bold text-ink-primary">Múltiplas notificações apitando ao mesmo tempo</p>
                    <p className="mt-0.5 text-ink-secondary">Barulho constante, alertas ignorados e pedidos que passam despercebidos.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-surface-border-subtle bg-surface-base p-3.5 text-xs">
                  <ShuffleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-bold text-ink-primary">Confusão operacional e pedidos espalhados</p>
                    <p className="mt-0.5 text-ink-secondary">A cozinha não sabe qual pedido preparar primeiro e os atrasos acumulam.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-surface-border-subtle bg-surface-base p-3.5 text-xs">
                  <UserXIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-bold text-ink-primary">Equipe perdida e estressada no horário de pico</p>
                    <p className="mt-0.5 text-ink-secondary">Erros de digitação, cancelamentos de clientes e insatisfação no salão.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* DEPOIS */}
            <div className="rounded-2xl border border-emerald-500/30 bg-surface-raised p-6 shadow-sm md:p-8">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-500">
                  ✓
                </span>
                <h3 className="text-lg font-bold text-ink-primary">DEPOIS (Com o DeliveryHub)</h3>
              </div>

              <div className="mt-6 space-y-3.5">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-surface-base p-3.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-bold text-ink-primary">Uma única tela para todos os canais</p>
                    <p className="mt-0.5 text-ink-secondary">Elimine os múltiplos aparelhos do balcão e opere com foco total.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-surface-base p-3.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-bold text-ink-primary">Tudo centralizado e em ordem de chegada</p>
                    <p className="mt-0.5 text-ink-secondary">Cada pedido novo entra direto na fila correta com identificação de canal.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-surface-base p-3.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-bold text-ink-primary">Equipe organizada e cozinha alinhada</p>
                    <p className="mt-0.5 text-ink-secondary">Visão clara do que está aguardando, em preparo ou pronto para expedição.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-surface-base p-3.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-bold text-ink-primary">Operação mais rápida e sem cancelamentos</p>
                    <p className="mt-0.5 text-ink-secondary">Mais agilidade na entrega, clientes satisfeitos e equipe trabalhando em paz.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. BENEFÍCIOS OPERACIONAIS (Para a Rotina Real do Restaurante)
          ===================================================================== */}
      <section id="beneficios" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
            Para a Rotina do Restaurante
          </span>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl lg:text-4xl">
            Menos aparelhos no caixa. Zero pedidos perdidos na cozinha.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary sm:text-base">
            Desenvolvido para aguentar o ritmo do horário de pico de quem vende delivery todos os dias.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Balcão e Caixa */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <Package className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Balcão e Caixa
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                Um único painel para receber pedidos de todos os aplicativos
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Substitua os vários tablets, celulares e cabos espalhados no balcão por uma única tela. Os pedidos do iFood, 99Food, Rappi, Aiqfome e Keeta tocam no mesmo alerta sonoro e caem na mesma lista, prontos para aceite imediato.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Elimina múltiplos aparelhos e notificações desencontradas</span>
            </div>
          </div>

          {/* Card 2: Cozinha e Impressão Térmica */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <Printer className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Comanda Automática
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                O pedido sai impresso na cozinha sem ninguém redigitar
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Assim que o pedido é confirmado, a impressora térmica da cozinha já emite a comanda com todos os adicionais e observações destacadas (como ponto da carne e sem cebola). Acaba o erro de digitação e a chapa não perde tempo.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Compatível com impressoras térmicas Epson, Elgin e Bematech</span>
            </div>
          </div>

          {/* Card 3: Cardápio e Preços */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Preços e Cardápio
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                Altere preços, itens e fotos uma única vez
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Precisa reajustar valores ou lançar uma promoção de combo? Você faz a alteração uma só vez no DeliveryHub e ela entra em vigor em todos os aplicativos conectados, sem precisar abrir 4 ou 5 portais de parceiros.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Cardápio padronizado em todos os canais de venda</span>
            </div>
          </div>

          {/* Card 4: Falta de Insumo e Pausa de Prato */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Pausa de Estoque
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                Acabou um ingrediente? Pause antes de gerar cancelamento
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Se a embalagem ou um insumo principal acabar no pico de sábado, pause o prato com 1 clique. O item sai do ar na hora em todos os canais, impedindo pedidos com itens em falta que derrubam a sua nota de avaliação.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Protege sua nota e reputação de Super Restaurante</span>
            </div>
          </div>

          {/* Card 5: Fila e Expedição */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Fila de Cozinha
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                A cozinha sabe exatamente o que preparar primeiro
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Pedidos organizados por ordem cronológica e tempo de espera. Quem está na chapa, forno ou montagem visualiza a prioridade exata de preparo, permitindo embalar o pacote antes do motoboy buzinar na porta.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Ritmo constante de produção sem tumulto na expedição</span>
            </div>
          </div>

          {/* Card 6: Fechamento de Caixa */}
          <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF6B00]/25 bg-[#FF6B00]/10 text-[#FF6B00] shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-surface-border-subtle bg-surface-base px-2.5 py-0.5 text-[11px] font-semibold text-ink-tertiary">
                  Fechamento de Caixa
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-primary">
                Feche o caixa do dia sem somar papelzinho de comanda
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Acompanhe quanto o restaurante faturou em cada parceiro, confira as taxas descontadas pelos marketplaces e veja o valor líquido estimado por canal. Fechamento de turno rápido, sem conferência manual de papel.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 border-t border-surface-border-subtle pt-3 text-[11px] font-medium text-ink-tertiary">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Visão clara de faturamento bruto, taxas e líquido diário</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. SEÇÃO DE IMPACTO OPERACIONAL (Métricas Reais de Restaurante)
          ===================================================================== */}
      <section className="border-t border-surface-border-subtle mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-sm md:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
              Impacto Operacional
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
              O que muda na rotina real do seu restaurante
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary sm:text-sm">
              Economia de tempo no caixa, menos estresse no horário de pico e pedidos saindo no ritmo certo para a entrega.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Métrica 1 */}
            <div className="flex flex-col justify-between rounded-xl border border-surface-border-subtle bg-surface-base p-5 text-center transition-all hover:border-[#FF6B00]/30 hover:shadow-sm">
              <div>
                <p className="text-3xl font-extrabold text-[#FF6B00] tabular-nums sm:text-4xl">
                  &lt; 30 seg
                </p>
                <p className="mt-2 text-sm font-bold text-ink-primary">
                  Impressão direta na cozinha
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  O pedido é confirmado e a comanda já sai na chapa em segundos, sem ninguém no caixa precisar redigitar na mão.
                </p>
              </div>
              <div className="mt-4 border-t border-surface-border-subtle pt-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Fim do retrabalho de anotação
              </div>
            </div>

            {/* Métrica 2 */}
            <div className="flex flex-col justify-between rounded-xl border border-surface-border-subtle bg-surface-base p-5 text-center transition-all hover:border-[#FF6B00]/30 hover:shadow-sm">
              <div>
                <p className="text-3xl font-extrabold text-[#FF6B00] tabular-nums sm:text-4xl">
                  Até 2h / dia
                </p>
                <p className="mt-2 text-sm font-bold text-ink-primary">
                  Economia de tempo no caixa
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  Menos tempo alternando aparelhos, conferindo pedidos duplicados e fechando o turno com papéis espalhados.
                </p>
              </div>
              <div className="mt-4 border-t border-surface-border-subtle pt-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Mais foco na preparação dos pratos
              </div>
            </div>

            {/* Métrica 3 */}
            <div className="flex flex-col justify-between rounded-xl border border-surface-border-subtle bg-surface-base p-5 text-center transition-all hover:border-[#FF6B00]/30 hover:shadow-sm">
              <div>
                <p className="text-3xl font-extrabold text-[#FF6B00] tabular-nums sm:text-4xl">
                  Zero
                </p>
                <p className="mt-2 text-sm font-bold text-ink-primary">
                  Comandas perdidas no balcão
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  Cada pedido novo entra direto na fila única com as observações do cliente destacadas, evitando prato errado e atraso.
                </p>
              </div>
              <div className="mt-4 border-t border-surface-border-subtle pt-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Menos cancelamentos no delivery
              </div>
            </div>

            {/* Métrica 4 */}
            <div className="flex flex-col justify-between rounded-xl border border-surface-border-subtle bg-surface-base p-5 text-center transition-all hover:border-[#FF6B00]/30 hover:shadow-sm">
              <div>
                <p className="text-3xl font-extrabold text-[#FF6B00] tabular-nums sm:text-4xl">
                  5 em 1
                </p>
                <p className="mt-2 text-sm font-bold text-ink-primary">
                  Canais de venda unificados
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  iFood, Rappi, 99Food, Aiqfome e Keeta integrados na mesma tela, com cardápio e preços sincronizados.
                </p>
              </div>
              <div className="mt-4 border-t border-surface-border-subtle pt-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Uma só tela no caixa ou na bancada
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. PREÇOS (3 Planos Profissionais: Mensal, Anual e Recorrente)
          ===================================================================== */}
      <section id="precos" className="border-t border-surface-border-subtle bg-surface-raised/30 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
              Planos e Assinatura
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl lg:text-4xl">
              Escolha o plano ideal para a sua operação
            </h2>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
              Sem comissões sobre suas vendas, sem taxas escondidas e com 14 dias de teste grátis para começar.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
            {/* PLANO 1: MENSAL (OPERACIONAL FLEXÍVEL) */}
            <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all hover:border-surface-border-strong sm:p-8">
              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-ink-primary">
                    Plano Mensal
                  </h3>
                  <span className="rounded-md border border-surface-border-subtle bg-surface-base px-2.5 py-1 text-[11px] font-semibold text-ink-tertiary">
                    Sem fidelidade
                  </span>
                </div>
                <p className="mt-2 min-h-[38px] text-xs leading-relaxed text-ink-secondary">
                  Para restaurantes que preferem flexibilidade mês a mês, sem compromisso de longo prazo.
                </p>

                {/* Bloco de Preço Equalizado */}
                <div className="mt-6 border-b border-surface-border-subtle pb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight tabular-nums text-ink-primary sm:text-5xl">
                      R$ 149
                    </span>
                    <span className="text-xs font-semibold text-ink-tertiary">/mês</span>
                  </div>
                  <p className="mt-1.5 h-5 text-xs text-ink-tertiary">
                    Cobrança mensal no Pix, boleto ou cartão
                  </p>
                  <div className="mt-2.5 flex h-7 items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border-subtle bg-surface-base px-2.5 py-1 text-xs font-medium text-ink-secondary">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Cancele quando quiser sem multa</span>
                    </span>
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                    Recursos inclusos:
                  </p>
                  <ul className="mt-4 space-y-3 text-xs text-ink-secondary sm:text-sm">
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Recepção de pedidos de todos os canais (iFood, 99Food, Rappi, Aiqfome e Keeta)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Fila única de pedidos com ordem cronológica de chegada</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Cardápio único com atualização de preços sincronizada</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Pausa imediata de itens com estoque esgotado</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Impressão automática de comandas na cozinha e balcão</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Relatório operacional diário de vendas por canal</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Suporte em horário comercial por WhatsApp e chat</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="mt-8 border-t border-surface-border-subtle pt-6">
                <Link
                  href={r('/signup')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-base py-3 text-sm font-bold text-ink-primary transition-colors hover:border-surface-border-strong hover:bg-surface-raised active:scale-[0.99]"
                >
                  <span>Criar conta</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-2.5 text-center text-[11px] text-ink-tertiary">
                  14 dias de teste grátis · Cancele quando quiser
                </p>
              </div>
            </div>

            {/* PLANO 2: ANUAL (O MAIS VANTAJOSO E LUCRATIVO - NO MEIO, ELEVADO À FRENTE) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#FF6B00] bg-surface-raised p-6 shadow-2xl shadow-[#FF6B00]/15 sm:p-8 lg:-translate-y-4 lg:scale-[1.03]">
              {/* Badge Superior Flutuante */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#FF6B00] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                Mais Escolhido · Maior Economia
              </div>

              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-ink-primary">
                    Plano Anual
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    4 meses grátis
                  </span>
                </div>
                <p className="mt-2 min-h-[38px] text-xs leading-relaxed text-ink-secondary">
                  Para restaurantes que buscam máxima estabilidade, suporte prioritário e o melhor custo-benefício.
                </p>

                {/* Bloco de Preço Equalizado */}
                <div className="mt-6 border-b border-surface-border-subtle pb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight tabular-nums text-ink-primary sm:text-5xl">
                      R$ 99
                    </span>
                    <span className="text-xs font-semibold text-ink-tertiary">/mês</span>
                  </div>
                  <p className="mt-1.5 h-5 text-xs text-ink-tertiary">
                    12x de R$ 99 no cartão ou R$ 1.188/ano à vista
                  </p>
                  <div className="mt-2.5 flex h-7 items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Economia direta de R$ 600 por ano</span>
                    </span>
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FF6B00]">
                    Tudo do Plano Mensal, e mais:
                  </p>
                  <ul className="mt-4 space-y-3 text-xs text-ink-secondary sm:text-sm">
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="font-semibold text-ink-primary">Preço travado por 1 ano sem nenhum reajuste</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="font-semibold text-ink-primary">Implantação prioritária em até 24h com especialista</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span>Treinamento completo ao vivo para a equipe de caixa e cozinha</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span>KDS digital para cozinha (tela de pedidos em tablet ou monitor)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span>Relatórios avançados de faturamento líquido e taxas por canal</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="font-semibold text-ink-primary">Suporte prioritário VIP no WhatsApp inclusive no pico</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#C2410C] dark:text-[#FF6B00]">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span>Consultoria de padronização de cardápio entre as plataformas</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="mt-8 border-t border-surface-border-subtle pt-6">
                <Link
                  href={r('/signup')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] py-3.5 text-sm sm:text-base font-bold text-white shadow-md transition-all hover:bg-[#E85F00] hover:shadow-lg active:scale-[0.99]"
                >
                  <span>Criar conta no Anual</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-2.5 text-center text-[11px] text-ink-tertiary">
                  14 dias de teste grátis · Sem taxa de adesão
                </p>
              </div>
            </div>

            {/* PLANO 3: RECORRENTE (ASSINATURA NO CARTÃO) */}
            <div className="flex flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm transition-all hover:border-surface-border-strong sm:p-8">
              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-ink-primary">
                    Plano Recorrente
                  </h3>
                  <span className="rounded-md border border-surface-border-subtle bg-surface-base px-2.5 py-1 text-[11px] font-semibold text-ink-tertiary">
                    Semestral
                  </span>
                </div>
                <p className="mt-2 min-h-[38px] text-xs leading-relaxed text-ink-secondary">
                  Cobrança automática no cartão com desconto garantido e sem travar o limite total.
                </p>

                {/* Bloco de Preço Equalizado */}
                <div className="mt-6 border-b border-surface-border-subtle pb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight tabular-nums text-ink-primary sm:text-5xl">
                      R$ 129
                    </span>
                    <span className="text-xs font-semibold text-ink-tertiary">/mês</span>
                  </div>
                  <p className="mt-1.5 h-5 text-xs text-ink-tertiary">
                    Débito automático mensal em ciclo de 6 meses
                  </p>
                  <div className="mt-2.5 flex h-7 items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Economize R$ 240 por ano</span>
                    </span>
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                    Recursos inclusos:
                  </p>
                  <ul className="mt-4 space-y-3 text-xs text-ink-secondary sm:text-sm">
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Recepção centralizada de todos os canais de venda</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Fila de pedidos em tempo real com controle de status</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Cardápio único com sincronização automática de preços</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Pausa de produtos esgotados em todos os canais</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Impressão automática de comandas na chapa e no bar</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Relatórios consolidados semanais de faturamento por app</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[2.5]" />
                      <span>Suporte técnico contínuo por WhatsApp e chamado</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="mt-8 border-t border-surface-border-subtle pt-6">
                <Link
                  href={r('/signup')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-base py-3 text-sm font-bold text-ink-primary transition-colors hover:border-surface-border-strong hover:bg-surface-raised active:scale-[0.99]"
                >
                  <span>Criar conta</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-2.5 text-center text-[11px] text-ink-tertiary">
                  14 dias de teste grátis · Renovação automática
                </p>
              </div>
            </div>
          </div>

          {/* Formas de Pagamento e Garantias Comerciais (100% Alinhado e Profissional) */}
          <div className="mt-12 rounded-2xl border border-surface-border bg-surface-raised p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Formas de pagamento */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mr-1">
                  Pagamento:
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink-primary">
                  <QrCode className="h-3.5 w-3.5 text-[#FF6B00]" />
                  Pix
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink-primary">
                  <CreditCard className="h-3.5 w-3.5 text-[#FF6B00]" />
                  Cartão de Crédito
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink-primary">
                  <CreditCard className="h-3.5 w-3.5 text-[#FF6B00]" />
                  Débito
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink-primary">
                  <FileText className="h-3.5 w-3.5 text-[#FF6B00]" />
                  Boleto
                </span>
              </div>

              {/* Garantias comerciais com alinhamento perfeito */}
              <div className="flex flex-wrap items-center justify-center gap-6 border-t border-surface-border-subtle pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-ink-primary">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Zero comissão sobre vendas</span>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-bold text-ink-primary">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Sem taxa de adesão</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          9. FAQ (Perguntas Frequentes)
          ===================================================================== */}
      <section id="faq" className="border-t border-surface-border-subtle py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
              Tire Suas Dúvidas
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
              Perguntas frequentes
            </h2>
            <p className="mt-2 text-xs text-ink-secondary sm:text-sm">
              Respostas diretas sobre o funcionamento operacional, integrações e condições do DeliveryHub.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.q}
                  className="rounded-xl border border-surface-border bg-surface-raised transition-all shadow-sm hover:border-surface-border-strong"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left text-sm font-semibold text-ink-primary hover:bg-surface-overlay/30 rounded-xl transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#C2410C] dark:text-[#FF6B00]' : ''
                        }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-surface-border-subtle px-5 pt-3 pb-5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BANNER FINAL DE CONVERSÃO
          ===================================================================== */}
      <section className="border-t border-surface-border-subtle bg-surface-raised/40 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-sm md:p-12">
            {/* Brilho radial sutil de acabamento */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-[#FF6B00]/10 blur-3xl" />

            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C] dark:text-[#FF6B00]">
                Pronto para Começar
              </span>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl lg:text-4xl">
                Centralize seus canais de delivery e organize a sua cozinha
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary sm:text-base">
                Receba todos os pedidos em uma única fila, elimine a digitação manual de comandas e mantenha seus preços e cardápios sempre sincronizados.
              </p>

              {/* Botões de Ação */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                <Link
                  href={r('/signup')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#FF6B00]/20 transition-all hover:bg-[#E85F00] hover:shadow-lg active:scale-[0.99] sm:w-auto"
                >
                  <span>Criar conta</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#demonstracao"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-base px-6 py-3.5 text-sm font-semibold text-ink-primary transition-colors hover:border-surface-border-strong hover:bg-surface-raised sm:w-auto"
                >
                  Ver sistema funcionando
                </a>
              </div>

              {/* 4 Garantias Perfeitamente Alinhadas (2x2 no mobile, 4 colunas no desktop) */}
              <div className="mt-10 border-t border-surface-border-subtle pt-6">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 sm:grid-cols-4 sm:gap-4">
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink-secondary">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </div>
                    <span>14 dias grátis</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink-secondary">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </div>
                    <span>Sem taxa de adesão</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink-secondary">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </div>
                    <span>Implantação em até 24h</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink-secondary">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </div>
                    <span>Cancele quando quiser</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          11. FOOTER
          ===================================================================== */}
      <footer className="border-t border-surface-border-subtle bg-surface-base py-10">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <span className="text-xs text-ink-tertiary">
                © {new Date().getFullYear()} DeliveryHub. Todos os direitos reservados.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-ink-secondary">
              <a href="#plataformas" className="hover:text-ink-primary transition-colors">
                Plataformas
              </a>
              <a href="#beneficios" className="hover:text-ink-primary transition-colors">
                Benefícios
              </a>
              <a href="#precos" className="hover:text-ink-primary transition-colors">
                Preços
              </a>
              <a href="#faq" className="hover:text-ink-primary transition-colors">
                FAQ
              </a>
              <Link href={r('/login')} className="hover:text-ink-primary transition-colors">
                Entrar
              </Link>
              <Link
                href={r('/termos')}
                onClick={(e) => {
                  e.preventDefault();
                  setLegalModalDoc('termos');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '#termos');
                  }
                }}
                className="text-ink-tertiary hover:text-ink-secondary transition-colors"
              >
                Termos de Uso
              </Link>
              <Link
                href={r('/privacidade')}
                onClick={(e) => {
                  e.preventDefault();
                  setLegalModalDoc('privacidade');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '#privacidade');
                  }
                }}
                className="text-ink-tertiary hover:text-ink-secondary transition-colors"
              >
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          12. MODAL DE DOCUMENTOS LEGAIS (PADRÃO CORPORATIVO DE ALTA CREDIBILIDADE)
          ===================================================================== */}
      {legalModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl overflow-hidden">
            {/* Modal Topbar / Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface-base px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-surface-raised p-1 border border-surface-border-subtle shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setLegalModalDoc('termos');
                      if (typeof window !== 'undefined') {
                        window.history.replaceState(null, '', '#termos');
                      }
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${legalModalDoc === 'termos'
                        ? 'bg-[#FF6B00] text-white shadow-sm'
                        : 'text-ink-secondary hover:text-ink-primary'
                      }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Termos de Uso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLegalModalDoc('privacidade');
                      if (typeof window !== 'undefined') {
                        window.history.replaceState(null, '', '#privacidade');
                      }
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${legalModalDoc === 'privacidade'
                        ? 'bg-[#FF6B00] text-white shadow-sm'
                        : 'text-ink-secondary hover:text-ink-primary'
                      }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Política de Privacidade (LGPD)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="hidden items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary sm:inline-flex"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir</span>
                </button>

                <Link
                  href={r(legalModalDoc === 'termos' ? '/termos' : '/privacidade')}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
                >
                  <span>Página inteira</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>

                <button
                  type="button"
                  onClick={closeLegalModal}
                  className="rounded-lg p-1.5 text-ink-tertiary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto px-6 py-6 text-xs sm:text-sm leading-relaxed text-ink-secondary space-y-8">
              {legalModalDoc === 'termos' ? (
                <div className="space-y-8">
                  {/* Header Title Box */}
                  <div>
                    <h2 className="text-xl font-extrabold text-ink-primary sm:text-2xl">
                      Termos e Condições Gerais de Uso da Plataforma
                    </h2>
                    <p className="mt-1 text-xs text-ink-secondary">
                      Contrato de Licenciamento de Software como Serviço (SaaS) para Restaurantes, Bares e Dark Kitchens
                    </p>
                  </div>

                  {/* Operational Summary Box */}
                  <div className="rounded-2xl border border-surface-border bg-surface-base p-5 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                      Garantias Operacionais em Linguagem Clara
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span><strong>Zero taxa sobre vendas:</strong> Assinatura mensal fixa (R$ 149/mês). Não cobramos porcentagem dos seus pedidos.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span><strong>Cancelamento livre a 1 clique:</strong> Sem fidelidade, sem carência e sem multas contratuais.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span><strong>Integrações oficiais:</strong> Conexão segura via OAuth com iFood, Rappi e 99Food.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span><strong>SLA Garantido:</strong> 99,5% de disponibilidade com monitoramento contínuo.</span>
                      </div>
                    </div>
                  </div>

                  {/* Clauses */}
                  <div className="space-y-6 divide-y divide-surface-border-subtle">
                    <div className="space-y-2 pt-4 first:pt-0">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 1ª</span>
                        <span>DAS DEFINIÇÕES, NATUREZA DO SERVIÇO E OBJETO</span>
                      </div>
                      <p>
                        O presente instrumento regula o licenciamento temporário, não exclusivo e intransferível do software <strong>DeliveryHub</strong>, de propriedade e operação da DeliveryHub Tecnologia. O sistema provê unificação de filas de pedidos, KDS (Kitchen Display System), sincronização de cardápios e conciliação de faturamento. <strong>O DeliveryHub não realiza entrega física, não intermedeia frete e não fornece entregadores</strong>, sendo a logística de transporte de responsabilidade exclusiva do Estabelecimento ou do marketplace parceiro.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 2ª</span>
                        <span>DO CADASTRO, ACESSO E GUARDA DE CREDENCIAIS</span>
                      </div>
                      <p>
                        O Usuário declara ser representante legal do Estabelecimento e obriga-se a fornecer dados verídicos e atualizados. As credenciais de acesso (login e senha) são confidenciais e intransferíveis, respondendo o Estabelecimento por todas as operações executadas sob sua conta.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 3ª</span>
                        <span>DAS INTEGRAÇÕES COM MARKETPLACES (iFood, Rappi, 99Food)</span>
                      </div>
                      <p>
                        As integrações operam via APIs oficiais e protocolo OAuth 2.0 autorizados pelo Estabelecimento. O DeliveryHub não possui ingerência sobre políticas comerciais, taxas percentuais ou bloqueios efetuados diretamente pelos marketplaces contra o restaurante.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 4ª</span>
                        <span>DAS OBRIGAÇÕES E RESPONSABILIDADES DO ESTABELECIMENTO</span>
                      </div>
                      <p>
                        O Estabelecimento é o único responsável pela higiene, preparo, manipulação, conservação e qualidade sanitária dos alimentos comercializados, bem como pela exatidão das informações de alérgenos, preços no cardápio e atendimento de reclamações perante o consumidor final (Código de Defesa do Consumidor).
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 5ª</span>
                        <span>DA PRECIFICAÇÃO FIXA (R$ 149/MÊS) E RESCISÃO SEM MULTA</span>
                      </div>
                      <p>
                        A assinatura mensal é fixa no valor de <strong>R$ 149,00/mês</strong> por loja, sem qualquer comissão sobre vendas. Novos clientes dispõem de 14 dias de teste grátis. A assinatura pode ser cancelada a qualquer momento nas configurações do sistema, sem cobrança de multas ou período de fidelidade obrigatório.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 6ª</span>
                        <span>DA DISPONIBILIDADE E NÍVEL DE SERVIÇO (SLA DE 99,5%)</span>
                      </div>
                      <p>
                        O DeliveryHub assegura disponibilidade mensal de 99,5%, ressalvadas manutenções programadas comunicadas com antecedência mínima de 24h e eventos de força maior ou instabilidade comprovada em provedores públicos de telecomunicações.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 7ª</span>
                        <span>DA PROPRIEDADE INTELECTUAL E DIREITOS DE SOFTWARE</span>
                      </div>
                      <p>
                        Todo o código-fonte, layout, marcas e algoritmos pertencem exclusivamente à DeliveryHub Tecnologia Ltda. (Lei nº 9.609/1998 e Lei nº 9.610/1998), sendo terminantemente vedada a cópia, engenharia reversa ou sublicenciamento a terceiros.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 8ª</span>
                        <span>DA PROTEÇÃO DE DADOS (LGPD) E CONFIDENCIALIDADE</span>
                      </div>
                      <p>
                        O Estabelecimento atua como Controlador dos dados dos consumidores finais de pedidos. O DeliveryHub atua como Operador técnico, tratando dados sob isolamento multi-tenant e criptografia simétrica AES-256-GCM.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 9ª</span>
                        <span>DA LIMITAÇÃO DE RESPONSABILIDADE OPERACIONAL</span>
                      </div>
                      <p>
                        O DeliveryHub não responde por lucros cessantes, atrasos na expedição da cozinha ou falhas de conexão de internet do estabelecimento. A responsabilidade indenizatória total limita-se ao valor acumulado pago pelo restaurante nos últimos 3 meses de assinatura.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">CLÁUSULA 10ª</span>
                        <span>DA VIGÊNCIA E FORO DE ELEIÇÃO</span>
                      </div>
                      <p>
                        Este contrato é regido pelas leis da República Federativa do Brasil, elegendo-se o Foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias judiciais.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Header Title Box */}
                  <div>
                    <h2 className="text-xl font-extrabold text-ink-primary sm:text-2xl">
                      Política de Privacidade e Governança de Dados
                    </h2>
                    <p className="mt-1 text-xs text-ink-secondary">
                      Diretrizes de Tratamento, Armazenamento e Criptografia em Conformidade com a LGPD
                    </p>
                  </div>

                  {/* Architecture Pillars */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
                      <div className="flex items-center gap-1.5 font-bold text-ink-primary text-xs">
                        <Lock className="h-4 w-4 text-blue-500" />
                        Criptografia AES-256-GCM
                      </div>
                      <p className="mt-1 text-[11px] text-ink-secondary leading-relaxed">
                        Dados sensíveis de clientes de pedidos são criptografados em repouso no banco de dados.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
                      <div className="flex items-center gap-1.5 font-bold text-ink-primary text-xs">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Multi-Tenant Estrito
                      </div>
                      <p className="mt-1 text-[11px] text-ink-secondary leading-relaxed">
                        Chave única de organização. Um restaurante jamais tem acesso a dados de outro.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
                      <div className="flex items-center gap-1.5 font-bold text-ink-primary text-xs">
                        <CheckCircle2 className="h-4 w-4 text-[#FF6B00]" />
                        Sem Venda de Dados
                      </div>
                      <p className="mt-1 text-[11px] text-ink-secondary leading-relaxed">
                        Não comercializamos relatórios de vendas ou listas de clientes com terceiros.
                      </p>
                    </div>
                  </div>

                  {/* Privacy Sections */}
                  <div className="space-y-6 divide-y divide-surface-border-subtle">
                    <div className="space-y-2 pt-4 first:pt-0">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 1</span>
                        <span>INTRODUÇÃO E PRINCÍPIOS DA LGPD</span>
                      </div>
                      <p>
                        A DeliveryHub Tecnologia atua com estrita observância aos princípios da finalidade, necessidade, transparência e segurança (art. 6º da Lei nº 13.709/2018). Esta política rege o ciclo de vida de dados pessoais tratados na plataforma.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 2</span>
                        <span>DELIMITAÇÃO DE PAPÉIS: CONTROLADOR VS. OPERADOR</span>
                      </div>
                      <p>
                        O <strong>Restaurante é o Controlador</strong> dos dados pessoais dos consumidores finais de pedidos. O <strong>DeliveryHub é o Operador</strong> técnico no processamento das filas da cozinha e no tráfego de webhooks com os canais parceiros, e Controlador unicamente dos dados cadastrais dos administradores do restaurante assinante.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 3</span>
                        <span>CATEGORIAS DE DADOS PESSOAIS TRATADOS</span>
                      </div>
                      <p>
                        Tratamos unicamente: (a) dados cadastrais da loja assinante (razão social, CNPJ ou CPF, e-mail, telefone); (b) dados operacionais de pedidos necessários para entrega (nome do cliente, telefone, endereço de entrega e itens); e (c) registros de conexão com endereço IP e data/hora (Marco Civil da Internet, art. 15).
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 4</span>
                        <span>BASES LEGAIS E FINALIDADES ESPECÍFICAS</span>
                      </div>
                      <p>
                        O tratamento fundamenta-se na Execução de Contrato (art. 7º, V - expedir pedidos e manter KDS), Cumprimento de Obrigação Legal (art. 7º, II - guarda de logs por 6 meses e emissão fiscal) e Legítimo Interesse (art. 7º, IX - segurança e prevenção a fraudes).
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 5</span>
                        <span>SEGURANÇA DA INFORMAÇÃO E CRIPTOGRAFIA (AES-256 E TLS 1.3)</span>
                      </div>
                      <p>
                        Aplicamos tráfego criptografado TLS 1.3 ponta a ponta e cifragem simétrica <strong>AES-256-GCM</strong> para dados sensíveis em repouso no PostgreSQL. Senhas de acesso são armazenadas sob funções de dispersão criptográfica irreversíveis (hashes seguros).
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 6</span>
                        <span>RETENÇÃO, PURGE E EXCLUSÃO DEFINITIVA</span>
                      </div>
                      <p>
                        Após rescisão de contrato, o restaurante pode exportar seus dados. Dados de clientes finais de pedidos são eliminados ou anonimizados em até 90 dias, resguardados os prazos legais de guarda tributária e de conexão.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-primary">
                        <span className="rounded bg-surface-base border border-surface-border px-1.5 py-0.5">SEÇÃO 7</span>
                        <span>CANAL DE ATENDIMENTO E DIREITOS DO TITULAR (LGPD)</span>
                      </div>
                      <p>
                        Para exercer seus direitos de titularidade (art. 18 da LGPD), incluindo confirmação de tratamento, acesso, correção ou exclusão de dados pessoais, o titular ou administrador da loja pode registrar sua requisição diretamente através da Central de Suporte e Atendimento na plataforma DeliveryHub.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border bg-surface-base px-6 py-3.5">
              <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Segurança da Informação · Criptografia AES-256 e TLS 1.3 · Em conformidade com a LGPD</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeLegalModal}
                  className="rounded-lg bg-surface-raised border border-surface-border px-5 py-2 text-xs font-bold text-ink-primary transition-colors hover:bg-surface-overlay"
                >
                  Fechar Documento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Helpers visuais para ícones do ANTES x DEPOIS
function TabletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function UserXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}
