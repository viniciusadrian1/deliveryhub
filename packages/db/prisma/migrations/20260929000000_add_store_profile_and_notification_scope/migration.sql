ALTER TABLE "store" ADD COLUMN "logo_url" TEXT;

ALTER TABLE "notification" ADD COLUMN "store_id" TEXT;

ALTER TABLE "notification"
  ADD CONSTRAINT "notification_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notification_user_id_store_id_created_at_idx"
  ON "notification"("user_id", "store_id", "created_at" DESC);
