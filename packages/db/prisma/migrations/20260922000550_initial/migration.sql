-- RenameIndex
ALTER INDEX "combo_component_combo_id_component_id_key" RENAME TO "combo_component_combo_menu_item_id_component_menu_item_id_key";

-- RenameIndex
ALTER INDEX "expense_org_category_idx" RENAME TO "expense_organization_id_category_idx";

-- RenameIndex
ALTER INDEX "expense_org_store_occurred_idx" RENAME TO "expense_organization_id_store_id_occurred_at_idx";

-- RenameIndex
ALTER INDEX "ingredient_purchase_ingredient_at_idx" RENAME TO "ingredient_purchase_ingredient_id_purchased_at_idx";

-- RenameIndex
ALTER INDEX "ingredient_purchase_org_store_at_idx" RENAME TO "ingredient_purchase_organization_id_store_id_purchased_at_idx";

-- RenameIndex
ALTER INDEX "stock_movement_ingredient_at_idx" RENAME TO "stock_movement_ingredient_id_created_at_idx";

-- RenameIndex
ALTER INDEX "stock_movement_org_store_ingredient_at_idx" RENAME TO "stock_movement_organization_id_store_id_ingredient_id_creat_idx";
