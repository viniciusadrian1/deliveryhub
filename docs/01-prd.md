# DeliveryHub — Product Requirements Document (MVP)

> Versão: 0.1 — Maio/2026
> Status: rascunho para validação
> Autor: Solo founder + IA arquiteta

---

## 1. Visão

> "Uma única interface para gerir restaurantes que vendem em múltiplas plataformas de delivery — com inteligência de margem cross-platform."

DeliveryHub é a camada única de controle entre o restaurante e as plataformas de delivery (iFood, 99Food, Keeta, Rappi, Uber Eats). No MVP, conecta apenas iFood, mas o produto é desenhado para escalar para todas as plataformas relevantes do Brasil.

---

## 2. Problema

Restaurantes que vendem em delivery operam em modo **multi-tablet**:

| Sintoma | Custo real |
|---|---|
| 1 tablet por plataforma | espaço no balcão, custo de hardware, ruído operacional |
| Cardápios desincronizados | item esgotado no iFood ainda vende no Rappi → cancelamento, nota baixa |
| Esquecimento de pausar a loja em algum canal | pedidos durante hora de pico mal dimensionada, atrasos, churn de cliente |
| Conciliação manual de repasses | horas/semana do gerente, divergências passam despercebidas |
| Margem real desconhecida | restaurante vende com prejuízo em uma plataforma sem saber, porque a comissão líquida varia 12-30% |

---

## 3. Solução

Camada única de controle + inteligência de precificação + automação operacional, sob 4 pilares:

1. **Visão unificada** — pedidos, clientes, reviews, financeiro em uma tela.
2. **Ações em lote** — uma ação no DeliveryHub propaga para todas as plataformas conectadas.
3. **Inteligência de margem** — cálculo automático de margem líquida real por item e por plataforma.
4. **Conciliação automatizada** — confronto entre repasse anunciado e crédito bancário.

---

## 4. Personas

| Persona | Papel | Necessidade-chave |
|---|---|---|
| **Dona Maria** | Dona, 1 loja, ~80 pedidos/dia | "Não posso perder pedido nem vender no prejuízo" |
| **João Gerente** | Gerente operacional, 2-3 lojas | "Preciso saber o que está acontecendo em todas as lojas, mesmo fora delas" |
| **Atendente / Cozinheiro** | Operação | "Aceitar pedido em 1 clique, ver o que falta" |
| **Financeiro** | Back office | "Bater repasse com extrato sem planilha" |

---

## 5. Análise Competitiva

| Capacidade | Anota AI | Saipos | Goomer | **DeliveryHub MVP** |
|---|:---:|:---:|:---:|:---:|
| Hub multi-plataforma | ✅ | ⚠️ limitado | ❌ | ✅ |
| Pausa seletiva por canal | ⚠️ parcial | ❌ | ❌ | ⭐ ✅ |
| **Margem líquida cross-platform** | ❌ | ⚠️ ERP geral | ❌ | ⭐ ✅ |
| Conciliação automática | ⚠️ básica | ✅ | ❌ | ✅ (assistida no MVP) |
| Cardápio centralizado | ✅ | ✅ | ⭐ ✅ | ✅ |
| KDS | ✅ | ✅ | ⚠️ | ❌ (fase 2) |
| Estoque/ficha técnica | ⚠️ | ✅ | ❌ | ❌ (fase 2) |
| CRM unificado | ✅ | ✅ | ⚠️ | ❌ (fase 2) |
| UX moderna | médio | legado/pesado | ⭐ | ⭐ alvo |
| Preço | médio | alto | médio | **enxuto** |

**Onde ganhamos:** margem líquida cross-platform (ninguém faz bem) + pausa seletiva sofisticada + UX moderna.
**Onde perdemos no início:** profundidade de ERP (Saipos) e maturidade de hub (Anota AI). Estratégia: foco em PMEs que **não** precisam de ERP completo e querem UX moderna.

---

## 6. Escopo do MVP (90 dias) — MoSCoW

### 🟢 MUST — Entra obrigatoriamente

