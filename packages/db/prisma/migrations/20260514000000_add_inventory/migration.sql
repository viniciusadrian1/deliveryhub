-- =============================================================
-- Inventory: insumos, sub-receitas, estoque, fornecedores
-- =============================================================

-- ----- Enums -----
CREATE TYPE "ingredient_unit" AS ENUM ('gram', 'kilogram', 'milliliter', 'liter', 'unit');
CREATE TYPE "ingredient_kind" AS ENUM ('raw', 'sub_recipe');
CREATE TYPE "stock_movement_reason" AS ENUM (
  'purchase', 'sale', 'adjustment', 'waste',
  'transfer_in', 'transfer_out', 'initial', 'recipe_consumption'
);
CREATE TYPE "cost_mode" AS ENUM ('manual', 'recipe');

-- ----- MenuItem: add cost_mode -----
ALTER TABLE "menu_item" ADD COLUMN "cost_mode" "cost_mode" NOT NULL DEFAULT 'manual';

-- ----- Supplier -----
CREATE TABLE "supplier" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" JSONB,
  "notes" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_organization_id_idx" ON "supplier"("organization_id");

ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ----- Ingredient -----
CREATE TABLE "ingredient" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "kind" "ingredient_kind" NOT NULL DEFAULT 'raw',
  "name" TEXT NOT NULL,
  "unit" "ingredient_unit" NOT NULL,
  "cost_per_unit" DECIMAL(18, 8) NOT NULL DEFAULT 0,
  "batch_yield" DECIMAL(18, 8),
  "notes" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ingredient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_organization_id_store_id_idx" ON "ingredient"("organization_id", "store_id");
CREATE INDEX "ingredient_organization_id_kind_idx" ON "ingredient"("organization_id", "kind");

ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridade adicional: cost_per_unit nao pode ser negativo;
-- batch_yield, quando presente, precisa ser > 0.
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_cost_non_negative"
  CHECK ("cost_per_unit" >= 0);
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_batch_yield_positive"
  CHECK ("batch_yield" IS NULL OR "batch_yield" > 0);
-- Sub-receita PRECISA ter batchYield (custo unitario = total / yield).
-- raw NAO usa batchYield (deixamos NULL).
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_subrecipe_requires_yield"
  CHECK (
    ("kind" = 'sub_recipe' AND "batch_yield" IS NOT NULL) OR
    ("kind" = 'raw' AND "batch_yield" IS NULL)
  );

-- ----- IngredientPurchase -----
CREATE TABLE "ingredient_purchase" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "ingredient_id" TEXT NOT NULL,
  "supplier_id" TEXT,
  "quantity" DECIMAL(18, 8) NOT NULL,
  "unit_cost" DECIMAL(18, 8) NOT NULL,
  "total_cost" DECIMAL(18, 8) NOT NULL,
  "invoice_number" TEXT,
  "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_purchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_purchase_org_store_at_idx"
  ON "ingredient_purchase"("organization_id", "store_id", "purchased_at" DESC);
CREATE INDEX "ingredient_purchase_ingredient_at_idx"
  ON "ingredient_purchase"("ingredient_id", "purchased_at" DESC);

ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_quantity_positive"
  CHECK ("quantity" > 0);
ALTER TABLE "ingredient_purchase" ADD CONSTRAINT "ingredient_purchase_unit_cost_non_negative"
  CHECK ("unit_cost" >= 0);

-- ----- StockMovement -----
CREATE TABLE "stock_movement" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "ingredient_id" TEXT NOT NULL,
  "quantity" DECIMAL(18, 8) NOT NULL,
  "reason" "stock_movement_reason" NOT NULL,
  "ref_type" TEXT,
  "ref_id" TEXT,
  "notes" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_movement_ref_unique"
  ON "stock_movement"("ref_type", "ref_id", "ingredient_id");
CREATE INDEX "stock_movement_org_store_ingredient_at_idx"
  ON "stock_movement"("organization_id", "store_id", "ingredient_id", "created_at" DESC);
CREATE INDEX "stock_movement_ingredient_at_idx"
  ON "stock_movement"("ingredient_id", "created_at" DESC);

ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Quantity != 0 (zero nao faz sentido; saidas sao negativas, entradas positivas)
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_quantity_nonzero"
  CHECK ("quantity" <> 0);

-- ----- RecipeComponent -----
CREATE TABLE "recipe_component" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "menu_item_id" TEXT,
  "parent_ingredient_id" TEXT,
  "ingredient_id" TEXT NOT NULL,
  "quantity" DECIMAL(18, 8) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_component_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_component_menu_item_id_idx" ON "recipe_component"("menu_item_id");
CREATE INDEX "recipe_component_parent_ingredient_id_idx" ON "recipe_component"("parent_ingredient_id");
CREATE INDEX "recipe_component_ingredient_id_idx" ON "recipe_component"("ingredient_id");

ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_parent_ingredient_id_fkey"
  FOREIGN KEY ("parent_ingredient_id") REFERENCES "ingredient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Polimorfismo: exatamente um dos pais preenchido.
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_parent_xor"
  CHECK (
    ("menu_item_id" IS NOT NULL AND "parent_ingredient_id" IS NULL) OR
    ("menu_item_id" IS NULL AND "parent_ingredient_id" IS NOT NULL)
  );
-- Quantity positiva.
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_quantity_positive"
  CHECK ("quantity" > 0);
