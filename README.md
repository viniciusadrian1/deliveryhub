# DeliveryHub

> Camada única de controle sobre múltiplas plataformas de delivery.
> Hub de pedidos em tempo real · Cardápio centralizado · **Inteligência de margem cross-platform** ⭐ · **Pausa multiplataforma** ⭐ · Conciliação financeira assistida · LGPD desde o dia 1.

---

## Estado atual

**MVP backend completo** — 12 sprints entregues, ~14.000 linhas de produção.

```
✅ Sprint 1   Fundação: auth, multi-tenant, RBAC
✅ Sprint 2   PII (AES-256-GCM), audit log, email, Sentry, Railway, password reset, invite
✅ Sprint 3   Adapter iFood (real + mock) + Vault + OAuth Device flow
✅ Sprint 4   Cardápio CRUD (categorias, items com CMV, modificadores)
✅ Sprint 5   Config por plataforma + sync inicial + push iFood
✅ Sprint 6   Margem cross-platform ⭐ (DIFERENCIAL #1)
✅ Sprint 7   Notificações in-app (REST + Socket.IO) + triggers
✅ Sprint 8   Hub de Pedidos em tempo real (webhook + state machine)
✅ Sprint 9   Front: login, signup, Hub Kanban com Socket.IO
✅ Sprint 10  Pausa Multiplataforma ⭐ (DIFERENCIAL #2) + cron de reabertura
✅ Sprint 11  Financeiro: dashboard, CSV bancário, conciliação automática
✅ Sprint 12  LGPD: consent log, export e anonimização do próprio usuário
```

Frontend: login, signup, Hub Kanban em tempo real, drawer de pedido com ações.
Demais telas (cardápio, simulador de margem, pausa, financeiro) consomem backend pronto — falta UI.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 15 (App Router) · React 19 · Tailwind 3 · TanStack Query · socket.io-client |
| API | NestJS 11 · Prisma 6 · PostgreSQL 16 · Redis · Socket.IO · BullMQ-ready |
| Compartilhado | Zod, pnpm workspaces, Turborepo |
| Infra | Docker · Railway (MVP) · GitHub Actions |
| Observabilidade | Pino (PII redaction) · Sentry |

---

## Estrutura do monorepo

```
deliveryhub/
├── apps/
│   ├── api/                       # NestJS + Socket.IO + Prisma
│   │   └── src/modules/
│   │       ├── auth/              # signup, login, refresh, reset, invite
│   │       ├── compliance/        # consent, LGPD export/anonymize
│   │       ├── financial/         # dashboard, payouts, conciliação CSV
│   │       ├── integrations/      # OAuth + vault + adapter registry
│   │       ├── menu/              # categorias, items, modifiers, config/sync
│   │       ├── notifications/     # REST + Socket.IO gateway
│   │       ├── orders/            # webhook, state machine, Hub
│   │       ├── organizations/     # invitations
│   │       ├── pauses/            # diferencial #2 + cron
│   │       ├── pricing/           # diferencial #1 (margem)
│   │       └── users/             # /me
│   └── web/                       # Next.js 15
│       └── app/
│           ├── login | signup     # públicas
│           └── (app)/hub          # protegida
├── packages/
│   ├── db/                        # Prisma schema + migrations + client
│   ├── shared/                    # tipos + constantes
│   ├── ifood/                     # IFoodAdapter + MockAdapter
│   └── config/                    # tsconfig + eslint
├── docs/                          # PRD, ERD, arquitetura, wireframes, backlog, deploy
└── infra/
    ├── docker/                    # Dockerfiles api + web
    └── postgres/                  # init.sql (pgcrypto, citext)
```

---

## Diferenciais técnicos (resumo)

### 1. Margem líquida cross-platform ⭐
Cada item × plataforma tem preço e taxas próprios. Endpoint POST `/api/pricing/simulate`
resolve algebricamente o preço bruto necessário em cada plataforma para
atingir uma margem-alvo (`strategy=keep_margin_pct`). Plataforma com taxa
maior → preço bruto maior, mas mesma margem líquida.

### 2. Pausa multiplataforma ⭐
Modelo único `Pause` cobre escopo `store|category|item` × `platformIds[]`.
Pausa seletiva ("só no iFood, por 30min, motivo X") ou global. Cron a
cada minuto reabre as vencidas. Falhas parciais ficam visíveis no
`pause.error_message` e disparam notificação.

### 3. PII cifrado em repouso
AES-256-GCM com chave em vault. Prisma `$extends` cifra/decifra
automaticamente os campos listados em `PII_FIELDS` (`customer.phone`,
`customer.document`, `user.phone`, `organization.document`).

### 4. Multi-tenant via Prisma extension
`TenantPrismaService` injeta `organizationId` em todo `find/update/delete/create`
dos models listados em `TENANT_MODELS`. AsyncLocalStorage carrega o contexto
do JWT via `TenantInterceptor`. Defesa em profundidade: services também
filtram explicitamente.

