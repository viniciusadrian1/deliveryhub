-- ===============================================================
-- Pedidos de acao do cliente (cancelamento/reembolso) +
-- dados de pagamento no pedido (Order API extras do 99Food)
-- ===============================================================

-- Novo tipo de notificacao (loja precisa responder um pedido do cliente).
ALTER TYPE "notification_kind" ADD VALUE 'order_action_request';

-- Order ganha forma de pagamento, quem entrega e a marca de
-- confirmacao de recebimento do dinheiro (pedidos cash).
ALTER TABLE "order"
  ADD COLUMN "payment_method"            TEXT,
  ADD COLUMN "delivery_by"               TEXT,
  ADD COLUMN "cash_payment_confirmed_at" TIMESTAMP(3);

-- Enums dos pedidos de acao.
CREATE TYPE "platform_action_request_kind" AS ENUM (
  'cancellation',
  'refund'
);

CREATE TYPE "platform_action_request_status" AS ENUM (
  'pending',
  'approved',
  'declined'
);

CREATE TABLE "platform_action_request" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "store_id"            TEXT NOT NULL,
  "platform_id"         TEXT NOT NULL,
  "order_id"            TEXT,
  "kind"                "platform_action_request_kind" NOT NULL,
  "status"              "platform_action_request_status" NOT NULL DEFAULT 'pending',
  "external_order_id"   TEXT NOT NULL,
  "external_apply_id"   TEXT NOT NULL,
  "customer_reason"     TEXT,
  "reason_options"      JSONB,
  "evidence_images"     JSONB,
  "resolved_by_user_id" TEXT,
  "resolved_reason"     TEXT,
  "resolved_at"         TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_action_request_pkey" PRIMARY KEY ("id")
);

-- UNIQUE (platform_id, external_apply_id): idempotencia — o webhook de
-- cancelamento/reembolso e reenviado varias vezes com o mesmo apply_id.
CREATE UNIQUE INDEX "platform_action_request_platform_id_external_apply_id_key"
  ON "platform_action_request"("platform_id", "external_apply_id");
CREATE INDEX "platform_action_request_organization_id_status_idx"
  ON "platform_action_request"("organization_id", "status");
CREATE INDEX "platform_action_request_order_id_idx"
  ON "platform_action_request"("order_id");

ALTER TABLE "platform_action_request" ADD CONSTRAINT "platform_action_request_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_action_request" ADD CONSTRAINT "platform_action_request_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_action_request" ADD CONSTRAINT "platform_action_request_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "platform"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_action_request" ADD CONSTRAINT "platform_action_request_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
