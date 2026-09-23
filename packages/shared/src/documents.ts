/** Local checksum validation. Does not query registration status. Supports numeric and alphanumeric CNPJ. */
export function isValidSupplierDocument(value: string): boolean {
  const valueNormalized = value
    .trim()
    .toUpperCase()
    .replace(/[-./\s]/g, '');
  if (!valueNormalized) return true;
  if (/^(.)\1+$/.test(valueNormalized)) return false;
  if (/^[A-Z0-9]{12}\d{2}$/.test(valueNormalized)) {
    const digit = (base: string) => {
      const sum = [...base]
        .reverse()
        .reduce((total, c, i) => total + (c.charCodeAt(0) - 48) * ((i % 8) + 2), 0);
      return sum % 11 < 2 ? 0 : 11 - (sum % 11);
    };
    const base = valueNormalized.slice(0, 12);
    return valueNormalized === `${base}${digit(base)}${digit(base + digit(base))}`;
  }
  if (/^\d{11}$/.test(valueNormalized)) {
    const digit = (base: string) => {
      const sum = [...base].reduce((total, c, i) => total + Number(c) * (base.length + 1 - i), 0);
      return sum % 11 < 2 ? 0 : 11 - (sum % 11);
    };
    const base = valueNormalized.slice(0, 9);
    return valueNormalized === `${base}${digit(base)}${digit(base + digit(base))}`;
  }
  return false;
}
