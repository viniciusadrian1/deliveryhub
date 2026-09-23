/** BRL form input: comma decimals, optional grouped thousands, or plain dot decimals. */
export function parseMoneyCents(value: string): number | null {
  const text = value.trim();
  const valid =
    /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text) || /^\d+\.\d{1,2}$/.test(text);
  if (!valid) return null;
  const normalized =
    text.includes(',') || /^\d{1,3}(?:\.\d{3})+$/.test(text)
      ? text.replace(/\./g, '').replace(',', '.')
      : text;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
export function moneyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function parseMoneyInputToCents(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Math.round(value);
  const text = String(value).trim();
  if (!text) return 0;
  
  const parsed = parseMoneyCents(text);
  if (parsed !== null) return parsed;

  if (text.includes(',')) {
    const num = parseFloat(text.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 100);
  }
  const num = parseFloat(text);
  return isNaN(num) ? 0 : Math.round(num * 100);
}
