/**
 * Cálculos puros de margem líquida por plataforma — sem efeitos colaterais,
 * sem dependência de Nest/Prisma. Toda a aritmética é em centavos (inteiros)
 * para evitar acumulação de erros de ponto flutuante.
 *
 * Fórmula:
 *   gross           = selling_price_cents
 *   commission      = round(gross * commission_pct / 100)
 *   processing      = round(gross * payment_processing_pct / 100)
 *   total_fees      = commission + processing + flat_fee_cents
 *   net_revenue     = gross - total_fees
 *   margin_cents    = net_revenue - cost_cents
 *   margin_pct      = margin_cents / gross   (sobre o preço de venda)
 *   margin_pct_net  = margin_cents / net_revenue   (sobre o líquido — fica
 *                                                   maior, usado raramente)
 */

export interface FeeInputs {
  commissionPct: number;
  paymentProcessingPct: number;
  flatFeeCents: number;
}

export interface MarginInputs extends FeeInputs {
  sellingPriceCents: number;
  costCents: number;
}

export interface MarginBreakdown {
  sellingPriceCents: number;
  costCents: number;
  commissionCents: number;
  paymentProcessingCents: number;
  flatFeeCents: number;
  totalFeesCents: number;
  netRevenueCents: number;
  marginCents: number;
  marginPct: number; // sobre gross — 4 casas decimais
  marginPctNet: number; // sobre net — 4 casas decimais
}

const round = (n: number): number => Math.round(n);

const pctOver = (numerator: number, denominator: number): number =>
  // Divide pela magnitude do denominador para que o sinal do resultado siga o
  // numerador. Sem isso, net_revenue negativo (taxas > preço) inverteria o sinal
  // e um item deficitário apareceria com margem líquida positiva.
  denominator === 0 ? 0 : Math.round((numerator / Math.abs(denominator)) * 1_000_000) / 10_000;

export function calculateMargin(inputs: MarginInputs): MarginBreakdown {
  const { sellingPriceCents, costCents, commissionPct, paymentProcessingPct, flatFeeCents } =
    inputs;

  const commissionCents = round((sellingPriceCents * commissionPct) / 100);
  const paymentProcessingCents = round((sellingPriceCents * paymentProcessingPct) / 100);
  const totalFeesCents = commissionCents + paymentProcessingCents + flatFeeCents;
  const netRevenueCents = sellingPriceCents - totalFeesCents;
  const marginCents = netRevenueCents - costCents;

  return {
    sellingPriceCents,
    costCents,
    commissionCents,
    paymentProcessingCents,
    flatFeeCents,
    totalFeesCents,
    netRevenueCents,
    marginCents,
    marginPct: pctOver(marginCents, sellingPriceCents),
    marginPctNet: pctOver(marginCents, netRevenueCents),
  };
}

/**
 * Aplica delta percentual sobre o preço atual.
 * Ex.: priceCents=4000, deltaPct=5 → 4200
 */
export function applyPercentDelta(currentPriceCents: number, deltaPct: number): number {
  const next = currentPriceCents * (1 + deltaPct / 100);
  return Math.max(0, round(next));
}

/**
 * Aplica delta em centavos sobre o preço atual.
 * Ex.: priceCents=4000, deltaCents=200 → 4200
 */
export function applyFixedDelta(currentPriceCents: number, deltaCents: number): number {
  return Math.max(0, currentPriceCents + deltaCents);
}

/**
 * Calcula o preço bruto necessário para alcançar uma margem líquida-alvo,
 * dado o custo e a estrutura de taxas da plataforma.
 *
 * Resolve algébricamente:
 *   margin_pct = (gross - fees - cost) / gross
 *   margin_pct = 1 - (commission+processing)/100 - flat/gross - cost/gross
 *   gross * (1 - margin_pct - (commission+processing)/100) = cost + flat
 *   gross = (cost + flat) / (1 - margin_pct - (commission+processing)/100)
 *
 * Retorna `null` quando o alvo é matematicamente impossível
 * (margem-alvo + percentual de taxas ≥ 100%).
 */
export function priceToHitMargin(
  targetMarginPct: number,
  costCents: number,
  fees: FeeInputs,
): number | null {
  const totalPctFees = (fees.commissionPct + fees.paymentProcessingPct) / 100;
  const denominator = 1 - targetMarginPct / 100 - totalPctFees;
  if (denominator <= 0) return null;
  const price = (costCents + fees.flatFeeCents) / denominator;
  // Custo + taxa fixa zerados → preço 0. Não repreça o item para R$0,00 (dá o
  // produto de graça); trata como impossível para simulate/apply pularem.
  const rounded = round(price);
  return rounded > 0 ? rounded : null;
}
