import { describe, it, expect } from 'vitest';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';
import type { ScenarioId, SimConfig, SimOutput } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

const byId = (out: SimOutput, id: ScenarioId) =>
  out.scenarios.find((s) => s.id === id)!;

describe('simulate — structure', () => {
  it('returns the three scenarios in a stable order', () => {
    expect(simulate(cfg()).scenarios.map((s) => s.id)).toEqual([
      'etf',
      'hybrid',
      'ppr',
    ]);
  });

  it('produces one row per simulated year', () => {
    const out = simulate(cfg({ years: 10 }));
    for (const s of out.scenarios) {
      expect(s.rows).toHaveLength(10);
      expect(s.rows[0].year).toBe(1);
      expect(s.rows[9].year).toBe(10);
    }
  });

  it('ages the participant by one year per row', () => {
    const out = simulate(cfg({ years: 3, currentAge: 30 }));
    expect(byId(out, 'etf').rows.map((r) => r.age)).toEqual([30, 31, 32]);
  });

  it('labels scenarios using the configured product names', () => {
    const out = simulate(cfg({ etfName: 'VWCE', pprName: 'Golden SGF' }));
    expect(byId(out, 'etf').label).toContain('VWCE');
    expect(byId(out, 'ppr').label).toContain('Golden SGF');
  });

  it('does not throw on a zero-year or zero-contribution configuration', () => {
    expect(() => simulate(cfg({ years: 0 }))).not.toThrow();
    expect(() => simulate(cfg({ annualInvestment: 0 }))).not.toThrow();
  });
});

describe('simulate — contributions', () => {
  it('charges every scenario the same amount out of pocket', () => {
    const totals = simulate(cfg({ years: 20 })).scenarios.map(
      (s) => s.final.totalContributed,
    );
    expect(totals[0]).toBeCloseTo(totals[1], 6);
    expect(totals[1]).toBeCloseTo(totals[2], 6);
  });

  it('grows the first contribution immediately under start-of-year timing', () => {
    const out = simulate(
      cfg({
        years: 1,
        annualInvestment: 1000,
        etfReturn: 10,
        etfFee: 0,
        contributionTiming: 'start',
        mortgageStartYear: 99,
      }),
    );
    expect(byId(out, 'etf').rows[0].etfBalance).toBeCloseTo(1100, 6);
  });

  it('steps the contribution down at ages 35 and 51 in maxDeductible mode', () => {
    const rows = byId(
      simulate(
        cfg({ contributionMode: 'maxDeductible', currentAge: 33, years: 20 }),
      ),
      'ppr',
    ).rows;
    expect(rows[0].contributedThisYear).toBe(2000); // age 33
    expect(rows[2].contributedThisYear).toBe(1750); // age 35
    expect(rows[18].contributedThisYear).toBe(1500); // age 51
  });
});

