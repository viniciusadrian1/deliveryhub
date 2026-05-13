-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('pending', 'active', 'error', 'revoked');

-- CreateEnum
CREATE TYPE "notification_kind" AS ENUM ('welcome', 'invitation_accepted', 'integration_error', 'password_changed', 'new_order', 'platform_disconnected', 'payout_mismatch', 'daily_goal', 'system');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('placed', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "order_status_source" AS ENUM ('platform', 'user', 'system');

-- CreateTable
CREATE TABLE "platform_connection" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'pending',
    "vault_ref" TEXT,
    "external_merchant_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_profile" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "payment_processing_pct" DECIMAL(5,2) NOT NULL,
    "flat_fee_cents" BIGINT NOT NULL DEFAULT 0,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_fee_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "prep_time_minutes" INTEGER,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_group" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "modifier_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost_delta_cents" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_platform_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_category_id" TEXT,
    "selling_price_cents" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "channel_in_app" BOOLEAN NOT NULL DEFAULT true,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "phone_hash" TEXT,
    "document_hash" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "name" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'placed',
    "subtotal_cents" INTEGER NOT NULL,
    "delivery_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "processing_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "flat_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "net_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "placed_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "external_id" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_modifier" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "modifier_id" TEXT,
    "external_id" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,

    CONSTRAINT "order_item_modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_event" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "order_status" NOT NULL,
    "source" "order_status_source" NOT NULL,
    "actor_user_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "order_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_secret" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_secret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_connection_organization_id_idx" ON "platform_connection"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connection_store_id_platform_id_key" ON "platform_connection"("store_id", "platform_id");

-- CreateIndex
CREATE INDEX "platform_fee_profile_organization_id_idx" ON "platform_fee_profile"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_profile_store_id_platform_id_effective_from_key" ON "platform_fee_profile"("store_id", "platform_id", "effective_from");

-- CreateIndex
CREATE INDEX "category_organization_id_store_id_idx" ON "category"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "menu_item_organization_id_store_id_idx" ON "menu_item"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "menu_item_category_id_idx" ON "menu_item"("category_id");

-- CreateIndex
CREATE INDEX "modifier_group_menu_item_id_idx" ON "modifier_group"("menu_item_id");

-- CreateIndex
CREATE INDEX "modifier_modifier_group_id_idx" ON "modifier"("modifier_group_id");

-- CreateIndex
CREATE INDEX "menu_item_platform_config_organization_id_idx" ON "menu_item_platform_config"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_platform_config_menu_item_id_platform_id_key" ON "menu_item_platform_config"("menu_item_id", "platform_id");

-- CreateIndex
CREATE INDEX "notification_user_id_created_at_idx" ON "notification"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_user_id_kind_key" ON "notification_preference"("user_id", "kind");

-- CreateIndex
CREATE INDEX "customer_organization_id_last_seen_at_idx" ON "customer"("organization_id", "last_seen_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_organization_id_phone_hash_key" ON "customer"("organization_id", "phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organization_id_document_hash_key" ON "customer"("organization_id", "document_hash");

-- CreateIndex
CREATE INDEX "order_organization_id_store_id_placed_at_idx" ON "order"("organization_id", "store_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "order_organization_id_status_idx" ON "order"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "order_platform_id_external_id_key" ON "order"("platform_id", "external_id");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_modifier_order_item_id_idx" ON "order_item_modifier"("order_item_id");

-- CreateIndex
CREATE INDEX "order_status_event_order_id_at_idx" ON "order_status_event"("order_id", "at" DESC);

-- CreateIndex
CREATE INDEX "webhook_event_received_at_idx" ON "webhook_event"("received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_platform_id_external_id_key" ON "webhook_event"("platform_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_secret_name_key" ON "vault_secret"("name");

-- AddForeignKey
ALTER TABLE "platform_connection" ADD CONSTRAINT "platform_connection_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_connection" ADD CONSTRAINT "platform_connection_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_connection" ADD CONSTRAINT "platform_connection_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_profile" ADD CONSTRAINT "platform_fee_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_profile" ADD CONSTRAINT "platform_fee_profile_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_profile" ADD CONSTRAINT "platform_fee_profile_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_group" ADD CONSTRAINT "modifier_group_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_group" ADD CONSTRAINT "modifier_group_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_platform_config" ADD CONSTRAINT "menu_item_platform_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_platform_config" ADD CONSTRAINT "menu_item_platform_config_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_platform_config" ADD CONSTRAINT "menu_item_platform_config_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifier" ADD CONSTRAINT "order_item_modifier_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifier" ADD CONSTRAINT "order_item_modifier_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "modifier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_event" ADD CONSTRAINT "order_status_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
