# DeliveryHub — Backlog do MVP

> Versão: 0.1
> Estrutura: 10 épicos · ~80 user stories · estimativa em pontos Fibonacci (1/2/3/5/8/13)
> Velocity-alvo (solo dev + IA): **22–25 pts/sprint** semanal · **12 sprints** = ~90 dias

---

## Sumário de pontos

| Épico | Foco | MUST | SHOULD | COULD | Total |
|---|---|---:|---:|---:|---:|
| EP-01 | Plataforma Base (auth, tenant, RBAC) | 28 | 3 | — | **31** |
| EP-02 | Onboarding & Conexão iFood | 31 | 3 | — | **34** |
| EP-03 | Cardápio Centralizado + Sync iFood | 26 | 5 | — | **31** |
| EP-04 | Inteligência de Preço & Margem ⭐ | 23 | 5 | 2 | **30** |
| EP-05 | Hub de Pedidos em Tempo Real ⭐ | 36 | 6 | 3 | **45** |
| EP-06 | Pausa Multiplataforma ⭐ | 21 | 8 | — | **29** |
| EP-07 | Financeiro & Conciliação | 26 | 6 | 3 | **35** |
| EP-08 | Notificações | 14 | — | 3 | **17** |
| EP-09 | Auditoria & LGPD | 20 | 3 | — | **23** |
| EP-10 | Infra & DX (CI/CD, observability) | 19 | 3 | — | **22** |
| **TOTAL** | | **244** | **42** | **11** | **297** |

Capacidade nominal de 12 sprints × 23 pts = **276 pts**. Folga: -21 pts. → **Devemos cortar ~20 pts de SHOULD ou aceitar 1 sprint de buffer**. Plano abaixo já considera buffer.

---

## EP-01 — Plataforma Base

Objetivo: fundação técnica reutilizável (monorepo, auth, tenancy, RBAC) sobre a qual todos os outros épicos rodam.

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-1.1 | **Setup do monorepo** com pnpm + Turborepo, apps `web`/`api`, packages `db`/`shared` | M | 3 | — |
| US-1.2 | **Schema Prisma inicial** (organization, user, membership, store, refresh_token) + migrations + seed | M | 3 | 1.1 |
| US-1.3 | **Login + cadastro** com JWT (15min) + Argon2id | M | 5 | 1.2 |
| US-1.4 | **Refresh token rotativo** (sha256 hash, 30d) | M | 3 | 1.3 |
| US-1.5 | **Recuperação de senha** por link e-mail (Resend) | M | 3 | 1.3, 8.4 |
| US-1.6 | **Tenant isolation** via AsyncLocalStorage + TenantPrismaService middleware + testes | M | 5 | 1.2 |
| US-1.7 | **RBAC**: decorator `@Roles`, guard, roles `owner/manager/staff/financial` | M | 3 | 1.6 |
| US-1.8 | **Convidar usuário** para organização (e-mail com link de aceite + escolha de role) | M | 3 | 1.7, 8.4 |
| US-1.9 | Página "Minha conta" — editar nome, e-mail, senha | S | 3 | 1.3 |

**Critério de aceitação principal:** todo endpoint protegido tem teste que **falha** se o `where: organizationId` não for aplicado.

---

## EP-02 — Onboarding & Conexão iFood

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-2.1 | **Wizard de onboarding** 4 passos (org → loja → conectar iFood → pronto) | M | 5 | 1.3 |
| US-2.2 | **Vault abstraction** + cifragem AES-256-GCM em tabela `vault_secret` | M | 3 | 1.2 |
| US-2.3 | **OAuth flow iFood** (parceiro): redirect, callback, troca por tokens, persistência cifrada | M | 8 | 2.2 |
| US-2.4 | **Tela "Integrações"** com grade de plataformas (iFood ativa, demais "Em breve") | M | 2 | 2.1 |
| US-2.5 | **Sync inicial do cardápio iFood** (fetch + import em `category`/`menu_item`/`modifier`) | M | 5 | 2.3, 3.1, 3.2, 3.3 |
| US-2.6 | **Confirmação de taxas** — form de `platform_fee_profile` pré-preenchido | M | 2 | 2.5 |
| US-2.7 | **Refresh automático do token OAuth** iFood (job recorrente) | M | 3 | 2.3 |
| US-2.8 | **Detecção de erro de integração** → `platform_connection.status='error'` + notificação | M | 3 | 2.3, 8.5 |
| US-2.9 | Desconectar plataforma (revoga tokens + estado limpo) | S | 3 | 2.3 |

---

