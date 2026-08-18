import { describe, expect, it } from 'vitest';

import { BankImportService } from './bank-import.service.js';

// parseAmountCents é privado, mas é lógica de dinheiro pura (não usa as deps
// injetadas), então instanciamos com deps dummy e chamamos via cast tipado.
// Cobre a regressão do bug: `.` como separador decimal (Nubank/Wise/en-US).
const parse = (raw: string): bigint =>
  (
    new BankImportService({} as never, {} as never) as unknown as {
      parseAmountCents(raw: string): bigint;
    }
  ).parseAmountCents(raw);

describe('BankImportService.parseAmountCents', () => {
  it('trata ponto como decimal (en-US / Nubank)', () => {
    expect(parse('-53.90')).toBe(-5390n);
    expect(parse('1234.56')).toBe(123456n);
    expect(parse('1,234.56')).toBe(123456n); // vírgula = milhar
  });

  it('trata vírgula como decimal (pt-BR)', () => {
    expect(parse('1.234,56')).toBe(123456n); // ponto = milhar
    expect(parse('-53,90')).toBe(-5390n);
    expect(parse('R$ 1.000,00')).toBe(100000n);
  });

  it('separador único + 3 dígitos = milhar, não decimal (moeda tem 2 casas)', () => {
    expect(parse('1.234')).toBe(123400n); // R$1234, não R$1,23
    expect(parse('1,234')).toBe(123400n);
    expect(parse('12.345')).toBe(1234500n);
  });
});
