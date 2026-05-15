-- ===============================================================
-- Stock alerts: estoque minimo + sugestao de compra
-- ===============================================================

-- Adiciona valores ao enum existente.
ALTER TYPE "notification_kind" ADD VALUE 'stock_low';

-- Ingredient ganha min_level e target_days.
ALTER TABLE "ingredient"
  ADD COLUMN "min_level"    DECIMAL(18, 8),
  ADD COLUMN "target_days"  INTEGER;

-- min_level, quando presente, precisa ser >= 0.
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_min_level_non_negative"
  CHECK ("min_level" IS NULL OR "min_level" >= 0);
-- target_days, quando presente, precisa ser positivo (entre 1 e 90).
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_target_days_positive"
  CHECK ("target_days" IS NULL OR ("target_days" >= 1 AND "target_days" <= 90));
