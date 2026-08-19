# Relatório de Prontidão para Produção — DeliveryHub

> Gerado em 18/08/2026. Estado após o sweep de bugs + homologação iFood + Keeta.

## 1. Onde estamos (resumo)

- **Saúde do código:** 44 bugs varridos e corrigidos, `typecheck` 18/18, testes 41 passando, `lint` limpo, boot da API limpo.
- **iFood Order:** homologado (60/60, CONCLUDED).
- **99food:** integração real e funcional.
- **Deploy:** scaffolding pronto (Railway `railway.json` + `render.yaml` + CI `.github/workflows/ci.yml` + guia `docs/06-deploy.md`).
- **Branch com todo o trabalho:** `feat/homologation-bugsweep-keeta` (5 commits).

**Leitura honesta:** o *código* está em boa forma. O que falta pra produção é, na maior parte, **externo** (aprovações/credenciais das plataformas) e **config de ambiente** — não desenvolvimento.

---

## 2. O que já está PRONTO (feito no código)

| Área | Status |
|---|---|
| Sweep de 44 bugs (isolamento tenant, PII, pedidos, dinheiro, segurança) | ✅ |
| iFood Merchant/Catalog — fixes de homologação (interrupções POST/DELETE, status, options) | ✅ |
| Keeta — webhooks de autorização 1301/1302 + ativação de conexão | ✅ (parser a confirmar no 1º payload real) |
| Follow-ups #4 (parse bancário), #12 (promo em item importado), #35 (aviso de taxa faltando) | ✅ |

---

## 3. 🔴 O que depende de VOCÊ ou de externo — passo a passo

### A. iFood — liberar o app para produção  *(o maior gargalo)*
1. **Gravar + reenviar** os vídeos de homologação **Catalog** e **Merchant** (os fixes de código já estão prontos). Roteiro cenário-a-cenário já mapeado.
2. Se quiser conciliação + promoções via iFood: **declarar os escopos Financial e Promotion** no app do Developer Portal e homologá-los.
3. **Aguardar** o iFood tirar o app do status **"Em revisão"** → produção.
- **Depende de:** você (gravar/submeter) + iFood (revisar/aprovar).

### B. Storage de imagens  *(bloqueia upload de foto no cardápio)*
1. Criar um bucket **S3 ou Cloudflare R2**.
2. Preencher no `.env`/Railway: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL`.
- **Depende de:** você (conta de storage). Código já pronto — hoje upload retorna 503 sem isso.

### C. Keeta — colocar de pé
1. **Obter** no portal (`developers.mykeeta.com`): **Application ID** (= `client_id`) e **Secret key** (= `client_secret`). A Keeta **não fornece webhook secret separado** — o mesmo `client_secret` assina as requests e verifica os webhooks.
2. **Configurar** no app da Keeta: URLs `…/api/webhooks/keeta/authorization` (1301) e `…/deauthorization` (1302) + **IP whitelist** do servidor.
3. Setar no `.env` (só 2 vars): `KEETA_CLIENT_ID` e `KEETA_CLIENT_SECRET` (aí o adapter sai do MOCK).
4. Fazer a **1ª autorização de teste** → me mandar o payload do log `keeta_auth_webhook_received` pra eu **confirmar os nomes de campo** do parser (último ajuste fino).
- **Depende de:** você (credenciais + config) + eu (ajuste do parser com o payload real).

### D. Deploy em produção (Railway)
1. **Secrets obrigatórios:** `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VAULT_MASTER_KEY` (≥32 chars cada), + credenciais das plataformas, `SENTRY_DSN`, `STORAGE_*`.
2. **Garantir `IFOOD_AUTOPILOT` desligado** (é flag só de homologação — auto-aceita pedidos).
3. Rodar **migrations**: `prisma migrate deploy`.
4. Cadastrar os **webhooks** das plataformas apontando pra URL pública do deploy (99food + Keeta; iFood é polling, não precisa).
- **Depende de:** você (conta Railway + secrets). Guia detalhado em `docs/06-deploy.md`.

---

## 4. 🟡 Integrações — status por plataforma

| Plataforma | Estado |
|---|---|
| iFood — Order | ✅ Homologado |
| 99food | ✅ Real |
| iFood — Catalog/Merchant | 🔧 Fixes prontos → reenviar vídeo |
| Keeta | 🔧 Auth pronto → credenciais + confirmar payload |
| Rappi / UberEats / AiQfome | 🎭 MOCK (marcadas "roadmap" na UI; cada uma é um adapter novo se quiser ativar) |

---

## 5. 🟢 Melhorias recomendadas (não bloqueiam produção)

- **Cobertura de testes**: hoje 6 spec files. Vale cobrir dinheiro/pedido/isolamento-tenant antes de escalar clientes.
- **Rate-limit**: hoje in-memory (ok pra 1 instância Railway). Multi-instância pede versão Redis-backed.
- **Billing**: fora do MVP — onboarding manual por enquanto.
- **Follow-ups de feature adiados**: #32 login multi-org, #34 UX de onboarding multi-loja (ambos são features, não bugs).
- **Revisão legal**: LGPD/termos (o módulo de compliance já existe no código).

---

## 6. Levar o trabalho pra `main`

```bash
git checkout main && git merge feat/homologation-bugsweep-keeta
```

É fast-forward (sem conflito). `push` depois, se houver remoto.
