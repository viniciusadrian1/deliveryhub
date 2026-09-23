import { describe, expect, it } from 'vitest';
import {
  createPurchaseSchema,
  createIngredientSchema,
  createSupplierSchema,
} from './inventory.dto';
const id = '550e8400-e29b-41d4-a716-446655440000';
const purchase = { storeId: id, ingredientId: id, quantity: '1', unitCost: '2' };
describe('inventory input validation', () => {
  it('preserves leading zeroes in invoice numbers', () =>
    expect(createPurchaseSchema.parse({ ...purchase, invoiceNumber: '000123' }).invoiceNumber).toBe(
      '000123',
    ));
  it.each(['A123', '12e3', '12.3', '-12'])('rejects invoice %s', (invoiceNumber) =>
    expect(createPurchaseSchema.safeParse({ ...purchase, invoiceNumber }).success).toBe(false),
  );
  it('accepts comma decimals for minimum stock and purchases', () => {
    expect(
      createIngredientSchema.parse({ storeId: id, name: 'Farinha', unit: 'gram', minLevel: '1,5' })
        .minLevel,
    ).toBe('1.5');
    expect(createPurchaseSchema.parse({ ...purchase, unitCost: '0,045' }).unitCost).toBe('0.045');
  });
  it('rejects invalid supplier document', () =>
    expect(createSupplierSchema.safeParse({ name: 'Teste', document: '123' }).success).toBe(false));
});