| ID | Feature | Justificativa |
|---|---|---|
| **M1** | Onboarding + conexão iFood via OAuth de parceiro | Sem isso o produto não funciona |
| **M2** | Hub Unificado de Pedidos (tempo real via webhook → Socket.IO) | Coração do produto |
| **M3** | Aceitar / recusar / despachar pedido refletindo na API iFood | Operação real |
| **M4** | Gestão Centralizada de Cardápio com sync bidirecional iFood | Pré-requisito para preço/margem |
| **M5** | Pausa de Loja: total, por canal (esqueleto pronto p/ +1 plataforma), por item, por categoria | Diferencial #2 |
| **M6** | Gestão de Preço com cálculo de margem líquida + simulador what-if | Diferencial #1 ⭐ |
| **M7** | Dashboard Financeiro + Conciliação assistida (upload CSV de repasse iFood) | Atende dor do financeiro |
| **M8** | Multi-tenant (`org_id` em todo o schema) + Auth JWT/RBAC (owner / manager / staff) | Pré-requisito SaaS |
| **M9** | Notificações in-app + e-mail (novos pedidos, erros de integração) | UX e confiabilidade |
| **M10** | Logs de auditoria de ações sensíveis (preço, pausa, exclusão) | LGPD + governança |
| **M11** | LGPD básico: política, consentimento, exportação/exclusão sob demanda | Compliance |

### 🟡 SHOULD — Corta primeiro se atrasar

- S1: Modo escuro (baixo custo com Tailwind)
- S2: Filtros avançados no hub (plataforma, valor, horário)
- S3: Pausa programada (job recorrente)
- S4: Reabertura automática após X minutos

### 🔵 COULD — Bom ter

- C1: Comparativo de faturamento entre dias da semana
- C2: Alertas configuráveis (meta diária, estoque crítico simbólico)
- C3: Multi-idioma (PT-BR + ES base) — preparar i18n

### 🔴 WON'T — Fora do MVP, roadmap futuro

App mobile · KDS · Estoque/ficha técnica · CRM completo · Promoções avançadas · Sentiment analysis em reviews · BI dedicado (ClickHouse) · Multi-loja · Impressão térmica ESC/POS · WhatsApp Business · Rappi/99Food/Keeta/Uber Eats · Billing automatizado · ML de preço.

---

## 7. KPIs de Sucesso do MVP

| Métrica | Meta |
|---|---|
| Tempo entre criação da conta e primeiro pedido recebido | < 30 min |
| Latência webhook iFood → aparecer no Hub | < 2 s p95 |
| 100% das pausas refletidas no iFood em | < 5 s |
| Taxa de erro de sync de cardápio | < 1% |
| NPS dos 10 primeiros clientes | ≥ 50 |
| Uptime do hub de pedidos | ≥ 99.5% |

---

## 8. Roadmap pós-MVP

| Trimestre | Foco |
|---|---|
| **Q1 pós-MVP** | Integração Rappi + 99Food · KDS · Estoque básico com ficha técnica |
| **Q2** | App Mobile (React Native/Expo) · CRM unificado · Promoções por plataforma |
| **Q3** | Multi-loja com permissões granulares · BI dedicado (ClickHouse) · Marketplace de integrações (Bling/Omie/Conta Azul) |
| **Q4** | ML — sugestão de preço dinâmico · previsão de demanda · sentiment analysis real em reviews |

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Aprovação parceiro iFood demora | Sem onboarding real | Sandbox iFood + adapter abstrato pronto, mock de webhook em dev |
| iFood altera contrato de API sem aviso | Operação parada | Adapter isolado + monitor de health-check + alerta no Sentry |
| Solo dev sobrecarga | Atraso do MVP | Corte agressivo de escopo, CI/CD desde sprint 1, IA como par |
| LGPD em produção | Multa, churn | Criptografar PII desde dia 1, auditoria de acesso, runbook de exclusão |
| Webhook duplicado / fora de ordem | Pedido fantasma | Idempotência por `event_id`, fila com retry exponencial |

---

## 10. Definição de Pronto

- **DoR** (Definition of Ready) — story só vai para sprint quando: critério de aceitação escrito, esboço de UI/fluxo, entidades afetadas, dependências mapeadas.
- **DoD** (Definition of Done) — feature só fecha quando: testada (unit + integração mínima), documentada (OpenAPI + README atualizado), deployada em staging, validada pelo operador.

---

## 11. Premissas

- iFood Developer Portal já está acessível.
- Solo dev com IA como par técnico.
- Stack confirmada: Next.js 15 + NestJS + Postgres + Redis + Socket.IO em monorepo pnpm/Turborepo, deploy Railway.
- Mercado-alvo: PMEs brasileiras (1-3 lojas).
- UI em PT-BR, código em inglês.
