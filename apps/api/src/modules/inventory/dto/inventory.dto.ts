import { z } from 'zod';

// =====================================================================
// Common
// =====================================================================

/**
 * Decimal vindo do frontend como string (preserva precisao em transito).
 * Aceita "0", "1.5", "0.045", etc. Conversao final para Prisma.Decimal
 * acontece no service.
 */
const decimalString = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^[-+]?\d+(\.\d+)?$/.test(v), 'expected_decimal')
  .refine((v) => Number.isFinite(parseFloat(v)), 'invalid_decimal');

const positiveDecimal = decimalString.refine(
  (v) => parseFloat(v) > 0,
  'must_be_positive',
);

const nonNegativeDecimal = decimalString.refine(
  (v) => parseFloat(v) >= 0,
  'must_be_non_negative',
);

const INGREDIENT_UNITS = ['gram', 'kilogram', 'milliliter', 'liter', 'unit'] as const;
const INGREDIENT_KINDS = ['raw', 'sub_recipe'] as const;
const STOCK_MOVEMENT_REASONS = [
  'purchase',
  'sale',
  'adjustment',
  'waste',
  'transfer_in',
  'transfer_out',
  'initial',
  'recipe_consumption',
] as const;

// =====================================================================
// Supplier
// =====================================================================

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  document: z.string().max(40).trim().optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(40).trim().optional(),
  address: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// =====================================================================
// Ingredient
// =====================================================================

export const createIngredientSchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(INGREDIENT_KINDS).default('raw'),
  name: z.string().min(1).max(200).trim(),
  unit: z.enum(INGREDIENT_UNITS),
  /**
   * Para `raw`: custo unitario digitado (em real/unidade-base). Pode ser 0.
   * Para `sub_recipe`: ignorado — calculado pelo RecipeCostService.
   */
  costPerUnit: nonNegativeDecimal.optional(),
  /**
   * Obrigatorio para sub_recipe; nao usado para raw.
   * Ex.: "molho da casa" rende 500g por preparo -> batchYield=500.
   */
  batchYield: positiveDecimal.optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;

export const updateIngredientSchema = createIngredientSchema.partial().omit({
  storeId: true,
  kind: true,
});
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

// =====================================================================
// IngredientPurchase
// =====================================================================

export const createPurchaseSchema = z.object({
  storeId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  quantity: positiveDecimal,
  unitCost: nonNegativeDecimal,
  invoiceNumber: z.string().max(80).trim().optional(),
  purchasedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const listPurchasesQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;

// =====================================================================
// Stock Movement (ajustes manuais)
// =====================================================================

export const createStockAdjustmentSchema = z.object({
  storeId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  /** Positivo = entrada, negativo = saida. Zero rejeitado pelo CHECK do DB. */
  quantity: decimalString.refine(
    (v) => parseFloat(v) !== 0,
    'quantity_cannot_be_zero',
  ),
  reason: z.enum(['adjustment', 'waste', 'transfer_in', 'transfer_out', 'initial']),
  notes: z.string().max(2000).optional(),
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;

export const listMovementsQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional(),
  reason: z.enum(STOCK_MOVEMENT_REASONS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;

export const balanceQuerySchema = z.object({
  storeId: z.string().uuid(),
  ingredientId: z.string().uuid().optional(),
});
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;

// =====================================================================
// Recipe components
// =====================================================================

const recipeComponentSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: positiveDecimal,
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Substitui a receita inteira do MenuItem (replace-all). Cliente envia o
 * array final; service calcula diff e aplica. Simplifica a UX da tabela
 * editavel no recipe-builder.
 */
export const setMenuItemRecipeSchema = z.object({
  components: z.array(recipeComponentSchema).max(50),
});
export type SetMenuItemRecipeInput = z.infer<typeof setMenuItemRecipeSchema>;

/** Mesmo formato, mas para o "pai" sub-receita. */
export const setSubRecipeSchema = setMenuItemRecipeSchema;
export type SetSubRecipeInput = z.infer<typeof setSubRecipeSchema>;
