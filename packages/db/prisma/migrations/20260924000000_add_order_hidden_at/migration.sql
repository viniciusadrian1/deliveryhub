ALTER TABLE "order" ADD COLUMN "hidden_at" TIMESTAMP(3);

CREATE INDEX "order_store_id_hidden_at_idx" ON "order"("store_id", "hidden_at");