### 5. Audit log + LGPD prontos
Toda mutação sensível chama `AuditLogService.record()`. Endpoint
`/api/me/data-export` devolve JSON com profile + memberships +
notifications + consents + audit + sessões ativas. `/api/me/anonymize`
zera PII preservando integridade referencial.

---

## Requisitos

- **Node.js 22+** (LTS)
- **pnpm 9+**
- **Docker** (para Postgres + Redis em dev)

---

## Primeira execução

```powershell
# 1. instalar dependências
pnpm install

# 2. subir Postgres (porta 55432) e Redis (56379)
pnpm docker:up

# 3. configurar .env
Copy-Item .env.example .env
# edite VAULT_MASTER_KEY e JWT_*_SECRET — qualquer string >= 32 chars serve em dev

# 4. aplicar migrations + seed (popula tabela platform)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. rodar API + Web em paralelo
pnpm dev
```

- API → http://localhost:3333/api/healthz
- Web → http://localhost:3001

---

## Endpoints REST principais

```
Auth (público)
  POST /api/auth/signup
  POST /api/auth/login
  POST /api/auth/refresh
  POST /api/auth/logout
  POST /api/auth/password/forgot
  POST /api/auth/password/reset
  POST /api/auth/invitations/accept

LGPD (auth)
  GET  /api/me
  GET  /api/me/data-export        # exporta seus dados (JSON)
  POST /api/me/anonymize          # anonimiza sua conta (irreversível)
  GET  /api/me/consents           # histórico de consentimentos

Integrações iFood (auth, owner|manager)
  GET    /api/integrations/connections
  POST   /api/integrations/connect
  POST   /api/integrations/connections/:id/finalize
  DELETE /api/integrations/connections/:id

Cardápio (auth)
  GET/POST/PATCH/DELETE /api/menu/categories
  GET/POST/PATCH/DELETE /api/menu/items
  GET/POST/PATCH/DELETE /api/menu/modifier-groups
  GET/POST/PATCH/DELETE /api/menu/modifiers
  PUT/DELETE            /api/menu/items/:id/platforms/:platformCode

Sync com plataforma
  POST /api/menu/sync/initial
  POST /api/menu/items/:id/platforms/:platformCode/sync-price
  POST /api/menu/items/:id/platforms/:platformCode/sync-availability

Margem ⭐
  GET  /api/pricing/items
  POST /api/pricing/simulate
  POST /api/pricing/apply

Pedidos (Hub)
  POST /api/webhooks/ifood  (público, HMAC)
  GET  /api/orders
  POST /api/orders/:id/{accept|preparing|ready|dispatch|delivered|reject}

Pausa ⭐
  GET  /api/pauses/active
  POST /api/pauses
  POST /api/pauses/:id/cancel

Financeiro
  GET  /api/financial/{summary|daily|top-items|by-platform}
  POST /api/bank/import
  GET  /api/payouts
  POST /api/payouts/recompute
  POST /api/reconciliation/run

Notificações
  GET/POST /api/notifications[...]
  Socket.IO events: notification.created, order.created, order.updated
```

---

## Scripts úteis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe API + Web em watch |
| `pnpm build` | Build de tudo (packages → apps) |
| `pnpm lint` | ESLint em tudo |
| `pnpm typecheck` | TS check em tudo |
| `pnpm test` | Vitest em tudo (35 unit tests passando) |
| `pnpm db:generate` | Gera Prisma Client |
| `pnpm db:migrate` | Migration interativa (dev) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm docker:up` | Postgres + Redis |
| `pnpm docker:down` | Para os containers |

---

## Documentação interna

- [PRD do MVP](docs/01-prd.md)
- [Modelo de dados (ERD)](docs/02-data-model.md)
- [Arquitetura](docs/03-architecture.md)
- [Wireframes](docs/04-wireframes.md)
- [Backlog (10 épicos, ~80 stories)](docs/05-backlog.md)
- [Deploy no Railway](docs/06-deploy.md)

---

## Convenções

- UI e documentação em **PT-BR**; código (identificadores, commits, comentários) em **inglês**.
- Dinheiro em **centavos** (`Int` para per-row, `BigInt` para taxas de plataforma).
- **Multi-tenant in-app**: todo método de service que toca Prisma filtra por `organizationId`. `TenantPrismaService` é a rede de segurança em runtime; serviços passam orgId explicitamente nos `create`/`update` para satisfazer tipos.
- **Sem `console.log`** em produção (lint warning); use o logger Pino injetado.
- Migrations reversíveis (`prisma migrate dev` local; rollback é revert + `prisma migrate resolve`).

---

## Licença

Propriedade — todos os direitos reservados.
