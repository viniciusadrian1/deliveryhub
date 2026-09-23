import { describe, it, expect } from 'vitest';
import { isValidSupplierDocument } from './documents.js';
describe('supplier document validation', () => {
  it.each(['', '11.222.333/0001-81', '11222333000181', '529.982.247-25', '12.ABC.345/01DE-35'])(
    'accepts %s',
    (input) => expect(isValidSupplierDocument(input)).toBe(true),
  );
  it.each([
    '11111111111111',
    '00000000000000',
    '11.222.333/0001-82',
    '52998224724',
    '123',
    'invalid!',
  ])('rejects %s', (input) => expect(isValidSupplierDocument(input)).toBe(false));
});
