'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Printer,
  ChevronRight,
  Database,
  Server,
  FileCheck,
  FileText,
} from 'lucide-react';
import { Logo } from '../../components/brand/logo';
import { ThemeToggle } from '../../components/layout/theme-toggle';

const PRIVACY_SECTIONS = [
  { id: 'principios', title: '1. Princípios e Compromisso LGPD' },
  { id: 'papeis', title: '2. Controlador vs. Operador' },
  { id: 'dados', title: '3. Dados Pessoais Coletados' },
  { id: 'finalidades', title: '4. Bases Legais e Finalidades' },
  { id: 'seguranca', title: '5. Criptografia e Segurança (AES-256)' },
  { id: 'isolamento', title: '6. Multi-tenant e Não Monetização' },
  { id: 'compartilhamento', title: '7. Compartilhamento Estrito' },
  { id: 'retencao', title: '8. Retenção e Descarte Seguro' },
  { id: 'direitos', title: '9. Direitos dos Titulares (Art. 18)' },
  { id: 'dpo', title: '10. Canal com o Encarregado (DPO)' },
];

export default function PrivacidadePage() {
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

      {/* Main Layout */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Document Switcher Tabs */}
        <div className="mb-8 flex items-center gap-2 border-b border-surface-border">
          <Link
            href="/termos"
            className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:border-surface-border hover:text-ink-primary"
          >
            <FileText className="h-4 w-4" />
            <span>Termos de Uso</span>
          </Link>
          <Link
            href="/privacidade"
            className="inline-flex items-center gap-2 border-b-2 border-[#FF6B00] px-4 py-3 text-sm font-bold text-[#FF6B00]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Política de Privacidade (LGPD)</span>
          </Link>
        </div>

        {/* Document Header Metadata Bar */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl text-ink-primary">
                Política de Privacidade e Governança de Dados
              </h1>
              <p className="mt-1 text-xs text-ink-secondary">
                Diretrizes institucionais de tratamento, armazenamento e proteção de informações pessoais e dados operacionais
              </p>
            </div>

            <div className="text-xs text-ink-tertiary md:text-right">
              <div>Última revisão formal: {lastUpdated}</div>
            </div>
          </div>
        </div>

        {/* Highlight Architecture Cards */}
        <div className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-primary">
              Criptografia AES-256-GCM
            </h3>
            <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
              Dados sensíveis de clientes finais de pedidos (nome, telefone e endereço) são cifrados em repouso no banco relacional.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Server className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-primary">
              Isolamento Multi-Tenant
            </h3>
            <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
              Cada restaurante opera sob chave estrita de organização (`organizationId`). Nenhum dado operacional é compartilhado entre lojas.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
              <Database className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-primary">
              Sem Venda de Dados
            </h3>
            <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
              O DeliveryHub não comercializa, não aluga e não monetiza listas de clientes, volumes de vendas ou tíquete médio com terceiros.
            </p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Sticky Sidebar Index */}
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                  Índice de Seções
                </h2>
                <nav className="mt-3 space-y-1">
                  {PRIVACY_SECTIONS.map((sec) => (
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

              {/* DPO Seal Card */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-ink-primary">
                  <FileCheck className="h-4 w-4 text-blue-500" />
                  Atendimento ao Titular de Dados
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  Para exercer seus direitos de confirmação, acesso, retificação ou exclusão previstos no art. 18 da LGPD:
                </p>
                <div className="rounded-lg bg-surface-base border border-surface-border p-2.5 text-[11px] text-ink-primary">
                  Abra uma solicitação formal diretamente pela Central de Suporte e Atendimento no painel da sua loja.
                </div>
                <div className="pt-2 border-t border-surface-border-subtle">
                  <Link
                    href="/termos"
                    className="font-bold text-ink-secondary hover:text-ink-primary hover:underline inline-flex items-center gap-1 text-[11px]"
                  >
                    <span>Consultar Termos de Uso</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Legal Content */}
          <div className="space-y-12 text-sm leading-relaxed text-ink-secondary lg:col-span-8">
            {/* Seção 1 */}
            <section id="principios" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 1
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  INTRODUÇÃO, PRINCÍPIOS E COMPROMISSO INSTITUCIONAL COM A LGPD
                </h2>
              </div>
              <p>
                A <strong>DeliveryHub Tecnologia Ltda.</strong> ("DeliveryHub") valoriza a transparência, a segurança da informação e o respeito à privacidade dos titulares de dados pessoais. Esta Política de Privacidade e Governança de Dados foi redigida em estrita conformidade com a Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), o Marco Civil da Internet (Lei nº 12.965/2014) e as diretrizes emitidas pela Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
              <p>
                Nossas operações são orientadas pelos princípios fundamentais da <strong>finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção e não discriminação</strong> (art. 6º da LGPD).
              </p>
            </section>

            {/* Seção 2 */}
            <section id="papeis" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 2
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DEFINIÇÃO DE PAPÉIS REGULATÓRIOS (CONTROLADOR VS. OPERADOR)
                </h2>
              </div>
              <p>
                Para assegurar transparência regulatória e jurídica perante a ANPD e os titulares de dados, delimitamos a divisão de papéis:
              </p>
              <div className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-3">
                <div>
                  <h4 className="font-bold text-ink-primary text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#FF6B00]" />
                    O Restaurante / Estabelecimento Licenciado (Controlador)
                  </h4>
                  <p className="mt-1 text-xs text-ink-secondary">
                    O Estabelecimento é o <strong>Controlador</strong> dos dados pessoais dos consumidores finais que adquirem refeições e produtos através de seus canais. É o Estabelecimento quem estabelece o vínculo de consumo, fixa cardápios, define preços e possui a obrigação primária de atendimento aos direitos de seus clientes finais.
                  </p>
                </div>
                <div className="border-t border-surface-border-subtle pt-3">
                  <h4 className="font-bold text-ink-primary text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    O DeliveryHub (Operador de Pedidos e Controlador de Assinantes)
                  </h4>
                  <p className="mt-1 text-xs text-ink-secondary">
                    O DeliveryHub atua estritamente como <strong>Operador</strong> no processamento técnico dos dados de pedidos (recepção de webhook, unificação na fila do KDS, despacho), agindo exclusivamente de acordo com as instruções lícitas do Restaurante. Concomitantemente, atua como <strong>Controlador</strong> apenas em relação aos dados cadastrais e de cobrança dos administradores do próprio restaurante assinante do SaaS.
                  </p>
                </div>
              </div>
            </section>

            {/* Seção 3 */}
            <section id="dados" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 3
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  CATEGORIZAÇÃO DETALHADA DOS DADOS PESSOAIS TRATADOS
                </h2>
              </div>
              <p>Tratamos exclusivamente dados estritamente pertinentes e necessários à operação:</p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-ink-secondary">
                <li>
                  <strong>Dados do Assinante Restaurante:</strong> Razão social, nome fantasia, CNPJ/CPF do responsável, endereço físico, e-mail institucional, telefone de contato, registros de faturamento da assinatura SaaS.
                </li>
                <li>
                  <strong>Dados Operacionais de Pedidos (Consumidor Final):</strong> Nome, telefone para contato da entrega, endereço de entrega, lista de itens adquiridos, observações do preparo e identificador unívoco gerado pela plataforma de origem (iFood, Rappi, 99Food ou WhatsApp).
                </li>
                <li>
                  <strong>Dados de Conexão e Auditoria Técnica:</strong> Endereço IP do dispositivo, registros de data/hora de login (Marco Civil da Internet, art. 15), identificador de sessão e registros de transição de status de pedidos.
                </li>
              </ul>
            </section>

            {/* Seção 4 */}
            <section id="finalidades" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 4
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  BASES LEGAIS E FINALIDADES ESPECÍFICAS DE TRATAMENTO
                </h2>
              </div>
              <p>Todo tratamento fundamenta-se nos preceitos do art. 7º da LGPD:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-secondary">
                <li>
                  <strong>Execução de Contrato (Art. 7º, V):</strong> Viabilizar a unificação de pedidos na tela do operador, avanço no fluxo da cozinha e transmissão de confirmação de preparo às plataformas parceiras.
                </li>
                <li>
                  <strong>Cumprimento de Obrigação Legal ou Regulatória (Art. 7º, II):</strong> Manutenção de registros de conexão pelo prazo obrigatório de 6 (seis) meses e guarda de comprovantes fiscais conforme o Código Tributário Nacional.
                </li>
                <li>
                  <strong>Legítimo Interesse e Segurança (Art. 7º, IX):</strong> Prevenção de acessos fraudulentos, preservação da integridade da aplicação e auditoria interna de estabilidade.
                </li>
              </ul>
            </section>

            {/* Seção 5 */}
            <section id="seguranca" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 5
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  MEDIDAS TÉCNICAS E CRIPTOGRÁFICAS DE SEGURANÇA (AES-256-GCM)
                </h2>
              </div>
              <p>
                A segurança da informação é estrutural na arquitetura do DeliveryHub:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-secondary">
                <li>
                  <strong>Cifragem em Trânsito:</strong> Todo o tráfego HTTP é protegido por criptografia de ponta a ponta com certificados TLS 1.3 vigentes e proteção HSTS.
                </li>
                <li>
                  <strong>Cifragem em Repouso:</strong> Dados de identificação pessoal dos consumidores finais de pedidos são criptografados através do algoritmo <strong>AES-256 no modo Galois/Counter Mode (AES-256-GCM)</strong>, garantindo tanto a confidencialidade quanto a autenticidade dos dados armazenados no PostgreSQL.
                </li>
                <li>
                  <strong>Segurança de Credenciais:</strong> Senhas de usuários e chaves de API são protegidas com algoritmos de hash com sal computacionalmente caros (Argon2 / bcrypt), impossibilitando a recuperação em texto plano.
                </li>
              </ul>
            </section>

            {/* Seção 6 */}
            <section id="isolamento" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 6
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DIRETRIZES DE ISOLAMENTO MULTI-TENANT E NÃO MONETIZAÇÃO
                </h2>
              </div>
              <p>
                <strong>6.1. Isolamento Lógico Absoluto:</strong> A arquitetura de software do DeliveryHub implementa filtros multi-tenant estritos em todas as queries e mutações de banco de dados, garantindo que o Estabelecimento 'A' jamais tenha acesso visual ou analítico aos dados, pedidos ou faturamento do Estabelecimento 'B'.
              </p>
              <p>
                <strong>6.2. Vedação Expressa à Monetização de Dados:</strong> O DeliveryHub declara solenemente que <strong>não vende, não aluga, não compartilha e não comercializa listas de consumidores, relatórios de tíquete médio ou hábitos de consumo com birôs de crédito, anunciantes ou terceiros</strong>.
              </p>
            </section>

            {/* Seção 7 */}
            <section id="compartilhamento" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 7
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  COMPARTILHAMENTO DE DADOS ESTREITAMENTE NECESSÁRIO
                </h2>
              </div>
              <p>O compartilhamento limita-se aos agentes estritamente indispensáveis à consecução técnica do serviço:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-secondary">
                <li>
                  <strong>Provedores de Infraestrutura em Nuvem:</strong> Servidores e bancos de dados hospedados em provedores certificados internacionalmente com padrões ISO/IEC 27001, SOC 1, SOC 2 e SOC 3.
                </li>
                <li>
                  <strong>Plataformas Integradas Homologadas:</strong> Comunicação exclusiva de eventos de status via APIs oficiais autorizadas pelo próprio cliente (iFood, Rappi, 99Food).
                </li>
                <li>
                  <strong>Requisições Oficiais:</strong> Em caso de mandados judiciais legítimos expedidos por autoridades competentes nos termos da legislação brasileira.
                </li>
              </ul>
            </section>

            {/* Seção 8 */}
            <section id="retencao" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 8
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  CICLO DE RETENÇÃO E POLÍTICA DE DESCARTE SEGURO
                </h2>
              </div>
              <p>
                Os dados operacionais de pedidos permanecem disponíveis durante a vigência do contrato. Após a rescisão da assinatura, dados contendo identificação pessoal de clientes de pedidos são descartados ou anonimizados irreversivelmente em até 90 (noventa) dias, preservados unicamente os registros cuja guarda decorra de expressa imposição legal.
              </p>
            </section>

            {/* Seção 9 */}
            <section id="direitos" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 9
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  DIREITOS DOS TITULARES DE DADOS PESSOAIS (ART. 18 DA LGPD)
                </h2>
              </div>
              <p>
                Os titulares de dados pessoais podem, a qualquer momento e de forma gratuita, requerer:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-ink-secondary">
                <li>Confirmação da existência de tratamento e acesso aos dados.</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
                <li>Portabilidade dos dados a outro fornecedor de serviço, observados os segredos comercial e industrial.</li>
                <li>Revogação de consentimentos previamente concedidos.</li>
              </ul>
            </section>

            {/* Seção 10 */}
            <section id="dpo" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-border px-2 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  SEÇÃO 10
                </span>
                <h2 className="text-base font-bold text-ink-primary sm:text-lg">
                  CANAL DE ATENDIMENTO DO ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)
                </h2>
              </div>
              <p>
                Para esclarecer dúvidas técnicas sobre governança, solicitar informações complementares ou registrar requerimentos formais previstos na LGPD, acione a nossa equipe responsável pelo tratamento de dados:
              </p>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B00]/10 text-[#FF6B00]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-primary text-sm">
                      Encarregado pelo Tratamento de Dados (DPO) & Governança
                    </h3>
                    <p className="text-xs text-ink-secondary mt-1">
                      DeliveryHub Tecnologia · Setor de Governança, Risco e Conformidade
                    </p>
                    <p className="text-xs text-ink-secondary mt-2">
                      Todas as requisições vinculadas aos direitos dos titulares são processadas com prioridade por meio da Central de Atendimento e Suporte ao Cliente integrada à plataforma.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
