-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('pending', 'partial', 'reconciled', 'mismatch');

-- CreateTable
CREATE TABLE "payout" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "reference_period_start" DATE NOT NULL,
    "reference_period_end" DATE NOT NULL,
    "expected_amount_cents" BIGINT NOT NULL,
    "expected_pay_date" DATE,
    "received_amount_cents" BIGINT,
    "received_at" TIMESTAMP(3),
    "bank_transaction_id" TEXT,
    "status" "payout_status" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_organization_id_status_idx" ON "payout"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payout_organization_id_store_id_expected_pay_date_idx" ON "payout"("organization_id", "store_id", "expected_pay_date");

-- CreateIndex
CREATE UNIQUE INDEX "payout_platform_id_store_id_reference_period_start_referenc_key" ON "payout"("platform_id", "store_id", "reference_period_start", "reference_period_end");

-- CreateIndex
CREATE INDEX "bank_transaction_organization_id_store_id_date_idx" ON "bank_transaction"("organization_id", "store_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_store_id_date_amount_cents_description_key" ON "bank_transaction"("store_id", "date", "amount_cents", "description");

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
