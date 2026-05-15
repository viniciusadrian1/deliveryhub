/**
 * Tipos do módulo Inventory — espelham os DTOs/responses do backend.
 *
 * Decimais vêm como string pra preservar precisão (Decimal(18,8)).
 * Centavos são number normal.
 */

export type IngredientUnit = 'gram' | 'kilogram' | 'milliliter' | 'liter' | 'unit';
export type IngredientKind = 'raw' | 'sub_recipe';
export type CostMode = 'manual' | 'recipe';

export type StockMovementReason =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'waste'
  | 'transfer_in'
  | 'transfer_out'
  | 'initial'
  | 'recipe_consumption';

export const INGREDIENT_UNIT_LABELS: Record<IngredientUnit, string> = {
  gram: 'g',
  kilogram: 'kg',
  milliliter: 'ml',
  liter: 'L',
  unit: 'un',
};

export const INGREDIENT_UNIT_FULL_LABELS: Record<IngredientUnit, string> = {
  gram: 'gramas',
  kilogram: 'quilogramas',
  milliliter: 'mililitros',
  liter: 'litros',
  unit: 'unidades',
};

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  purchase: 'Compra',
  sale: 'Venda',
  adjustment: 'Ajuste manual',
  waste: 'Perda',
  transfer_in: 'Transferência (entrada)',
  transfer_out: 'Transferência (saída)',
  initial: 'Saldo inicial',
  recipe_consumption: 'Consumo por pedido',
};

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  organizationId: string;
  storeId: string;
  kind: IngredientKind;
  name: string;
  unit: IngredientUnit;
  /** Decimal(18,8) serializado como string. */
  costPerUnit: string;
  /** Decimal(18,8) — só para sub_recipe. */
  batchYield: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientPurchase {
  id: string;
  organizationId: string;
  storeId: string;
  ingredientId: string;
  supplierId: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  invoiceNumber: string | null;
  purchasedAt: string;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  ingredient?: { id: string; name: string; unit: IngredientUnit };
  supplier?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  storeId: string;
  ingredientId: string;
  quantity: string;
  reason: StockMovementReason;
  refType: string | null;
  refId: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  ingredient?: { id: string; name: string; unit: IngredientUnit };
  createdBy?: { id: string; name: string } | null;
}

export interface StockBalance {
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  kind: IngredientKind;
  balance: string;
  /** Saldo em valor monetário (centavos). */
  valueCents: number;
}

export interface RecipeComponentResponse {
  id: string;
  organizationId: string;
  menuItemId: string | null;
  parentIngredientId: string | null;
  ingredientId: string;
  quantity: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  ingredient: {
    id: string;
    name: string;
    unit: IngredientUnit;
    kind: IngredientKind;
    costPerUnit: string;
  };
}

export interface MenuItemRecipeResponse {
  menuItemId: string;
  costMode: CostMode;
  costCents: number;
  components: RecipeComponentResponse[];
}

export interface SubRecipeResponse {
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  batchYield: string | null;
  costPerUnit: string;
  components: RecipeComponentResponse[];
}

/** Linha em edição no RecipeBuilder (não-persistida). */
export interface RecipeBuilderRow {
  ingredientId: string;
  /** Sempre string pra UI; convertemos pra Decimal no payload. */
  quantity: string;
}
