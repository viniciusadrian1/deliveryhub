-- =============================================================
-- Catalog: product_kind, sales_kind, combos, modifier groups com kind,
-- modifier linked_menu_item_id e display_unit em recipe_component
-- =============================================================

-- ----- New enums -----
CREATE TYPE "product_kind" AS ENUM ('single', 'combo');
CREATE TYPE "sales_kind" AS ENUM ('main', 'side', 'drink', 'dessert', 'addon');
CREATE TYPE "modifier_group_kind" AS ENUM ('ingredients', 'specifications', 'cross_sell', 'disposables');

-- ----- MenuItem: product_kind + sales_kind -----
ALTER TABLE "menu_item"
  ADD COLUMN "product_kind" "product_kind" NOT NULL DEFAULT 'single',
  ADD COLUMN "sales_kind"   "sales_kind"   NOT NULL DEFAULT 'main';

-- ----- ModifierGroup: kind -----
ALTER TABLE "modifier_group"
  ADD COLUMN "kind" "modifier_group_kind" NOT NULL DEFAULT 'ingredients';

-- ----- Modifier: description, image_url, linked_menu_item_id -----
ALTER TABLE "modifier"
  ADD COLUMN "description"           TEXT,
  ADD COLUMN "image_url"              TEXT,
  ADD COLUMN "linked_menu_item_id"    TEXT;

CREATE INDEX "modifier_linked_menu_item_id_idx" ON "modifier"("linked_menu_item_id");

ALTER TABLE "modifier" ADD CONSTRAINT "modifier_linked_menu_item_id_fkey"
  FOREIGN KEY ("linked_menu_item_id") REFERENCES "menu_item"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ----- RecipeComponent: display_unit (preserva preferencia visual) -----
ALTER TABLE "recipe_component"
  ADD COLUMN "display_unit" "ingredient_unit";

-- ----- ComboComponent (novo modelo) -----
CREATE TABLE "combo_component" (
  "id"                       TEXT NOT NULL,
  "organization_id"          TEXT NOT NULL,
  "combo_menu_item_id"       TEXT NOT NULL,
  "component_menu_item_id"   TEXT NOT NULL,
  "quantity"                 INTEGER NOT NULL DEFAULT 1,
  "sort_order"               INTEGER NOT NULL DEFAULT 0,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "combo_component_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "combo_component_combo_id_component_id_key"
  ON "combo_component"("combo_menu_item_id", "component_menu_item_id");
CREATE INDEX "combo_component_component_menu_item_id_idx"
  ON "combo_component"("component_menu_item_id");

ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_combo_menu_item_id_fkey"
  FOREIGN KEY ("combo_menu_item_id") REFERENCES "menu_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_component_menu_item_id_fkey"
  FOREIGN KEY ("component_menu_item_id") REFERENCES "menu_item"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade: combo nao pode ter ele mesmo como componente.
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_no_self_reference"
  CHECK ("combo_menu_item_id" <> "component_menu_item_id");

-- Quantity positiva.
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_quantity_positive"
  CHECK ("quantity" > 0);
