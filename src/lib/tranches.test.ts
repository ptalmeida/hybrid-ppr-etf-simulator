import { describe, it, expect } from 'vitest';
import {
  growTranches,
  chargeFixedCost,
  redeemPprFifo,
  liquidate,
} from './tranches';
import type { Tranche } from './types';

const ppr = (
  yearDeposited: number,
  principal: number,
  value: number,
): Tranche => ({ yearDeposited, principal, value, product: 'ppr' });

const etf = (
  yearDeposited: number,
  principal: number,
  value: number,
): Tranche => ({ yearDeposited, principal, value, product: 'etf' });

describe('growTranches', () => {
  it('grows only tranches of the named product', () => {
    const out = growTranches([etf(1, 100, 100), ppr(1, 100, 100)], 'etf', 10);
    expect(out[0].value).toBeCloseTo(110, 10);
    expect(out[1].value).toBeCloseTo(100, 10);
  });

  it('leaves principal untouched', () => {
    const out = growTranches([etf(1, 100, 100)], 'etf', 10);
    expect(out[0].principal).toBe(100);
  });

  it('handles a negative net rate', () => {
    const out = growTranches([etf(1, 100, 100)], 'etf', -10);
    expect(out[0].value).toBeCloseTo(90, 10);
  });
});

describe('chargeFixedCost', () => {
  it('spreads the cost pro-rata across the product balance', () => {
    const out = chargeFixedCost([etf(1, 100, 300), etf(2, 100, 100)], 'etf', 40);
    // 300/400 of 40 = 30, and 100/400 of 40 = 10
    expect(out[0].value).toBeCloseTo(270, 10);
    expect(out[1].value).toBeCloseTo(90, 10);
  });

  it('is a no-op when the cost is zero', () => {
    const out = chargeFixedCost([etf(1, 100, 300)], 'etf', 0);
    expect(out[0].value).toBeCloseTo(300, 10);
  });

  it('never drives a balance below zero', () => {
    const out = chargeFixedCost([etf(1, 100, 50)], 'etf', 500);
    expect(out[0].value).toBe(0);
  });
});

describe('redeemPprFifo', () => {
  it('redeems the oldest eligible tranche first', () => {
    const tranches = [ppr(1, 1000, 2000), ppr(2, 1000, 1500)];
    const r = redeemPprFifo(tranches, 10, 2000, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(2000, 10);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].yearDeposited).toBe(2);
  });

  it('taxes 8% of the profit portion only', () => {
    const r = redeemPprFifo([ppr(1, 1000, 2000)], 10, 5000, {
      use35Rule: false,
    });
    // profit 1000 => tax 80 => net 1920
    expect(r.tax).toBeCloseTo(80, 10);
    expect(r.netProceeds).toBeCloseTo(1920, 10);
  });

  it('partially redeems a tranche and leaves the remainder invested', () => {
    const r = redeemPprFifo([ppr(1, 1000, 2000)], 10, 500, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(500, 10);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].value).toBeCloseTo(1500, 10);
    // principal is reduced proportionally: 500/2000 of 1000
    expect(r.remaining[0].principal).toBeCloseTo(750, 10);
    // profit share of the redeemed 500 is 250, taxed at 8% => 20
    expect(r.tax).toBeCloseTo(20, 10);
  });

  it('excludes tranches younger than five years under the per-entrega rule', () => {
    // current year 5, tranche from year 2 is 3 years old
    const r = redeemPprFifo([ppr(2, 1000, 1000)], 5, 5000, { use35Rule: false });
    expect(r.grossRedeemed).toBe(0);
    expect(r.remaining).toHaveLength(1);
  });

  it('includes a tranche exactly five years old', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1000)], 6, 5000, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(1000, 10);
  });

  it('redeems every tranche under the 35% rule once five years have passed', () => {
    // year 6, first entrega in year 1 => 5 years elapsed. A year-5 tranche is
    // only 1 year old but is still eligible under art. 4.º/3.
    const r = redeemPprFifo([ppr(1, 1000, 1000), ppr(5, 1000, 1000)], 6, 5000, {
      use35Rule: true,
    });
    expect(r.grossRedeemed).toBeCloseTo(2000, 10);
    expect(r.remaining).toHaveLength(0);
  });

  it('falls back to per-entrega when the first-half share is below 35%', () => {
    const r = redeemPprFifo([ppr(9, 1000, 1000)], 10, 5000, {
      use35Rule: true,
      firstHalfShare: 0,
    });
    expect(r.grossRedeemed).toBe(0);
  });

  it('never redeems more than the balance', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1200)], 10, 999999, {
      use35Rule: false,
    });
    expect(r.grossRedeemed).toBeCloseTo(1200, 10);
    expect(r.remaining).toHaveLength(0);
  });

  it('redeems nothing when the cap is zero', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1200)], 10, 0, { use35Rule: false });
    expect(r.grossRedeemed).toBe(0);
    expect(r.remaining).toHaveLength(1);
  });
});

describe('liquidate', () => {
  it('taxes each ETF tranche at the rate for its own age', () => {
    // final year 10: the year-1 tranche is 9 years old (19.6%),
    // the year-9 tranche is 1 year old (28%)
    const r = liquidate([etf(1, 1000, 2000), etf(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    expect(r.etfTax).toBeCloseTo(224, 10);
    expect(r.pprTax).toBe(0);
    expect(r.gross).toBeCloseTo(3100, 10);
    expect(r.net).toBeCloseTo(2876, 10);
  });

  it('taxes PPR tranches at a flat 8% regardless of age', () => {
    const r = liquidate([ppr(1, 1000, 2000), ppr(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    expect(r.pprTax).toBeCloseTo(1000 * 0.08 + 100 * 0.08, 10);
    expect(r.etfTax).toBe(0);
  });

  it('reports a bracket breakdown that sums to the ETF tax', () => {
    const r = liquidate([etf(1, 1000, 2000), etf(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    const total = r.bracketBreakdown.reduce((s, b) => s + b.tax, 0);
    expect(total).toBeCloseTo(r.etfTax, 10);
    expect(r.bracketBreakdown).toHaveLength(2);
  });

  it('taxes nothing on a tranche with no profit', () => {
    const r = liquidate([etf(1, 1000, 900)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    expect(r.etfTax).toBe(0);
    expect(r.net).toBeCloseTo(900, 10);
  });

  it('returns zeroes for an empty portfolio', () => {
    const r = liquidate([], 10, { etfTaxMode: 'ladder', marginalRate: 35 });
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
    expect(r.bracketBreakdown).toEqual([]);
  });
});
