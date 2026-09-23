import { describe, expect, it } from 'vitest';
import { moneyInput, parseMoneyCents } from './money';

describe('BRL expense input', () => {
  it.each([
    ['3500,00', 350000],
    ['3.500,00', 350000],
    ['3500.00', 350000],
    ['3.500', 350000],
    ['0,01', 1],
    ['0', 0],
  ])('parses %s', (input, cents) => expect(parseMoneyCents(input as string)).toBe(cents));
  it.each(['', '-1', 'abc', '1,2,3', '12foo', '1.234.50'])('rejects %s', (input) =>
    expect(parseMoneyCents(input)).toBeNull(),
  );
  it('preserves a saved expense when opening and saving unchanged', () =>
    expect(parseMoneyCents(moneyInput(350000))).toBe(350000));
  it('preserves ten salaries when editing the unit value', () =>
    expect(parseMoneyCents(moneyInput(2500000 / 10))! * 10).toBe(2500000));
});
