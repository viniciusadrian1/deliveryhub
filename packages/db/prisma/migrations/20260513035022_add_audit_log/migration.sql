-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'signup', 'refresh', 'pause', 'resume', 'price_change', 'export', 'consent');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" "audit_action" NOT NULL,
    "diff" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_organization_id_entity_at_idx" ON "audit_log"("organization_id", "entity", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_id_at_idx" ON "audit_log"("user_id", "at" DESC);
