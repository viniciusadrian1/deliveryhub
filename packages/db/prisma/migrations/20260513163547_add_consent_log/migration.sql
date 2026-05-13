-- CreateEnum
CREATE TYPE "consent_subject_kind" AS ENUM ('user', 'customer');

-- CreateEnum
CREATE TYPE "consent_kind" AS ENUM ('terms', 'privacy', 'marketing');

-- CreateTable
CREATE TABLE "consent_log" (
    "id" TEXT NOT NULL,
    "subject_kind" "consent_subject_kind" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "kind" "consent_kind" NOT NULL,
    "version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_log_subject_kind_subject_id_at_idx" ON "consent_log"("subject_kind", "subject_id", "at" DESC);