## EP-03 — Cardápio Centralizado + Sync iFood

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-3.1 | CRUD de **categoria** | M | 2 | 1.6 |
| US-3.2 | CRUD de **item** (com CMV em `cost_cents`) | M | 3 | 3.1 |
| US-3.3 | CRUD de **grupos de modificadores + modificadores** | M | 5 | 3.2 |
| US-3.4 | **Tela árvore do cardápio** (categoria → item) com colunas por plataforma | M | 5 | 3.2, 4.1 |
| US-3.5 | **Edição inline** de preço/disponibilidade por plataforma | M | 3 | 3.4 |
| US-3.6 | **Push de criação/edição** de item para iFood (job `ifood:menu-push`) | M | 5 | 3.2, 2.3 |
| US-3.7 | Toggle **is_published** / **is_available** com push | M | 2 | 3.5, 3.6 |
| US-3.8 | Upload de **foto do item** (storage R2/S3 + URL assinada) | M | 3 | 3.2 |
| US-3.9 | **Reverter para versão anterior** de um item (via audit_log) | S | 5 | 3.2, 9.1 |

---

## EP-04 — Inteligência de Preço & Margem ⭐

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-4.1 | **View materializada** `vw_menu_item_margin` (preço − comissão − processamento − CMV) | M | 3 | 1.2, 3.2 |
| US-4.2 | **Indicador visual de margem** na tabela (cores verde/amarelo/vermelho) | M | 2 | 4.1, 3.4 |
| US-4.3 | **Tooltip com breakdown** da margem ao passar mouse | M | 1 | 4.2 |
| US-4.4 | **Seleção múltipla** de itens + "Ações em lote → Alterar preço" | M | 2 | 3.4 |
| US-4.5 | **Estratégia "mesmo preço bruto"** em todas as plataformas | M | 2 | 4.4 |
| US-4.6 | **Estratégia "delta fixo em R$"** | M | 2 | 4.4 |
| US-4.7 | **Estratégia "manter mesma margem líquida"** ⭐ — calcula preço bruto por plataforma | M | 5 | 4.1, 4.4 |
| US-4.8 | **Pré-visualização linha-a-linha** (atual → novo) | M | 3 | 4.7 |
| US-4.9 | **Aplicar batch**: transação Prisma + audit_log + enqueue jobs de push | M | 3 | 4.7, 3.6 |
| US-4.10 | **Validação de margem mínima** com aviso e fallback "manter atual" | S | 2 | 4.7 |
| US-4.11 | **Regra automática**: "manter margem mínima X% se taxa subir" (recálculo agendado) | S | 3 | 4.7 |
| US-4.12 | Histórico de alterações de preço por item (gráfico de linha) | C | 2 | 9.1, 4.1 |

---

## EP-05 — Hub de Pedidos em Tempo Real ⭐

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-5.1 | **Endpoint público** `/webhooks/ifood` com HMAC verify + rate limit alto | M | 3 | 2.3 |
| US-5.2 | **Idempotência** via INSERT em `webhook_event` (UNIQUE) | M | 2 | 5.1 |
| US-5.3 | **Worker** que processa evento: fetch full order do iFood, UPSERT em `order`/`order_item`/`order_item_modifier` | M | 5 | 5.2, 3.2 |
| US-5.4 | **Match de cliente** por hash do telefone, criando/atualizando `customer` | M | 3 | 5.3 |
| US-5.5 | **Socket.IO gateway** com rooms por `store:{storeId}` + auth via JWT | M | 3 | 1.6 |
| US-5.6 | **UI do Hub**: 4 colunas Kanban responsivas | M | 8 | 5.3, 5.5 |
| US-5.7 | **Card de pedido** com badge da plataforma, valor bruto/líquido, tempo decorrido | M | 2 | 5.6 |
| US-5.8 | **Drawer lateral** com detalhe completo (itens, modificadores, taxas, observações) | M | 3 | 5.6 |
| US-5.9 | **Ações** aceitar/recusar/preparar/pronto/despachar → API iFood + state machine | M | 5 | 5.3, 5.5 |
| US-5.10 | **Som + push notification** ao chegar novo pedido | M | 2 | 5.5, 8.3 |
| US-5.11 | **Filtros** plataforma/status/busca de cliente | S | 3 | 5.6 |
| US-5.12 | **Reconnect Socket.IO** + replay de eventos perdidos durante offline | M | 3 | 5.5 |
| US-5.13 | **Drag-and-drop** entre colunas para avançar status | S | 3 | 5.6, 5.9 |
| US-5.14 | **Alerta visual** de pedido atrasado (passou de X min sem progredir) | C | 3 | 5.6 |

---

