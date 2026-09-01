# Keeta Standard API — contrato para a migração (Open Delivery → Standard)

> Extraído da doc oficial (api-docs.mykeeta.com/apis/standard) em 19/08/2026.
> ⚠️ Shapes de JSON campo-a-campo precisam de confirmação contra a **API real + merchant de teste**.

## Base
- **Host de API:** `https://open.mykeeta.com` — chamadas em `/api/open/...`
- **Consent do merchant:** `https://merchant.mykeeta.com/m/web/openapi/authorize`

## Autenticação (MUDA em relação ao Open Delivery)
- Credenciais: **`appId`** (numérico) + **`appSecret`** (string) do portal de dev.
- **Fluxo OAuth `authorization_code`** (NÃO `client_credentials` como no Open Delivery):
  1. Merchant abre `…/authorize?responseType=authorization_code&appId=…&scope=all&redirectUri=…&state=…` → autoriza → volta um **`code`** (via redirect OU webhook **Event 1** server-callback).
  2. `POST /api/open/base/oauth/token` (grantType `authorization_code` + `code`) → `{accessToken, refreshToken, expiresIn: 7776000 (90d), scope}`.
  3. Refresh: mesmo endpoint, `grantType=refresh_token`.
- **Assinatura (MUDA):** NÃO é `X-App-Signature` HMAC. É um **parâmetro `sig`** = **SHA-256** (não HMAC) de:
  `FULL_URL + "?" + params_ordenados_por_chave(key=value&…) + appSecret` → hex minúsculo (64 chars).
  - `accessToken` vai como **parâmetro** normal (entra no sig ordenado), não como header `Authorization: Bearer`.
  - `timestamp` em **segundos** (string). Content-Type `application/json` no POST.
- 1 `appId` autoriza vários merchants (cada um = `shopId`).

## Order API — `POST /api/open/order/*`
| Endpoint | Uso |
|---|---|
| `/order/get` | detalhe do pedido (itens, cliente, valores + **settlement/comissão**) |
| `/order/confirm` | aceitar |
| `/order/prepare` | pronto p/ coleta |
| `/order/cancel` | cancelar |
| `/order/collect` | confirmar coleta/retirada |
| `/order/agree` / `/order/reject` | aprovar/recusar reembolso (webhooks 1005 full / 1007 partial) |
| `/order/refund/part/products/preview` + `/refund/part/apply` | reembolso parcial |
| `/order/dispatched` `/delivered` `/updateCourierInfo` + `/delivery/merchant/self/delivery/callback` | **entrega própria** (dispatch/tracking) |

Settlement/comissão vêm **no payload do pedido** (`/order/get`). Eventos: 1001 novo pedido, 1005/1007 reembolso.

## Store API — `POST /api/open/scm/shop/*`
| Endpoint | Uso |
|---|---|
| `/shop/status/rest` | **PAUSAR** loja |
| `/shop/status/open` | **REABRIR** loja |
| `/shop/base/get` | dados da loja (nome, endereço, categorias, status) |
| `/shop/business/hour/effective/get`/`update` | horário regular |
| `/shop/special/business/hour/effective/get`/`update` | horário especial/feriado |
| `/shop/picture/main/update` · `/shop/contact/update` | imagem / telefone |

## Menu API — `POST /api/open/product/*` (+ `/base/image/upload`)
**Dois estilos:** OpenItemCode-based (bulk, recomendado) e Keeta-ID-based (granular).

| Endpoint | Uso |
|---|---|
| `/product/menu/sync` | **upsert do cardápio inteiro** (async; matching por `openItemCode`). É também o **veículo de PREÇO** — não há endpoint de preço isolado. |
| `/product/spustatus/batchupdatebycode` | **disponibilidade** (ativar/desativar SPU por openItemCode) |
| `/product/choicegroupskustatus/batchupdatebycode` | disponibilidade de complemento |
| `/product/mapping/batchupdatebyname` | bind de openItemCode em produto existente (por nome) |
| `/base/image/upload` | upload de imagem → URL hospedada |
| `/product/shopcategory/create` · `/spu/batchcreate` (≤200) · `/spu/batchupdate` · `/choicegroup/batchcreate` | Keeta-ID granular |
| `/product/spu/list` · `/product/shopcategory/list` | leitura (diff antes do sync) |

Webhooks: conclusão do menu sync (async), bind de imagem (1201).
**Modelo:** Category → SPU (produto) → SKU (variante/preço) → ChoiceGroup (complementos) → ChoiceGroupSku.

## Merchant Authorization — `/api/open/base/*`
| Item | Uso |
|---|---|
| `…/authorize` (consent) | merchant autoriza (responseType=authorization_code) |
| `POST /base/oauth/token` | trocar code por token / refresh |
| `POST /base/authorized/resource/get` | **listar merchants/lojas autorizadas** + info |
| Webhook **Event 1** | code via server-callback |
| Webhook **1301 / 1302 / 1303** | loja adicionada / removida / brand revogada |

✅ Nossos handlers de webhook atuais (1301/1302) **batem com os event codes** — só precisam alinhar ao payload real.

## Gaps (confirmar com API real + merchant de teste)
- Shapes JSON exatos de request/response de cada endpoint (a doc lista campos, não o JSON completo).
- Nome exato do param do `code` no redirect + valor literal de `grantType` na troca inicial.
- Sensibilidade do `sig` ao JSON do body (whitespace/ordem/unicode).
- Se o app atual (Open Delivery) acessa o standard, ou precisa re-registro/re-autorização.
