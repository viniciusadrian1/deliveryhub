-- CreateEnum
CREATE TYPE "pause_scope" AS ENUM ('store', 'category', 'item');

-- CreateEnum
CREATE TYPE "pause_reason" AS ENUM ('kitchen_overloaded', 'end_of_shift', 'out_of_stock', 'scheduled', 'other');

-- CreateTable
CREATE TABLE "pause" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "scope" "pause_scope" NOT NULL,
    "category_id" TEXT,
    "menu_item_id" TEXT,
    "platform_ids" TEXT[],
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "reason" "pause_reason" NOT NULL DEFAULT 'other',
    "reason_note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pause_organization_id_store_id_starts_at_idx" ON "pause"("organization_id", "store_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "pause_ends_at_idx" ON "pause"("ends_at");

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause" ADD CONSTRAINT "pause_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