## EP-06 — Pausa Multiplataforma ⭐

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-6.1 | **CRUD de pause** (entidade) | M | 3 | 1.6 |
| US-6.2 | **Tela "Status da loja"** com botões de pausa total e form de duração | M | 3 | 6.1 |
| US-6.3 | **Pausa total** → push para iFood (job `ifood:availability-push`) | M | 3 | 6.1, 2.3 |
| US-6.4 | **Pausa por categoria/item** → push availability por item no iFood | M | 5 | 6.1, 3.6 |
| US-6.5 | **Reabertura manual** (cancelar pause + push retomada) | M | 2 | 6.3 |
| US-6.6 | **Estados visuais** active/pausing/error com retry exponencial | M | 3 | 6.3, 8.3 |
| US-6.7 | **Reabertura automática** ao atingir `ends_at` (job recorrente) | M | 3 | 6.3 |
| US-6.8 | **Pausa programada recorrente** (cron, ex.: todo dia 15-17h) | S | 5 | 6.7 |
| US-6.9 | Estender duração de pausa ativa (+15/+30/+60min) | S | 2 | 6.5 |
| US-6.10 | Histórico de pausas com motivo (relatório operacional) | S | 1 | 6.1 |

---

## EP-07 — Financeiro & Conciliação

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-7.1 | **KPI cards** (faturamento bruto, taxas, líquido, ticket médio) | M | 3 | 5.3, 4.1 |
| US-7.2 | **Gráfico** faturamento por dia (últimos 30/90 dias) | M | 3 | 7.1 |
| US-7.3 | **Top itens por margem** | M | 2 | 4.1 |
| US-7.4 | **Por plataforma com %** | M | 2 | 7.1 |
| US-7.5 | **Upload de CSV de extrato bancário** + parser | M | 3 | 1.6 |
| US-7.6 | **Algoritmo de matching** repasse esperado iFood ↔ `bank_transaction` (tolerância R$) | M | 8 | 7.5 |
| US-7.7 | **Tela de conciliação** com lista de repasses (status pendente/ok/divergente) | M | 3 | 7.6 |
| US-7.8 | **Drill-in de divergência** com detecção de causa (chargebacks, ajustes) | M | 5 | 7.6, 5.3 |
| US-7.9 | **Exportar relatório** CSV/XLSX (filtros aplicados) | S | 3 | 7.1 |
| US-7.10 | **PDF de fechamento mensal** | S | 3 | 7.9 |
| US-7.11 | Categorização manual de despesas operacionais | C | 3 | 7.5 |

---

## EP-08 — Notificações

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-8.1 | **Tabela notification** + service + endpoint listar/marcar lida | M | 2 | 1.6 |
| US-8.2 | **NotificationPreference** + tela de config (por canal × por evento) | M | 3 | 8.1 |
| US-8.3 | **In-app via Socket.IO** + sininho com contador | M | 3 | 8.1, 5.5 |
| US-8.4 | **E-mail transacional** via Resend (template engine simples) | M | 3 | — |
| US-8.5 | **Eventos disparadores**: novo pedido, erro de integração, repasse divergente | M | 3 | 8.3, 8.4 |
| US-8.6 | Meta diária atingida (alerta opcional) | C | 3 | 7.1 |

---

## EP-09 — Auditoria & LGPD

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-9.1 | **AuditLog interceptor** automático em mutations | M | 3 | 1.6 |
| US-9.2 | **Aplicação em endpoints sensíveis** (preço, pausa, delete, login) | M | 2 | 9.1 |
| US-9.3 | **Política de privacidade + termos** com versionamento | M | 2 | — |
| US-9.4 | **ConsentLog** com aceite no cadastro/onboarding | M | 2 | 9.3 |
| US-9.5 | **Endpoint "exportar meus dados"** (LGPD art. 18) — gera ZIP, upload R2, e-mail | M | 5 | 8.4 |
| US-9.6 | **Endpoint "excluir minha conta"** — anonimização + delete cascata | M | 5 | 9.1 |
| US-9.7 | **PII encryption** com pgcrypto em `customer.phone/document`, `organization.document` | M | 3 | 1.2 |
| US-9.8 | Página admin de visualização do audit_log filtrado | S | 3 | 9.1 |

---

## EP-10 — Infra & DX

