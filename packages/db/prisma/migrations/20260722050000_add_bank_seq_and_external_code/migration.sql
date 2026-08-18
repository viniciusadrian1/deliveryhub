-- AlterTable: codigo externo real (EAN/SKU) do item na plataforma, p/ promocoes
ALTER TABLE "menu_item_platform_config" ADD COLUMN "external_code" TEXT;

-- AlterTable: sequencial de desempate p/ transacoes bancarias legitimamente iguais no dia
ALTER TABLE "bank_transaction" ADD COLUMN "seq" INTEGER NOT NULL DEFAULT 0;

-- DropIndex + CreateIndex: dedupe passa a considerar o seq
DROP INDEX "bank_transaction_store_id_date_amount_cents_description_key";
CREATE UNIQUE INDEX "bank_transaction_store_id_date_amount_cents_description_seq_key" ON "bank_transaction"("store_id", "date", "amount_cents", "description", "seq");
