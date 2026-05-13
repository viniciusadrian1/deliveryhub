# Deploy do DeliveryHub no Railway

## Pré-requisitos

- Conta no [Railway](https://railway.com) (free tier serve para staging).
- CLI instalada: `npm i -g @railway/cli` e `railway login`.
- Repositório Git no GitHub (Railway lê daí).

## Estrutura do projeto no Railway

Recomendado **um projeto Railway com 4 services**:

| Service | Tipo | Imagem / config |
|---|---|---|
| `api` | Docker | `infra/docker/api.Dockerfile` (já configurado em `railway.json`) |
| `web` | Docker | `infra/docker/web.Dockerfile` |
| `postgres` | Add-on | PostgreSQL 16 (Railway plugin) |
| `redis` | Add-on | Redis 7 (Railway plugin) |

## Passos de deploy inicial

1. **Criar projeto e conectar repositório.**
   ```bash
   railway init
   railway link  # se já existe
   ```

2. **Provisionar Postgres + Redis** via UI ou CLI:
   ```bash
   railway add --plugin postgresql
   railway add --plugin redis
   ```

3. **Criar service `api`**: aponta para `infra/docker/api.Dockerfile`. Railway detecta o `railway.json` na raiz e usa o builder Docker automaticamente.

4. **Criar service `web`**: aponta para `infra/docker/web.Dockerfile`. **Trocar o path no `railway.json`** ou criar um `railway.json` separado por service (recomendado: variáveis `RAILWAY_DOCKERFILE_PATH` por service).

5. **Variáveis de ambiente** (em cada service que precisar):

   **`api` + `worker` (mesma imagem, modo via `MODE`):**
   - `MODE` = `api` ou `worker`
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = referenciar `${{Postgres.DATABASE_URL}}`
   - `DATABASE_URL_SHADOW` = não necessário em produção (só `migrate dev` local)
   - `REDIS_URL` = referenciar `${{Redis.REDIS_URL}}`
   - `JWT_ACCESS_SECRET` = gerar com `openssl rand -hex 32`
   - `JWT_REFRESH_SECRET` = idem (valor distinto)
   - `JWT_ACCESS_TTL` = `900`
   - `JWT_REFRESH_TTL` = `2592000`
   - `VAULT_MASTER_KEY` = gerar com `openssl rand -base64 32` ⚠ **se perder, perde acesso aos PII cifrados**
   - `RESEND_API_KEY` = chave Resend para e-mails transacionais
   - `EMAIL_FROM` = `DeliveryHub <no-reply@SEU-DOMINIO>`
   - `WEB_BASE_URL` = URL pública do `web` service
   - `SENTRY_DSN` = projeto Sentry (opcional mas recomendado)
   - `SENTRY_ENVIRONMENT` = `production`
   - `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_API_BASE_URL`, `IFOOD_WEBHOOK_SECRET`
   - `IFOOD_OAUTH_REDIRECT_URI` = `https://<web-domain>/integrations/ifood/callback`

   **`web`:**
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = URL pública do `api` service

6. **Migrations**: aplicar via release command. Edite o `railway.json` do `api` para incluir:
   ```json
   "deploy": {
     "startCommand": "node packages/db/node_modules/prisma/build/index.js migrate deploy && node apps/api/dist/main.js"
   }
   ```
   ou separar em release command no painel.

7. **Domínios**: gerar domínio Railway para `api` e `web`, ou conectar domínio próprio.

8. **Webhook iFood**: configurar no portal iFood apontando para `https://<api-domain>/api/webhooks/ifood` (implementado na Sprint 8).

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) já valida lint+typecheck+test+build a cada PR. Railway faz **auto-deploy do branch `main`** ao detectar push. Não é necessário workflow extra de deploy.

## Rollback

- Railway mantém histórico de deploys. UI → service → deployments → "Rollback to this version".
- Migrations destrutivas: usar [padrão expand-contract](https://martinfowler.com/articles/evodb.html#AllChangesAreMigrationsThatTransitionTheSchema) (Sprint 1+).

## Custos esperados (PME-target)

| Serviço | Plano | Custo/mês aprox. (USD) |
|---|---|---|
| api (1 réplica, 512MB) | Hobby | ~5 |
| web (1 réplica, 512MB) | Hobby | ~5 |
| Postgres 1GB | Hobby | ~5 |
| Redis 256MB | Hobby | ~3 |
| **Total inicial** | | **~18/mês** |

Migrar para AWS quando passar ~50 restaurantes ativos ou volumetria de pedidos > 10k/dia.
