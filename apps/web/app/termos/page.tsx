'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  ShieldCheck,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Logo } from '../../components/brand/logo';
import { ThemeToggle } from '../../components/layout/theme-toggle';

const SECTIONS = [
  { id: 'objeto', title: '1. Objeto e Definições' },
  { id: 'acesso', title: '2. Cadastro e Acesso' },
  { id: 'integracoes', title: '3. Marketplaces e APIs' },
  { id: 'responsabilidades', title: '4. Responsabilidade do Restaurante' },
  { id: 'precos', title: '5. Planos e Rescisão Sem Multa' },
  { id: 'sla', title: '6. Nível de Serviço (SLA 99,5%)' },
  { id: 'propriedade', title: '7. Propriedade Intelectual' },
  { id: 'lgpd', title: '8. Proteção de Dados (LGPD)' },
  { id: 'limitacao', title: '9. Limitação de Responsabilidade' },
  { id: 'foro', title: '10. Vigência e Foro de Eleição' },
];

export default function TermosPage() {
  const lastUpdated = '22 de setembro de 2026';

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary selection:bg-[#FF6B00] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-base/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={32} />
            </Link>
            <span className="hidden text-xs text-ink-tertiary sm:inline-block">
              / Governança & Contratos
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary sm:inline-flex"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / Salvar PDF
            </button>
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-overlay"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar à página inicial
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout with Sticky Sidebar Index */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Document Switcher Tabs */}
        <div className="mb-8 flex items-center gap-2 border-b border-surface-border">
          <Link
            href="/termos"
            className="inline-flex items-center gap-2 border-b-2 border-[#FF6B00] px-4 py-3 text-sm font-bold text-[#FF6B00]"
          >
            <FileText className="h-4 w-4" />
            <span>Termos de Uso</span>
          </Link>
          <Link
            href="/privacidade"
            className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:border-surface-border hover:text-ink-primary"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Política de Privacidade (LGPD)</span>
          </Link>
        </div>

        {/* Document Metadata Bar */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl text-ink-primary">
                Termos e Condições Gerais de Uso
              </h1>
              <p className="mt-1 text-xs text-ink-secondary">
                Contrato de Licenciamento de Software como Serviço (SaaS) para Estabelecimentos do Setor de Alimentação
              </p>
            </div>

            <div className="text-xs text-ink-tertiary md:text-right">
              <div>Última revisão formal: {lastUpdated}</div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Sticky Sidebar Index */}
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                  Índice de Cláusulas
                </h2>
                <nav className="mt-3 space-y-1">
                  {SECTIONS.map((sec) => (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
                    >
                      <span className="truncate font-medium">{sec.title}</span>
                      <ChevronRight className="h-3 w-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </nav>
              </div>

              {/* Security Seal Card */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-ink-primary">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Garantias Institucionais
                </div>
                <ul className="space-y-2 text-ink-secondary text-[11px]">
                  <li>✓ <strong>Sem taxa de comissão:</strong> Não retemos % do faturamento.</li>
                  <li>✓ <strong>Cancelamento a 1 clique:</strong> Sem fidelidade e sem multas.</li>
                  <li>✓ <strong>SLA Contratual:</strong> 99,5% de disponibilidade garantida.</li>
                  <li>✓ <strong>Conformidade LGPD:</strong> Segurança e privacidade de dados.</li>
                </ul>
                <div className="pt-2 border-t border-surface-border-subtle">
                  <Link
                    href="/privacidade"
                    className="font-bold text-[#FF6B00] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Ver Política de Privacidade</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Legal Text Body */}
          <div className="space-y-12 text-sm leading-relaxed text-ink-secondary lg:col-span-8">
            {/* Cláusula 1 */}
            <section id="objeto" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 1ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DAS DEFINIÇÕES, NATUREZA DO SERVIÇO E OBJETO
                </h2>
              </div>
              <p>
                <strong>1.1. Objeto Contratual:</strong> O presente Contrato regula a prestação de serviços de tecnologia por meio do licenciamento temporário, não exclusivo e intransferível do software <strong>DeliveryHub</strong>, de propriedade e operação exclusiva da <strong>DeliveryHub Tecnologia</strong>.
              </p>
              <p>
                <strong>1.2. Escopo Funcional:</strong> O DeliveryHub compreende uma plataforma de comando operacional destinada a restaurantes, lanchonetes, bares, pizzarias e cozinhas industriais ("Estabelecimentos Licenciados"), provendo a unificação de fila de pedidos recebidos via plataformas parceiras (iFood, Rappi, 99Food), mensageria (WhatsApp) e canais próprios, KDS (Kitchen Display System), sincronização de cardápios e conciliação de faturamento.
              </p>
              <p>
                <strong>1.3. Não Intermediação Logística:</strong> O DeliveryHub declara expressamente que <strong>não presta serviços de transporte, entrega de mercadorias, motofrete ou fornecimento de entregadores</strong>. A relação de transporte é pactuada exclusivamente pelo Estabelecimento diretamente com entregadores contratados ou através dos programas de logística proprietária dos marketplaces parceiros.
              </p>
            </section>

            {/* Cláusula 2 */}
            <section id="acesso" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 2ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DO CADASTRO, ACESSO E RESPONSABILIDADE DAS CREDENCIAIS
                </h2>
              </div>
              <p>
                <strong>2.1. Requisitos de Cadastro:</strong> Para usufruir da plataforma, o Usuário declara deter poderes de representação legal do Estabelecimento e obriga-se a fornecer informações verídicas, completas e atualizadas (Razão Social, CNPJ ou CPF, endereço de funcionamento e dados de contato dos administradores).
              </p>
              <p>
                <strong>2.2. Confidencialidade de Acesso:</strong> As credenciais de login (e-mail e senha) são de uso estritamente pessoal e intransferível do Estabelecimento. O Usuário é o único e exclusivo responsável por todas as operações efetuadas através de sua conta, cabendo-lhe comunicar imediatamente qualquer indício de comprometimento ou vazamento de suas senhas.
              </p>
            </section>

            {/* Cláusula 3 */}
            <section id="integracoes" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 3ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DAS INTEGRAÇÕES COM MARKETPLACES E APIS DE TERCEIROS
                </h2>
              </div>
              <p>
                <strong>3.1. Autorização de Integração:</strong> A comunicação entre o DeliveryHub e plataformas terceiras (iFood, Rappi, 99Food e afins) opera por meio de integrações oficiais, webhooks autenticados e protocolo seguro OAuth 2.0 expressamente autorizados pelo Estabelecimento em seus respectivos portais de parceiro.
              </p>
              <p>
                <strong>3.2. Independência Comercial:</strong> O Estabelecimento reconhece que o DeliveryHub não tem qualquer ingerência sobre as taxas de comissão percentuais, regras de ranqueamento, termos de homologação ou retenções financeiras aplicadas pelos marketplaces diretamente ao restaurante.
              </p>
              <p>
                <strong>3.3. Estabilidade de Terceiros:</strong> O DeliveryHub emprega arquitetura resiliente com reprocessamento assíncrono de eventos; contudo, não responde por instabilidades técnicas generalizadas, indisponibilidades das APIs externas ou suspensões de contas perpetradas diretamente pelas plataformas parceiras contra o restaurante.
              </p>
            </section>

            {/* Cláusula 4 */}
            <section id="responsabilidades" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 4ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DAS OBRIGAÇÕES E RESPONSABILIDADES DO ESTABELECIMENTO
                </h2>
              </div>
              <p>
                O Estabelecimento é o único e integral responsável por:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-secondary">
                <li>
                  <strong>Alimentos e Produtos:</strong> Procedência, higiene, manipulação sanitária, embalagem correta e integridade de todos os pratos comercializados aos clientes finais.
                </li>
                <li>
                  <strong>Informações de Cardápio:</strong> Exatidão das descrições dos itens, presença de alérgenos alimentares (glúten, lactose, frutos do mar) e preços finais de venda praticados em cada canal.
                </li>
                <li>
                  <strong>Atendimento e Relação de Consumo:</strong> Atendimento a solicitações de estorno, cancelamento, trocas e resolução de conflitos junto ao consumidor final nos termos do Código de Defesa do Consumidor (Lei nº 8.078/1990).
                </li>
              </ul>
            </section>

            {/* Cláusula 5 */}
            <section id="precos" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 5ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DO MODELO DE PRECIFICAÇÃO, ASSINATURA E RESCISÃO SEM MULTA
                </h2>
              </div>
              <p>
                <strong>5.1. Assinatura Fixa sem Comissão:</strong> O licenciamento da plataforma é contratado sob a modalidade de assinatura mensal pré-paga no valor fixo de <strong>R$ 149,00 (cento e quarenta e nove reais)</strong> por loja ativa. É expressamente vedada a cobrança de taxa de comissão percentual ou corretagem sobre os pedidos faturados pelo restaurante.
              </p>
              <p>
                <strong>5.2. Período de Avaliação (Free Trial):</strong> Novos clientes têm direito a 14 (quatorze) dias corridos de teste gratuito irrestrito da plataforma, sem necessidade de cadastramento de cartão de crédito para início da operação.
              </p>
              <p>
                <strong>5.3. Rescisão sem Multa:</strong> O Usuário poderá cancelar sua assinatura a qualquer momento através do painel de administração da plataforma. Não há cláusula de permanência mínima, fidelidade ou cobrança de multas rescisórias. O acesso permanecerá liberado até o encerramento do ciclo mensal já liquidado.
              </p>
            </section>

            {/* Cláusula 6 */}
            <section id="sla" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 6ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DO NÍVEL DE SERVIÇO (SLA DE 99,5%) E MANUTENÇÕES
                </h2>
              </div>
              <p>
                <strong>6.1. Meta de Disponibilidade:</strong> O DeliveryHub compromete-se com o índice de disponibilidade operacional mensal de <strong>99,5% (noventa e nove vírgula cinco por cento)</strong>, monitorado 24 horas por dia, 7 dias por semana por sistemas automatizados.
              </p>
              <p>
                <strong>6.2. Janelas de Manutenção:</strong> Interrupções preventivas ou melhorias de infraestrutura que possam impactar o acesso serão programadas prioritariamente em horários de menor volume operacional (madrugada) e comunicadas com antecedência mínima de 24 horas úteis.
              </p>
            </section>

            {/* Cláusula 7 */}
            <section id="propriedade" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 7ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DA PROPRIEDADE INTELECTUAL E PROTEÇÃO DE SOFTWARE
                </h2>
              </div>
              <p>
                <strong>7.1. Titularidade:</strong> A marca DeliveryHub, os logotipos, interfaces, algoritmos de cálculo, arquitetura de banco de dados e todo o código-fonte são de titularidade exclusiva da DeliveryHub Tecnologia Ltda., sendo protegidos pela Lei de Software (Lei nº 9.609/1998) e de Direitos Autorais (Lei nº 9.610/1998).
              </p>
              <p>
                <strong>7.2. Vedações:</strong> É vedado ao Estabelecimento copiar, modificar, distribuir, vender, sublicenciar ou praticar engenharia reversa sobre qualquer componente da aplicação, sob pena de rescisão imediata e sanções cíveis e penais cabíveis.
              </p>
            </section>

            {/* Cláusula 8 */}
            <section id="lgpd" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 8ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DA PROTEÇÃO DE DADOS (LGPD) E CONFIDENCIALIDADE
                </h2>
              </div>
              <p>
                <strong>8.1. Conformidade Estrita:</strong> As partes declaram total adequação à Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 - LGPD).
              </p>
              <p>
                <strong>8.2. Qualificação Jurídica:</strong> O Estabelecimento qualifica-se como <strong>Controlador</strong> dos dados pessoais dos consumidores finais dos pedidos. O DeliveryHub qualifica-se como <strong>Operador</strong>, tratando tais dados única e exclusivamente para viabilizar as ordens de serviço do restaurante, mediante aplicação de padrões rigorosos de segurança da informação com criptografia AES-256-GCM em repouso e tráfego seguro sob protocolo TLS 1.3.
              </p>
            </section>

            {/* Cláusula 9 */}
            <section id="limitacao" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 9ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DA LIMITAÇÃO DE RESPONSABILIDADE OPERACIONAL
                </h2>
              </div>
              <p>
                Em nenhum caso a DeliveryHub Tecnologia Ltda. responderá por lucros cessantes, perdas financeiras indiretas, cancelamentos de pedidos decorrentes de demora na expedição da cozinha ou falhas na conexão local de internet do restaurante. A responsabilidade indenizatória total da contratada limita-se ao montante total efetivamente pago pelo Estabelecimento nos últimos 3 (três) meses de assinatura.
              </p>
            </section>

            {/* Cláusula 10 */}
            <section id="foro" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  CLÁUSULA 10ª
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DA VIGÊNCIA, ATUALIZAÇÕES E FORO DE ELEIÇÃO
                </h2>
              </div>
              <p>
                <strong>10.1. Vigência e Atualizações:</strong> Este instrumento vigora por prazo indeterminado a partir do aceite digital no cadastro. O DeliveryHub notificará os Usuários com antecedência mínima de 15 dias sobre atualizações substanciais nestes termos.
              </p>
              <p>
                <strong>10.2. Foro de Eleição:</strong> Para dirimir qualquer controvérsia decorrente do presente contrato, as partes elegem expressamente o Foro da Comarca de São Paulo, Estado de São Paulo, renunciando a qualquer outro, por mais privilegiado que seja.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
