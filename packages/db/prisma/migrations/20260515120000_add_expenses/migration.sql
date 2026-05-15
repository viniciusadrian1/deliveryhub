-- ===============================================================
-- Despesas operacionais (alimentam o DRE real)
-- ===============================================================

CREATE TYPE "expense_category" AS ENUM (
  'rent',
  'utilities',
  'payroll',
  'ingredients_misc',
  'marketing',
  'taxes',
  'equipment',
  'software',
  'fuel',
  'packaging',
  'cleaning',
  'other'
);

CREATE TYPE "expense_recurrence" AS ENUM (
  'one_time',
  'monthly',
  'weekly',
  'daily'
);

CREATE TABLE "expense" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "store_id"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "category"        "expense_category" NOT NULL,
  "amount_cents"    INTEGER NOT NULL,
  "recurrence"      "expense_recurrence" NOT NULL DEFAULT 'one_time',
  "due_day"         INTEGER,
  "occurred_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"        TIMESTAMP(3),
  "payment_method"  TEXT,
  "notes"           TEXT,
  "created_by_id"   TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expense_org_store_occurred_idx"
  ON "expense"("organization_id", "store_id", "occurred_at" DESC);
CREATE INDEX "expense_org_category_idx"
  ON "expense"("organization_id", "category");

ALTER TABLE "expense" ADD CONSTRAINT "expense_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense" ADD CONSTRAINT "expense_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- amount_cents nao pode ser negativo
ALTER TABLE "expense" ADD CONSTRAINT "expense_amount_non_negative"
  CHECK ("amount_cents" >= 0);
-- due_day, quando recurrence != one_time, deve estar no range valido:
-- monthly: 1-28 (evita 29/30/31 que nao existem em todo mes)
-- weekly: 0-6 (dom-sab)
-- daily: ignorado
ALTER TABLE "expense" ADD CONSTRAINT "expense_due_day_valid"
  CHECK (
    "recurrence" = 'one_time'
    OR "recurrence" = 'daily'
    OR ("recurrence" = 'monthly' AND ("due_day" IS NULL OR ("due_day" >= 1 AND "due_day" <= 28)))
    OR ("recurrence" = 'weekly'  AND ("due_day" IS NULL OR ("due_day" >= 0 AND "due_day" <= 6)))
  );
