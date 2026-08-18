-- AlterTable
ALTER TABLE "order" ADD COLUMN "order_timing" TEXT;
ALTER TABLE "order" ADD COLUMN "order_type" TEXT;
ALTER TABLE "order" ADD COLUMN "scheduled_delivery_at" TIMESTAMP(3);
