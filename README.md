# DeliveryHub

> Camada única de controle sobre múltiplas plataformas de delivery.
> Hub de pedidos · Gestão de cardápio · Inteligência de margem cross-platform · Pausa multiplataforma · Conciliação financeira.

---

## Estado atual

**Setup do projeto concluído** (Passo 7 de 10). Próximo: Sprint 1 da implementação (autenticação, multi-tenant, RBAC).

Veja [`docs/`](./docs/) para PRD, modelo de dados, arquitetura, wireframes e backlog completo.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| API | NestJS 11 · Prisma 6 · PostgreSQL 16 · Redis (BullMQ) · Socket.IO |
| Compartilhado | Zod (DTOs) · pnpm workspaces · Turborepo |
| Infra | Docker · Railway (MVP) · GitHub Actions |
| Observabilidade | Pino (logs) · Sentry |

---

## Estrutura do monorepo

```
deliveryhub/
├── apps/
│   ├── api/          # NestJS — REST, Socket.IO, BullMQ workers
│   └── web/          # Next.js — UI do operador
├── packages/
│   ├── db/           # Prisma schema, migrations, client
│   ├── shared/       # tipos, constantes, schemas Zod
│   ├── ifood/        # adapter da plataforma iFood
│   └── config/       # tsconfig + eslint compartilhados
├── docs/             # PRD, ERD, arquitetura, wireframes, backlog
├── infra/
│   ├── docker/       # Dockerfiles api e web
│   └── postgres/     # init.sql
└── .github/workflows # CI
```

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

# 2. subir Postgres e Redis
pnpm docker:up

# 3. configurar .env
Copy-Item .env.example .env
# edite .env conforme necessário (VAULT_MASTER_KEY, JWT secrets, etc.)

# 4. gerar Prisma client e aplicar migrations
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. rodar API e Web em paralelo (Turborepo)
pnpm dev
```

- API → http://localhost:3333/api/healthz
- Web → http://localhost:3000

---

## Scripts disponíveis (raiz)

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe API + Web em watch via Turborepo |
| `pnpm build` | Build de todos os apps/packages |
| `pnpm lint` | ESLint em tudo |
| `pnpm typecheck` | TS sem emit em tudo |
| `pnpm test` | Testes (Vitest) em tudo |
| `pnpm format` | Prettier em escrita |
| `pnpm db:generate` | Gera Prisma Client |
| `pnpm db:migrate` | Cria nova migration (dev) |
| `pnpm db:seed` | Roda seed (popula `platform`) |
| `pnpm db:studio` | Prisma Studio (visualizador) |
| `pnpm docker:up` | Sobe Postgres + Redis |
| `pnpm docker:down` | Encerra Postgres + Redis |

---

## Documentação interna

- [PRD do MVP](docs/01-prd.md) — escopo, MoSCoW, KPIs, roadmap
- [Modelo de dados](docs/02-data-model.md) — ERD + tabelas + justificativas
- [Arquitetura](docs/03-architecture.md) — componentes, filas, fluxos críticos
- [Wireframes low-fi](docs/04-wireframes.md) — 7 telas-chave em ASCII
- [Backlog](docs/05-backlog.md) — 10 épicos, ~80 stories, plano de 12 sprints

---

## Convenções

- **UI e documentação em PT-BR**; código (identificadores, commits, comentários) em **inglês**.
- **Dinheiro sempre em centavos** (`BIGINT`) — zero float em cálculos financeiros.
- **Multi-tenant in-app**: todo método de service que toca `Prisma` filtra por `organizationId` via `TenantPrismaService` + `AsyncLocalStorage`. Teste obrigatório no DoD.
- **Sem `console.log`** em produção — use o logger Pino injetado.
- **Migrations reversíveis**: `prisma migrate dev` localmente; rollback é revert do commit + `prisma migrate resolve`.

---

## Licença

Propriedade — todos os direitos reservados.
