/**
 * Conversões entre unidades-base e unidades display.
 *
 * O custo de cada Ingredient é armazenado na **unidade-base** que foi
 * cadastrada (gram, kilogram, milliliter, liter, unit). Mas no momento de
 * usar em uma receita, o usuário pode preferir digitar em outra escala
 * (ex.: bacon cadastrado em kg, mas a receita usa 50 g).
 *
 * Este módulo cobre:
 *   - Quais unidades são compatíveis entre si (`COMPATIBLE_UNITS`)
 *   - Conversão entre escalas (`convertToBase`, `convertFromBase`)
 *   - Lista de unidades válidas pra mostrar no select dada a unidade-base
 *     do ingrediente (`getCompatibleUnits`)
 */

import type { IngredientUnit } from './inventory-types';

/** Fatores em relação à unidade-base. Ex.: 1 kg = 1000 g. */
const BASE_FACTORS: Record<IngredientUnit, number> = {
  gram: 1,
  kilogram: 1000,
  milliliter: 1,
  liter: 1000,
  unit: 1,
};

/** Família de cada unidade (só convertemos entre membros da mesma família). */
const FAMILY: Record<IngredientUnit, 'mass' | 'volume' | 'count'> = {
  gram: 'mass',
  kilogram: 'mass',
  milliliter: 'volume',
  liter: 'volume',
  unit: 'count',
};

/**
 * Devolve as unidades compatíveis com `base` (mesma família).
 * Inclui sempre a própria base.
 */
export function getCompatibleUnits(base: IngredientUnit): IngredientUnit[] {
  const family = FAMILY[base];
  return (Object.keys(FAMILY) as IngredientUnit[]).filter(
    (u) => FAMILY[u] === family,
  );
}

/**
 * Converte um valor digitado em `from` para a unidade-base `to`.
 * Lança se as unidades estão em famílias diferentes.
 */
export function convertToBase(
  value: number,
  from: IngredientUnit,
  to: IngredientUnit,
): number {
  if (FAMILY[from] !== FAMILY[to]) {
    throw new Error(`incompatible_units:${from}_to_${to}`);
  }
  return (value * BASE_FACTORS[from]) / BASE_FACTORS[to];
}

/** Inverso de `convertToBase` (pra exibir o valor armazenado na unidade display). */
export function convertFromBase(
  baseValue: number,
  base: IngredientUnit,
  display: IngredientUnit,
): number {
  if (FAMILY[base] !== FAMILY[display]) {
    throw new Error(`incompatible_units:${base}_to_${display}`);
  }
  return (baseValue * BASE_FACTORS[base]) / BASE_FACTORS[display];
}

/** Versão segura: devolve `null` em vez de lançar. */
export function tryConvertToBase(
  value: number,
  from: IngredientUnit,
  to: IngredientUnit,
): number | null {
  if (FAMILY[from] !== FAMILY[to]) return null;
  return convertToBase(value, from, to);
}