describe('simulate — the reference case from the community thread', () => {
  // r/literaciafinanceira, "Golden SGF PPR ETF vs investimento direto em ETF".
  // Age 30, 30 years, 6% net ETF, PPR 6% less a 0.75% management fee,
  // contributions of the max deductible by age band, no mortgage.
  //
  // Their published figures were:
  //   ETF gross 149 571.35   ETF net 130 300.36
  //   PPR gross 129 660.60   PPR net 123 387.75
  //   contributed 51 250     benefits 10 250
  //
  // We deliberately diverge from them in two places, both documented below.
  const reference = cfg({
    currentAge: 30,
    years: 30,
    contributionMode: 'maxDeductible',
    contributionTiming: 'start',
    etfReturn: 6,
    etfFee: 0,
    pprReturn: 6,
    pprFee: 0.75,
    pprTrackingError: 0,
    etfAnnualCost: 0,
    mortgageStartYear: 999,
    benefitDestination: 'consumed',
    reinvestRedemption: false,
    etfTaxMode: 'ladder',
  });

  // DIVERGENCE 1 — the age-50 band.
  // They place age 50 in the "over 50" band (1500 contribution, 300 cap),
  // giving 5x2000 + 15x1750 + 10x1500 = 51 250. But art. 21.o/2 c) EBF
  // applies the 300 cap to "idade SUPERIOR a 50 anos", so age exactly 50
  // stays in the 350 band. Our schedule is 5x2000 + 16x1750 + 9x1500.
  it('contributes the max deductible with age 50 in the 350 band', () => {
    expect(simulate(reference).scenarios[0].final.totalContributed).toBeCloseTo(
      51500,
      6,
    );
  });

  it('accrues IRS benefits matching that band placement', () => {
    // 5 x 400 + 16 x 350 + 9 x 300
    expect(byId(simulate(reference), 'ppr').final.irsBenefitTotal).toBeCloseTo(
      10300,
      6,
    );
  });

  // Gross values agree with an independent calculation of the same schedule,
  // confirming the compounding and the start-of-year timing convention.
  it('produces gross portfolio values consistent with their compounding', () => {
    const out = simulate(reference);
    expect(byId(out, 'etf').final.grossValue).toBeCloseTo(150019.06, 1);
    expect(byId(out, 'ppr').final.grossValue).toBeCloseTo(130077.62, 1);
  });

  it('taxes the PPR at a flat 8% of the gain on liquidation', () => {
    const ppr = byId(simulate(reference), 'ppr').final;
    const gain = ppr.grossValue - ppr.totalContributed;
    expect(ppr.pprTax).toBeCloseTo(gain * 0.08, 6);
    expect(ppr.netValue).toBeCloseTo(ppr.grossValue - gain * 0.08, 6);
  });

  // DIVERGENCE 2 — FIFO.
  // They applied 19.6% to the entire ETF gain. Under FIFO the final seven
  // years of tranches are younger than 8 years and are taxed at 22.4%,
  // 25.2% and 28%, so our net must be lower than a flat 19.6% would give.
  it('taxes the ETF above a flat 19.6% because younger tranches exist', () => {
    const etf = byId(simulate(reference), 'etf').final;
    const gain = etf.grossValue - etf.totalContributed;
    expect(etf.etfTax).toBeGreaterThan(gain * 0.196);
    expect(etf.netValue).toBeLessThan(etf.grossValue - gain * 0.196);
  });

  it('still puts most of the ETF gain in the cheapest bracket', () => {
    const slices = byId(simulate(reference), 'etf').final.bracketBreakdown;
    const total = slices.reduce((s, b) => s + b.gain, 0);
    const oldest = slices.find((b) => b.bracket === '8 anos ou mais')!;
    expect(oldest.ratePct).toBeCloseTo(19.6, 6);
    expect(oldest.gain / total).toBeGreaterThan(0.8);
  });
});

describe('simulate — contribution timing', () => {
  const base = {
    currentAge: 30,
    years: 30,
    contributionMode: 'maxDeductible' as const,
    etfReturn: 6,
    etfFee: 0,
    pprFee: 0,
    pprReturn: 6,
    mortgageStartYear: 999,
    benefitDestination: 'consumed' as const,
  };

  it('gives start-of-year contributions exactly one extra year of growth', () => {
    const start = byId(
      simulate(cfg({ ...base, contributionTiming: 'start' })),
      'etf',
    ).final.grossValue;
    const end = byId(
      simulate(cfg({ ...base, contributionTiming: 'end' })),
      'etf',
    ).final.grossValue;
    expect(start).toBeCloseTo(end * 1.06, 6);
  });

  it('leaves the first year empty under end-of-year timing', () => {
    const out = simulate(
      cfg({ years: 1, annualInvestment: 1000, contributionTiming: 'end' }),
    );
    // deposited after growth, so it is worth exactly what went in
    expect(byId(out, 'etf').rows[0].etfBalance).toBeCloseTo(1000, 6);
  });
});

