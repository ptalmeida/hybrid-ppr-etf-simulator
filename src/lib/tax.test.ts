import { describe, it, expect } from 'vitest';
import {
  etfRateForAge,
  pprTaxOnProfit,
  irsCapForAge,
  contributionForYear,
  penalisedPprRateForAge,
  clawbackIfRedeemedNow,
  PPR_LEGAL_EFFECTIVE_RATE,
} from './tax';

describe('etfRateForAge', () => {
  it('applies 28% under 2 years in ladder mode', () => {
    expect(etfRateForAge(0, 'ladder', 35)).toBeCloseTo(0.28, 10);
    expect(etfRateForAge(1, 'ladder', 35)).toBeCloseTo(0.28, 10);
  });

  it('applies 25.2% from 2 to under 5 years', () => {
    expect(etfRateForAge(2, 'ladder', 35)).toBeCloseTo(0.252, 10);
    expect(etfRateForAge(4, 'ladder', 35)).toBeCloseTo(0.252, 10);
  });

  it('applies 22.4% from 5 to under 8 years', () => {
    expect(etfRateForAge(5, 'ladder', 35)).toBeCloseTo(0.224, 10);
    expect(etfRateForAge(7, 'ladder', 35)).toBeCloseTo(0.224, 10);
  });

  it('applies 19.6% from 8 years onward', () => {
    expect(etfRateForAge(8, 'ladder', 35)).toBeCloseTo(0.196, 10);
    expect(etfRateForAge(30, 'ladder', 35)).toBeCloseTo(0.196, 10);
  });

  it('applies a flat 28% at every age in flat28 mode', () => {
    expect(etfRateForAge(0, 'flat28', 35)).toBeCloseTo(0.28, 10);
    expect(etfRateForAge(20, 'flat28', 35)).toBeCloseTo(0.28, 10);
  });

  it('applies the exclusion coefficients to the marginal rate in englobamento mode', () => {
    // 35% marginal, 30% of the gain excluded from 8 years => 0.35 * 0.7
    expect(etfRateForAge(8, 'englobamento', 35)).toBeCloseTo(0.245, 10);
    // below 2 years there is no exclusion, so the full marginal rate applies
    expect(etfRateForAge(1, 'englobamento', 35)).toBeCloseTo(0.35, 10);
  });

  it('makes englobamento worse than the ladder above a 28% marginal rate', () => {
    expect(etfRateForAge(8, 'englobamento', 45)).toBeGreaterThan(
      etfRateForAge(8, 'ladder', 45),
    );
  });
});

describe('pprTaxOnProfit', () => {
  it('taxes two fifths of the profit at 20%, an effective 8%', () => {
    expect(PPR_LEGAL_EFFECTIVE_RATE).toBeCloseTo(0.08, 10);
    expect(pprTaxOnProfit(1000)).toBeCloseTo(80, 10);
  });

  it('taxes nothing on zero or negative profit', () => {
    expect(pprTaxOnProfit(0)).toBe(0);
    expect(pprTaxOnProfit(-500)).toBe(0);
  });
});

describe('irsCapForAge', () => {
  it('returns 400 under 35', () => {
    expect(irsCapForAge(34, true, 999)).toBe(400);
  });

  it('returns 350 from 35 up to and including 50', () => {
    expect(irsCapForAge(35, true, 999)).toBe(350);
    expect(irsCapForAge(50, true, 999)).toBe(350);
  });

  it('returns 300 above 50', () => {
    expect(irsCapForAge(51, true, 999)).toBe(300);
  });

  it('returns the manual cap when bands are disabled', () => {
    expect(irsCapForAge(30, false, 250)).toBe(250);
  });
});

describe('contributionForYear', () => {
  it('returns the fixed amount in fixed mode regardless of age', () => {
    expect(contributionForYear('fixed', 30, 2000, true, 400)).toBe(2000);
    expect(contributionForYear('fixed', 60, 2000, true, 400)).toBe(2000);
  });

  it('returns cap/0.2 in maxDeductible mode', () => {
    expect(contributionForYear('maxDeductible', 30, 0, true, 400)).toBe(2000);
    expect(contributionForYear('maxDeductible', 40, 0, true, 400)).toBe(1750);
    expect(contributionForYear('maxDeductible', 55, 0, true, 400)).toBe(1500);
  });
});

describe('penalisedPprRateForAge', () => {
  it('applies 21.5% under 5 years', () => {
    expect(penalisedPprRateForAge(4)).toBeCloseTo(0.215, 10);
  });

  it('applies 17.2% from 5 to under 8 years', () => {
    expect(penalisedPprRateForAge(5)).toBeCloseTo(0.172, 10);
    expect(penalisedPprRateForAge(7)).toBeCloseTo(0.172, 10);
  });

  it('applies 8.6% from 8 years onward', () => {
    expect(penalisedPprRateForAge(8)).toBeCloseTo(0.086, 10);
  });
});

describe('clawbackIfRedeemedNow', () => {
  it('returns zero when the tranche is at least five years old', () => {
    expect(clawbackIfRedeemedNow(400, 5)).toBe(0);
  });

  it('adds 10% per elapsed year to the benefit when younger than five', () => {
    // 400 deducted, redeemed after 3 years => 400 * (1 + 0.10 * 3)
    expect(clawbackIfRedeemedNow(400, 3)).toBeCloseTo(520, 10);
  });
});
