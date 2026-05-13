import { describe, expect, it } from 'vitest';

import {
  applyFixedDelta,
  applyPercentDelta,
  calculateMargin,
  priceToHitMargin,
} from './margin.calculator.js';

describe('calculateMargin', () => {
  it('computes a known scenario: iFood com 23% comissão + 2.99% processamento', () => {
    const result = calculateMargin({
      sellingPriceCents: 3990, // R$ 39,90
      costCents: 1200, // R$ 12,00 CMV
      commissionPct: 23,
      paymentProcessingPct: 2.99,
      flatFeeCents: 0,
    });

    // comissão = 3990 * 0.23 = 917.7 → 918
    expect(result.commissionCents).toBe(918);
    // processamento = 3990 * 0.0299 = 119.301 → 119
    expect(result.paymentProcessingCents).toBe(119);
    expect(result.totalFeesCents).toBe(918 + 119);
    expect(result.netRevenueCents).toBe(3990 - (918 + 119)); // 2953
    expect(result.marginCents).toBe(2953 - 1200); // 1753
    // margin % sobre gross = 1753/3990 ≈ 43.9348% → 43.9348
    expect(result.marginPct).toBeCloseTo(43.9348, 3);
  });

  it('returns negative margin when cost > net revenue', () => {
    const result = calculateMargin({
      sellingPriceCents: 1000,
      costCents: 1500,
      commissionPct: 20,
      paymentProcessingPct: 3,
      flatFeeCents: 50,
    });
    expect(result.marginCents).toBeLessThan(0);
    expect(result.marginPct).toBeLessThan(0);
  });

  it('handles zero fees gracefully', () => {
    const result = calculateMargin({
      sellingPriceCents: 2000,
      costCents: 800,
      commissionPct: 0,
      paymentProcessingPct: 0,
      flatFeeCents: 0,
    });
    expect(result.totalFeesCents).toBe(0);
    expect(result.netRevenueCents).toBe(2000);
    expect(result.marginCents).toBe(1200);
    expect(result.marginPct).toBe(60); // 1200/2000 = 60%
  });

  it('respects flat fee', () => {
    const result = calculateMargin({
      sellingPriceCents: 5000,
      costCents: 1500,
      commissionPct: 0,
      paymentProcessingPct: 0,
      flatFeeCents: 100,
    });
    expect(result.totalFeesCents).toBe(100);
    expect(result.netRevenueCents).toBe(4900);
    expect(result.marginCents).toBe(3400);
  });

  it('produces 0 pct values when selling price is zero (no division by zero)', () => {
    const result = calculateMargin({
      sellingPriceCents: 0,
      costCents: 500,
      commissionPct: 20,
      paymentProcessingPct: 3,
      flatFeeCents: 0,
    });
    expect(result.marginPct).toBe(0);
    expect(result.marginPctNet).toBe(0);
  });
});

describe('applyPercentDelta', () => {
  it('rounds half away from zero', () => {
    expect(applyPercentDelta(4000, 5)).toBe(4200);
    expect(applyPercentDelta(3333, 5)).toBe(3500); // 3499.65 → 3500
  });

  it('clamps to non-negative', () => {
    expect(applyPercentDelta(1000, -200)).toBe(0);
  });
});

describe('applyFixedDelta', () => {
  it('adds the cents delta', () => {
    expect(applyFixedDelta(4000, 200)).toBe(4200);
    expect(applyFixedDelta(4000, -500)).toBe(3500);
  });

  it('clamps to zero', () => {
    expect(applyFixedDelta(100, -500)).toBe(0);
  });
});

describe('priceToHitMargin', () => {
  it('computes the inverse: known margin breakdown round-trip', () => {
    const cost = 1200;
    const fees = { commissionPct: 23, paymentProcessingPct: 2.99, flatFeeCents: 0 };

    const price = priceToHitMargin(35, cost, fees);
    expect(price).not.toBeNull();

    const back = calculateMargin({ sellingPriceCents: price!, costCents: cost, ...fees });
    // tolerância pequena por causa do arredondamento de centavos
    expect(back.marginPct).toBeGreaterThanOrEqual(34.9);
    expect(back.marginPct).toBeLessThanOrEqual(35.1);
  });

  it('returns null when target margin + total fees exceed 100%', () => {
    expect(
      priceToHitMargin(80, 1000, {
        commissionPct: 25,
        paymentProcessingPct: 5, // 30 + 80 = 110 → impossible
        flatFeeCents: 0,
      }),
    ).toBeNull();
  });

  it('produces higher prices on platforms with higher fees (same target margin)', () => {
    const cost = 1000;
    const lowFees = priceToHitMargin(30, cost, {
      commissionPct: 12,
      paymentProcessingPct: 2,
      flatFeeCents: 0,
    });
    const highFees = priceToHitMargin(30, cost, {
      commissionPct: 23,
      paymentProcessingPct: 3,
      flatFeeCents: 0,
    });
    expect(highFees).not.toBeNull();
    expect(lowFees).not.toBeNull();
    // Plataforma com taxa maior precisa de preço bruto maior pra manter a mesma margem.
    expect(highFees!).toBeGreaterThan(lowFees!);
  });
});