describe('simulate — mortgage redemptions', () => {
  it('redeems nothing before the mortgage starts', () => {
    const rows = byId(
      simulate(cfg({ years: 12, mortgageStartYear: 10 })),
      'hybrid',
    ).rows;
    expect(rows[8].redeemedThisYear).toBe(0);
    expect(rows[9].redeemedThisYear).toBeGreaterThan(0);
  });

  it('caps annual redemption at twelve monthly instalments', () => {
    const out = simulate(
      cfg({ years: 20, mortgageStartYear: 6, monthlyInstalment: 100 }),
    );
    for (const row of byId(out, 'hybrid').rows) {
      expect(row.redeemedThisYear).toBeLessThanOrEqual(1200 + 1e-6);
    }
  });

  it('never lets the PPR balance go negative', () => {
    const out = simulate(
      cfg({ years: 30, mortgageStartYear: 6, monthlyInstalment: 5000 }),
    );
    for (const row of byId(out, 'hybrid').rows) {
      expect(row.pprBalance).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('accumulates mortgage paid across years', () => {
    const rows = byId(
      simulate(cfg({ years: 20, mortgageStartYear: 6 })),
      'hybrid',
    ).rows;
    expect(rows[19].mortgagePaid).toBeGreaterThan(rows[10].mortgagePaid);
  });
});

describe('simulate — benefit destination', () => {
  it('beats the consumed case when the benefit is reinvested', () => {
    const base = { years: 30, mortgageStartYear: 5 } as const;
    const consumed = byId(
      simulate(cfg({ ...base, benefitDestination: 'consumed' })),
      'hybrid',
    ).final.netValue;
    const intoEtf = byId(
      simulate(cfg({ ...base, benefitDestination: 'etf' })),
      'hybrid',
    ).final.netValue;
    expect(intoEtf).toBeGreaterThan(consumed);
  });

  it('routes the benefit into the PPR when asked', () => {
    const base = { years: 30, mortgageStartYear: 999 } as const;
    const intoPpr = byId(
      simulate(cfg({ ...base, benefitDestination: 'ppr' })),
      'hybrid',
    );
    const consumed = byId(
      simulate(cfg({ ...base, benefitDestination: 'consumed' })),
      'hybrid',
    );
    expect(intoPpr.rows.at(-1)!.pprBalance).toBeGreaterThan(
      consumed.rows.at(-1)!.pprBalance,
    );
    expect(intoPpr.rows.at(-1)!.etfBalance).toBe(0);
  });

  it('counts consumed benefits in netWithBenefits but not in netValue', () => {
    const s = byId(
      simulate(cfg({ years: 20, benefitDestination: 'consumed' })),
      'hybrid',
    );
    expect(s.final.netWithBenefits).toBeCloseTo(
      s.final.netValue + s.final.mortgagePaidTotal + s.final.irsBenefitTotal,
      6,
    );
  });

  it('loses to the pure ETF scenario when nothing is reinvested', () => {
    const out = simulate(
      cfg({
        years: 33,
        benefitDestination: 'consumed',
        reinvestRedemption: false,
      }),
    );
    expect(byId(out, 'hybrid').final.netValue).toBeLessThan(
      byId(out, 'etf').final.netValue,
    );
  });
});

describe('simulate — fees and drag', () => {
  it('reduces the PPR balance when a tracking error is applied', () => {
    const without = byId(simulate(cfg({ pprTrackingError: 0 })), 'ppr').final
      .netValue;
    const with26 = byId(simulate(cfg({ pprTrackingError: 2.6 })), 'ppr').final
      .netValue;
    expect(with26).toBeLessThan(without);
  });

  it('reduces the ETF balance when an annual broker cost is applied', () => {
    const without = byId(simulate(cfg({ etfAnnualCost: 0 })), 'etf').final
      .netValue;
    const withCost = byId(simulate(cfg({ etfAnnualCost: 50 })), 'etf').final
      .netValue;
    expect(withCost).toBeLessThan(without);
  });
});

describe('simulate — invariants', () => {
  it('conserves value: nothing appears from nowhere', () => {
    const out = simulate(cfg({ years: 25, mortgageStartYear: 6 }));
    for (const s of out.scenarios) {
      const f = s.final;
      const totalTax = f.etfTax + f.pprTax + f.pprTaxDuringRedemptions;
      const accountedFor = f.grossValue + f.mortgagePaidTotal + totalTax;
      expect(accountedFor).toBeGreaterThanOrEqual(f.totalContributed - 1e-6);
    }
  });

  it('reports an effective tax rate between 0 and 1', () => {
    for (const s of simulate(cfg({ years: 25 })).scenarios) {
      expect(s.final.effectiveTaxRate).toBeGreaterThanOrEqual(0);
      expect(s.final.effectiveTaxRate).toBeLessThanOrEqual(1);
    }
  });

  it('reports a bracket breakdown whose tax sums to the ETF tax', () => {
    const s = byId(simulate(cfg({ years: 25 })), 'etf');
    const sum = s.final.bracketBreakdown.reduce((acc, b) => acc + b.tax, 0);
    expect(sum).toBeCloseTo(s.final.etfTax, 6);
  });

  it('finds a break-even year when the hybrid eventually wins', () => {
    const out = simulate(
      cfg({ years: 40, pprReturn: 7.97, pprFee: 0, mortgageStartYear: 6 }),
    );
    expect(out.breakEvenYear).not.toBeNull();
  });

  it('reports a null break-even year when the hybrid never wins', () => {
    const out = simulate(
      cfg({
        years: 33,
        benefitDestination: 'consumed',
        reinvestRedemption: false,
      }),
    );
    expect(out.breakEvenYear).toBeNull();
  });
});
