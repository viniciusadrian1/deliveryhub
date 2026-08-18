-- CreateEnum
CREATE TYPE "promotion_status" AS ENUM ('processing', 'active', 'error');

-- CreateTable
CREATE TABLE "promotion" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aggregation_tag" TEXT NOT NULL,
    "external_aggregation_id" TEXT,
    "discount_percent" INTEGER NOT NULL,
    "starts_at" DATE NOT NULL,
    "ends_at" DATE NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "status" "promotion_status" NOT NULL DEFAULT 'processing',
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_organization_id_store_id_idx" ON "promotion"("organization_id", "store_id");

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