| ID | Story | M | Pts | Dep. |
|---|---|:--:|:--:|:--:|
| US-10.1 | **docker-compose** dev (Postgres + Redis) | M | 2 | 1.1 |
| US-10.2 | **Dockerfile multi-stage** para api + web | M | 3 | 1.1 |
| US-10.3 | **GitHub Actions CI**: lint, typecheck, unit + integration tests, build | M | 3 | 1.1 |
| US-10.4 | **Railway deploy** (services: api, worker, web, postgres, redis) + migrate na release | M | 3 | 10.2 |
| US-10.5 | **Sentry** integration (api + web) com source maps | M | 2 | 10.4 |
| US-10.6 | **Health endpoints** `/healthz`, `/readyz` | M | 1 | — |
| US-10.7 | **Pino structured logs** com PII redaction | M | 2 | — |
| US-10.8 | **Playwright** setup + 3 fluxos E2E críticos (login, criar item, pausa) | M | 3 | 10.4 |
| US-10.9 | **Testcontainers** setup para integration tests | S | 3 | 10.3 |

---

## Plano de 12 sprints

> Cada sprint = 1 semana, ~22–25 pts. Buffer absorvido na sprint 12.

| Sprint | Tema | Stories | Pts |
|:--:|---|---|:--:|
| **1** | Fundação | 1.1, 1.2, 1.3, 1.4, 10.1, 10.3, 10.6, 10.7 | 22 |
| **2** | Tenancy + LGPD base | 1.5, 1.6, 1.7, 1.8, 10.2, 10.4, 10.5, 9.7 | 23 |
| **3** | Onboarding + iFood OAuth | 2.1, 2.2, 2.3, 2.4, 10.8 | 21 |
| **4** | Cardápio CRUD + sync inicial | 3.1, 3.2, 3.3, 3.8, 2.5, 2.6, 2.7 | 23 |
| **5** | Listagem cardápio + push iFood | 3.4, 3.5, 3.6, 3.7, 2.8, 8.1 | 22 |
| **6** | Margem & inteligência de preço (parte 1) | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8 | 17 |
| **7** | Margem (parte 2) ⭐ + notificações | 4.7, 4.9, 4.10, 8.2, 8.3, 8.4, 8.5 | 22 |
| **8** | Hub: ingestão de pedidos | 5.1, 5.2, 5.3, 5.4, 5.5, 5.12 | 19 |
| **9** | Hub: UI + ações | 5.6, 5.7, 5.8, 5.9, 5.10 | 20 |
| **10** | Pausa Multiplataforma ⭐ | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 | 22 |
| **11** | Financeiro + Conciliação | 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7 | 24 |
| **12** | LGPD + polish + smoke | 7.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 5.11 | 25 |

**Pontos MUST cobertos em 12 sprints = 244**. SHOULD/COULD entram conforme buffer disponível por sprint ou em "Fase 1.5" (semanas 13-16 pós-lançamento beta).

---

## Critérios transversais de aceitação (Definition of Done)

Toda story só fecha quando:

1. ✅ Critério de aceitação funcional validado em staging.
2. ✅ Testes: unit + integração mínima (≥1 happy path + ≥1 edge case).
3. ✅ Endpoints com tenant isolation testado (assertion explícita).
4. ✅ Mutations sensíveis geram `audit_log`.
5. ✅ Strings de UI em PT-BR.
6. ✅ Sem TODOs/console.log no diff.
7. ✅ Migration aplica e reverte limpa em DB vazio.
8. ✅ Documentação OpenAPI gerada (endpoints).
9. ✅ Sem erros de lint/typecheck.
10. ✅ Verificado em modo escuro (telas com UI).

---

## Riscos por épico

| Épico | Risco principal | Mitigação |
|---|---|---|
| EP-02 | Aprovação parceiro iFood não disponível | MockAdapter já desenhado; adapter abstrai e iFood vira plug-in |
| EP-04 | Cliente não enxerga valor da "manter margem" sem 2ª plataforma | Sprint 7 incluir landing/explainer in-app que mostra valor já no iFood (gestão de CMV) |
| EP-05 | Latência ou rate-limit do iFood degradar UX | Workers com backoff; cache de detalhe do pedido; Socket.IO emite "preliminar" só com payload do webhook |
| EP-06 | iFood demora a refletir pausa | UI mostra estado "pending" até confirmação do worker; retry visível |
| EP-07 | Matching de repasse complexo demais para 8pts | Algoritmo simples MVP (exato por valor + período); divergências viram ticket manual |
| EP-09 | LGPD jurídico custar caro | Política gerada por template, revisão jurídica externa só após PMF |

---

## Stories explicitamente fora do MVP

(retomadas em fase 2; já listadas como WON'T no PRD)

App mobile · KDS · Estoque/Ficha técnica · CRM avançado · Promoções · Reviews + sentiment · BI dedicado · Multi-loja UI · Impressão térmica ESC/POS · WhatsApp Business · Rappi/99Food/Keeta/UberEats · Billing automatizado · ML.
