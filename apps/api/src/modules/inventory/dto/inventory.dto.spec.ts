import { describe, expect, it } from 'vitest';

import { createIngredientSchema, createPurchaseSchema } from './inventory.dto.js';

describe('inventory decimal inputs', () => {
  it('accepts Brazilian comma decimals for ingredients', () => {
    const result = createIngredientSchema.parse({
      storeId: '00000000-0000-4000-8000-000000000001',
      name: 'Farinha',
      unit: 'gram',
      costPerUnit: '0,045',
      minLevel: '100',
      targetDays: 7,
    });

    expect(result.costPerUnit).toBe('0.045');
  });

  it('keeps purchase costs compatible with comma and dot notation', () => {
    const result = createPurchaseSchema.parse({
      storeId: '00000000-0000-4000-8000-000000000001',
      ingredientId: '00000000-0000-4000-8000-000000000002',
      quantity: '1,5',
      unitCost: '12.34',
      invoiceNumber: '12345',
      purchasedAt: '2026-09-25',
    });

    expect(result.quantity).toBe('1.5');
    expect(result.unitCost).toBe('12.34');
  });
});
