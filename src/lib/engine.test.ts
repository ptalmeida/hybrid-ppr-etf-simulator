import { describe, it, expect } from 'vitest';
import { firstHalfShare, simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';
import type { ScenarioId, SimConfig, SimOutput } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

const byId = (out: SimOutput, id: ScenarioId) =>
  out.scenarios.find((s) => s.id === id)!;

describe('simulate — structure', () => {
  it('returns both scenarios in a stable order', () => {
    expect(simulate(cfg()).scenarios.map((s) => s.id)).toEqual([
      'etf',
      'hybrid',
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
    expect(byId(out, 'hybrid').label).toContain('Golden SGF');
    expect(byId(out, 'hybrid').label).toContain('VWCE');
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
      'hybrid',
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
    expect(byId(simulate(reference), 'hybrid').final.irsBenefitTotal).toBeCloseTo(
      10300,
      6,
    );
  });

  // Gross values agree with an independent calculation of the same schedule,
  // confirming the compounding and the start-of-year timing convention.
  it('produces gross portfolio values consistent with their compounding', () => {
    const out = simulate(reference);
    expect(byId(out, 'etf').final.grossValue).toBeCloseTo(150019.06, 1);
    expect(byId(out, 'hybrid').final.grossValue).toBeCloseTo(130077.62, 1);
  });

  it('taxes the PPR at a flat 8% of the gain on liquidation', () => {
    // with no mortgage and the benefit consumed, the hybrid is just a PPR held
    // to the end, which is what the published comparison measured
    const held = byId(simulate(reference), 'hybrid').final;
    const gain = held.grossValue - held.totalContributed;
    expect(held.pprTax).toBeCloseTo(gain * 0.08, 6);
    expect(held.netValue).toBeCloseTo(held.grossValue - gain * 0.08, 6);
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

  it('caps the mortgage credited each year at twelve instalments', () => {
    // redeemedThisYear is GROSS and legitimately exceeds the cap, because tax
    // is withheld before the money reaches the instalment. The cap binds on
    // what actually settles the mortgage.
    const rows = byId(
      simulate(cfg({ years: 20, mortgageStartYear: 6, monthlyInstalment: 100 })),
      'hybrid',
    ).rows;
    let prev = 0;
    for (const row of rows) {
      expect(row.mortgagePaid - prev).toBeLessThanOrEqual(1200 + 1e-6);
      prev = row.mortgagePaid;
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

describe('simulate — redemption is continuous, not a five-year cycle', () => {
  // Regression: firstEntregaYear used to be derived from the SURVIVING
  // tranches, so draining the plan restarted the art. 4.o/3 clock and
  // redemptions fired only once every five years — a visible sawtooth in the
  // PPR balance. The clock runs from the plan's first entrega ever.
  const cfg30 = cfg({ years: 30, mortgageStartYear: 3 });

  it('redeems in every year once the plan is five years old', () => {
    const rows = byId(simulate(cfg30), 'hybrid').rows;
    const mature = rows.filter((r) => r.year >= 8);
    for (const r of mature) {
      expect(r.redeemedThisYear).toBeGreaterThan(0);
    }
  });

  it('never leaves a five-year gap between redemptions', () => {
    const rows = byId(simulate(cfg30), 'hybrid').rows;
    const years = rows.filter((r) => r.redeemedThisYear > 0).map((r) => r.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i] - years[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('holds a steady rolling balance rather than sawtoothing', () => {
    // Entregas must be five years old to be redeemed, so the plan carries a
    // rolling ~5 years of contributions. What matters is that it does not
    // climb for four years and collapse on the fifth.
    const rows = byId(simulate(cfg30), 'hybrid').rows.filter((r) => r.year >= 8);
    for (let i = 1; i < rows.length; i++) {
      const drop = rows[i - 1].pprBalance - rows[i].pprBalance;
      // a sawtooth would dump most of the balance in a single year
      expect(drop).toBeLessThan(rows[i - 1].pprBalance * 0.5);
    }
  });

  it('never lets the plan run dry, because young entregas cannot be redeemed', () => {
    const rows = byId(simulate(cfg30), 'hybrid').rows.filter((r) => r.year >= 8);
    for (const r of rows) {
      expect(r.pprBalance).toBeGreaterThan(0);
    }
  });
});

describe('simulate — only net proceeds can pay an instalment', () => {
  it('credits the mortgage with net, and redeems more than that gross', () => {
    const h = byId(simulate(cfg({ years: 12, mortgageStartYear: 3 })), 'hybrid');
    const grossRedeemed = h.rows.reduce((s, r) => s + r.redeemedThisYear, 0);
    // gross = net credited to the mortgage + the tax withheld along the way
    expect(grossRedeemed).toBeCloseTo(
      h.final.mortgagePaidTotal + h.final.pprTaxDuringRedemptions,
      6,
    );
    expect(grossRedeemed).toBeGreaterThan(h.final.mortgagePaidTotal);
  });

  it('never credits more mortgage than twelve instalments in a year', () => {
    const rows = byId(
      simulate(cfg({ years: 20, mortgageStartYear: 3, monthlyInstalment: 200 })),
      'hybrid',
    ).rows;
    let prev = 0;
    for (const r of rows) {
      expect(r.mortgagePaid - prev).toBeLessThanOrEqual(2400 + 1e-6);
      prev = r.mortgagePaid;
    }
  });
});

describe('simulate — the redemption ledger', () => {
  const out = simulate(cfg({ years: 30, mortgageStartYear: 3 }));
  const hybrid = byId(out, 'hybrid');

  it('is empty for a scenario that never touches a PPR', () => {
    expect(byId(out, 'etf').redemptions).toEqual([]);
  });

  it('records every redemption', () => {
    const yearsWithRedemptions = hybrid.rows.filter(
      (r) => r.redeemedThisYear > 0,
    ).length;
    const yearsInLedger = new Set(hybrid.redemptions.map((e) => e.year)).size;
    expect(yearsInLedger).toBe(yearsWithRedemptions);
  });

  it('sums to the mortgage actually paid', () => {
    const net = hybrid.redemptions.reduce((s, e) => s + e.net, 0);
    expect(net).toBeCloseTo(hybrid.final.mortgagePaidTotal, 6);
  });

  it('sums to the tax actually charged on redemptions', () => {
    const tax = hybrid.redemptions.reduce((s, e) => s + e.tax, 0);
    expect(tax).toBeCloseTo(hybrid.final.pprTaxDuringRedemptions, 6);
  });

  it('matches each year row', () => {
    for (const row of hybrid.rows) {
      const gross = hybrid.redemptions
        .filter((e) => e.year === row.year)
        .reduce((s, e) => s + e.gross, 0);
      expect(gross).toBeCloseTo(row.redeemedThisYear, 6);
    }
  });

  it('balances gross into principal, profit and tax on every row', () => {
    for (const e of hybrid.redemptions) {
      expect(e.principal + e.profit).toBeCloseTo(e.gross, 6);
      expect(e.net).toBeCloseTo(e.gross - e.tax, 6);
      expect(e.tax).toBeCloseTo(e.profit * 0.08, 6);
    }
  });

  it('only ever redeems entregas at least five years old by default', () => {
    for (const e of hybrid.redemptions) {
      expect(e.ageYears).toBeGreaterThanOrEqual(5);
      expect(e.clawback).toBe(0);
    }
  });

  it('records the clawback when young entregas are redeemed', () => {
    const young = byId(
      simulate(
        cfg({ years: 30, mortgageStartYear: 3, redeemYoungEntregas: true }),
      ),
      'hybrid',
    );
    const under5 = young.redemptions.filter((e) => e.ageYears < 5);
    expect(under5.length).toBeGreaterThan(0);
    expect(under5.every((e) => e.clawback > 0)).toBe(true);
    expect(
      young.redemptions.reduce((s, e) => s + e.clawback, 0),
    ).toBeCloseTo(young.final.benefitClawback, 6);
  });

  it('is ordered oldest entrega first within each year', () => {
    for (const year of new Set(hybrid.redemptions.map((e) => e.year))) {
      const inYear = hybrid.redemptions.filter((e) => e.year === year);
      const sorted = [...inYear].sort((a, b) => a.entregaYear - b.entregaYear);
      expect(inYear.map((e) => e.entregaYear)).toEqual(
        sorted.map((e) => e.entregaYear),
      );
    }
  });
});

describe('simulate — cash flow is symmetric across scenarios', () => {
  it('costs every scenario the same out of pocket when the freed salary is reinvested', () => {
    // This is what makes the comparison fair: the ETF household pays the whole
    // mortgage from salary; the hybrid household has part of it paid by the
    // PPR and reinvests exactly that much salary instead.
    const out = simulate(
      cfg({ years: 25, mortgageStartYear: 3, reinvestRedemption: true }),
    );
    const etf = byId(out, 'etf').final;
    const hybrid = byId(out, 'hybrid').final;

    expect(etf.totalOutOfPocket).toBeCloseTo(
      etf.totalContributed + etf.mortgageDueTotal,
      6,
    );
    expect(hybrid.totalOutOfPocket).toBeCloseTo(etf.totalOutOfPocket, 6);
  });

  it('costs the hybrid less out of pocket when the freed salary is spent', () => {
    const out = simulate(
      cfg({ years: 25, mortgageStartYear: 3, reinvestRedemption: false }),
    );
    const etf = byId(out, 'etf').final;
    const hybrid = byId(out, 'hybrid').final;
    expect(hybrid.totalOutOfPocket).toBeLessThan(etf.totalOutOfPocket);
    expect(etf.totalOutOfPocket - hybrid.totalOutOfPocket).toBeCloseTo(
      hybrid.mortgagePaidTotal,
      6,
    );
  });

  it('reports reinvested freed salary per scenario, not from the global flag', () => {
    // Only a scenario that actually reinvests may report freed salary. Reading
    // the config flag instead of the scenario once showed a reinvestment row on
    // a scenario that never reinvests.
    const out = simulate(
      cfg({ years: 25, mortgageStartYear: 3, reinvestRedemption: true }),
    );
    expect(byId(out, 'hybrid').final.freedSalaryReinvested).toBeGreaterThan(0);
    expect(byId(out, 'etf').final.freedSalaryReinvested).toBe(0);
  });

  it('charges the ETF scenario the whole mortgage from salary', () => {
    const etf = byId(
      simulate(cfg({ years: 25, mortgageStartYear: 3 })),
      'etf',
    ).final;
    expect(etf.mortgagePaidTotal).toBe(0);
    expect(etf.mortgagePaidFromSalary).toBeCloseTo(etf.mortgageDueTotal, 6);
  });
});

describe('firstHalfShare — art. 4.º/3', () => {
  const uniform = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      year: from + i,
      amount: 2000,
    }));

  it('gives about half for a regular annual contribution', () => {
    // the ordinary case: the 35% test is comfortably met
    expect(firstHalfShare(uniform(1, 20), 20)).toBeGreaterThan(0.45);
    expect(firstHalfShare(uniform(1, 20), 20)).toBeLessThan(0.6);
  });

  it('measures the contract to the redemption date, not the last entrega', () => {
    // Contributions stop in year 10 but redemption happens in year 30, so the
    // midpoint is year 15.5 and EVERY entrega falls in the first half.
    // Measuring to the last entrega would put the midpoint at 5.5 and report
    // roughly half instead.
    expect(firstHalfShare(uniform(1, 10), 30)).toBeCloseTo(1, 10);
  });

  it('still passes for a plan opened late but funded regularly', () => {
    // vigência starts at the FIRST entrega, so a plan opened in year 16 and
    // funded to year 20 still has half its money in its own first half
    expect(firstHalfShare(uniform(16, 20), 20)).toBeGreaterThan(0.35);
  });

  it('fails only when an old plan is back-loaded', () => {
    // a token amount opens the plan, then the real money goes in at the end.
    // This is the one realistic way to fail the test.
    const backLoaded = [
      { year: 1, amount: 100 },
      { year: 19, amount: 10000 },
      { year: 20, amount: 10000 },
    ];
    expect(firstHalfShare(backLoaded, 20)).toBeLessThan(0.35);
  });

  it('returns zero for an empty history', () => {
    expect(firstHalfShare([], 10)).toBe(0);
  });
});

describe('simulate — the mortgage has a term', () => {
  it('stops redeeming once the mortgage is paid off', () => {
    const rows = byId(
      simulate(cfg({ years: 30, mortgageStartYear: 3, mortgageYears: 10 })),
      'hybrid',
    ).rows;
    // mortgage runs years 3..12
    expect(rows[11].redeemedThisYear).toBeGreaterThan(0); // year 12
    for (const r of rows.filter((r) => r.year > 12)) {
      expect(r.redeemedThisYear).toBe(0);
    }
  });

  it('only counts instalments due inside the mortgage term', () => {
    const f = byId(
      simulate(
        cfg({
          years: 30,
          mortgageStartYear: 3,
          mortgageYears: 10,
          monthlyInstalment: 1000,
        }),
      ),
      'etf',
    ).final;
    expect(f.mortgageDueTotal).toBe(12000 * 10);
  });

  it('does not count instalments falling outside the horizon', () => {
    const f = byId(
      simulate(
        cfg({
          years: 10,
          mortgageStartYear: 3,
          mortgageYears: 30,
          monthlyInstalment: 1000,
        }),
      ),
      'etf',
    ).final;
    // mortgage would run to year 32, but only years 3..10 are simulated
    expect(f.mortgageDueTotal).toBe(12000 * 8);
  });

  it('strands the PPR when contributions keep going in after the mortgage', () => {
    // age 30, mortgage runs years 3..12, so age 41 when it ends
    const h = byId(
      simulate(
        cfg({
          currentAge: 30,
          years: 25,
          mortgageStartYear: 3,
          mortgageYears: 10,
          afterMortgage: 'ppr',
        }),
      ),
      'hybrid',
    ).final;
    expect(h.pprAfterMortgageEnds).toBe(true);
    expect(h.penalisedExit).toBe(true);
    expect(h.benefitClawback).toBeGreaterThan(0);
  });

  it('strands nothing when contributions move to the ETF instead', () => {
    // the whole point of the option: no PPR balance is left to be penalised
    const h = byId(
      simulate(
        cfg({
          currentAge: 30,
          years: 25,
          mortgageStartYear: 3,
          mortgageYears: 10,
          afterMortgage: 'etf',
        }),
      ),
      'hybrid',
    ).final;
    expect(h.penalisedExit).toBe(false);
    expect(h.benefitClawback).toBe(0);
  });

  it('does not strand it when the mortgage outlasts the horizon', () => {
    const h = byId(
      simulate(
        cfg({
          currentAge: 30,
          years: 25,
          mortgageStartYear: 3,
          mortgageYears: 30,
        }),
      ),
      'hybrid',
    ).final;
    expect(h.pprAfterMortgageEnds).toBe(false);
    expect(h.penalisedExit).toBe(false);
  });

  it('does not strand it when the participant reaches 60 anyway', () => {
    // mortgage ends at age 61, past the art. 4.o/1 e) threshold
    const h = byId(
      simulate(
        cfg({
          currentAge: 50,
          years: 25,
          mortgageStartYear: 3,
          mortgageYears: 10,
        }),
      ),
      'hybrid',
    ).final;
    expect(h.pprAfterMortgageEnds).toBe(false);
  });

  it('reports the year the mortgage ends', () => {
    const f = byId(
      simulate(cfg({ years: 30, mortgageStartYear: 3, mortgageYears: 10 })),
      'hybrid',
    ).final;
    expect(f.mortgageEndYear).toBe(12);
  });
});

describe('simulate — what happens after the mortgage ends', () => {
  const base = {
    currentAge: 30,
    years: 25,
    mortgageStartYear: 3,
    mortgageYears: 10,
  } as const;

  it('keeps feeding the PPR under "ppr", earning deductions it may not keep', () => {
    const h = byId(simulate(cfg({ ...base, afterMortgage: 'ppr' })), 'hybrid');
    const late = h.rows.filter((r) => r.year > 12);
    expect(late.every((r) => r.contributedThisYear > 0)).toBe(true);
    expect(late.every((r) => r.irsBenefitThisYear > 0)).toBe(true);
    expect(h.rows.at(-1)!.pprBalance).toBeGreaterThan(0);
  });

  it('diverts to the ETF under "etf", and stops earning deductions', () => {
    // the PPR window shuts five years before the mortgage does, at year 7
    const h = byId(simulate(cfg({ ...base, afterMortgage: 'etf' })), 'hybrid');
    const late = h.rows.filter((r) => r.year > 7);
    // still investing the same money out of pocket
    expect(late.every((r) => r.contributedThisYear > 0)).toBe(true);
    // but no deduction, because nothing went into the PPR
    expect(late.every((r) => r.irsBenefitThisYear === 0)).toBe(true);
    // and everything already in the PPR matures in time to get out
    expect(h.rows.at(-1)!.pprBalance).toBeCloseTo(0, 6);
  });

  it('stops contributing under "stop", in every scenario equally', () => {
    const out = simulate(cfg({ ...base, afterMortgage: 'stop' }));
    for (const s of out.scenarios) {
      expect(
        s.rows.filter((r) => r.year > 7).every((r) => r.contributedThisYear === 0),
      ).toBe(true);
    }
    // out of pocket stays identical, so the comparison stays fair
    const [etf, hybrid] = out.scenarios;
    expect(etf.final.totalContributed).toBeCloseTo(
      hybrid.final.totalContributed,
      6,
    );
  });

  it('lets the portfolio ride under "stop" instead of shrinking', () => {
    const rows = byId(
      simulate(cfg({ ...base, afterMortgage: 'stop' })),
      'etf',
    ).rows;
    const late = rows.filter((r) => r.year > 8);
    for (let i = 1; i < late.length; i++) {
      expect(late[i].etfBalance).toBeGreaterThan(late[i - 1].etfBalance);
    }
  });

  it('leaves every scenario costing the same out of pocket under "etf"', () => {
    const out = simulate(cfg({ ...base, afterMortgage: 'etf' }));
    const [etf, hybrid] = out.scenarios;
    expect(etf.final.totalContributed).toBeCloseTo(
      hybrid.final.totalContributed,
      6,
    );
  });
});

describe('simulate — the last year worth contributing to the PPR', () => {
  it('is the mortgage’s final year when the 35% rule applies', () => {
    // art. 4.o/3: the whole plan is redeemable, so a contribution made in the
    // mortgage's last year can be redeemed that same year
    const out = simulate(
      cfg({ mortgageStartYear: 3, mortgageYears: 10, redeemYoungEntregas: true }),
    );
    expect(out.lastUsefulPprYear).toBe(12);
  });

  it('is five years earlier when only the per-entrega rule applies', () => {
    // art. 4.o/2: each entrega must itself be five years old
    const out = simulate(
      cfg({ mortgageStartYear: 3, mortgageYears: 10, redeemYoungEntregas: false }),
    );
    expect(out.lastUsefulPprYear).toBe(7);
  });

  it('is null without a mortgage', () => {
    expect(simulate(cfg({ hasMortgage: false })).lastUsefulPprYear).toBeNull();
  });

  it('is null when the per-entrega rule leaves no usable year at all', () => {
    const out = simulate(
      cfg({ mortgageStartYear: 1, mortgageYears: 3, redeemYoungEntregas: false }),
    );
    expect(out.lastUsefulPprYear).toBeNull();
  });
});

describe('simulate — without a mortgage', () => {
  const noMortgage = (over = {}) =>
    cfg({ hasMortgage: false, years: 25, currentAge: 30, ...over });

  it('never redeems anything', () => {
    for (const r of byId(simulate(noMortgage()), 'hybrid').rows) {
      expect(r.redeemedThisYear).toBe(0);
    }
    expect(byId(simulate(noMortgage()), 'hybrid').final.mortgagePaidTotal).toBe(
      0,
    );
  });

  it('reports no mortgage due, so nothing is paid from salary either', () => {
    const f = byId(simulate(noMortgage()), 'etf').final;
    expect(f.mortgageDueTotal).toBe(0);
    expect(f.mortgagePaidFromSalary).toBe(0);
    expect(f.totalOutOfPocket).toBeCloseTo(f.totalContributed, 6);
  });

  it('penalises the exit when the participant is under 60 at the end', () => {
    // age 30 + 25 years => 54 at the end, short of the art. 4.o/1 e) age
    const h = byId(simulate(noMortgage()), 'hybrid').final;
    expect(h.penalisedExit).toBe(true);
    expect(h.benefitClawback).toBeGreaterThan(0);
  });

  it('allows a legal exit once the participant reaches 60', () => {
    const h = byId(simulate(noMortgage({ years: 31 })), 'hybrid').final;
    expect(h.penalisedExit).toBe(false);
    expect(h.benefitClawback).toBe(0);
  });

  it('claws back every euro deducted, majorado 10% per year', () => {
    const h = byId(simulate(noMortgage()), 'hybrid').final;
    // the clawback always exceeds the raw benefits because of the majoração
    expect(h.benefitClawback).toBeGreaterThan(h.irsBenefitTotal);
  });

  it('costs the hybrid dearly, because the mortgage was its whole tax route', () => {
    const without = byId(simulate(noMortgage()), 'hybrid').final;
    const with_ = byId(
      simulate(cfg({ hasMortgage: true, years: 25, currentAge: 30 })),
      'hybrid',
    ).final;
    expect(without.netWithBenefits).toBeLessThan(with_.netWithBenefits);
    expect(without.penalisedExit).toBe(true);
    expect(with_.penalisedExit).toBe(false);
  });

  it('leaves the pure ETF scenario untouched by the mortgage toggle', () => {
    const a = byId(simulate(noMortgage()), 'etf').final.netValue;
    const b = byId(
      simulate(cfg({ hasMortgage: true, years: 25, currentAge: 30 })),
      'etf',
    ).final.netValue;
    expect(a).toBeCloseTo(b, 6);
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

  it('counts consumed benefits and consumed redemptions once, in hand', () => {
    const s = byId(
      simulate(
        cfg({
          years: 20,
          mortgageStartYear: 6,
          benefitDestination: 'consumed',
          reinvestRedemption: false,
        }),
      ),
      'hybrid',
    );
    expect(s.final.netWithBenefits).toBeCloseTo(
      s.final.netValue + s.final.mortgagePaidTotal + s.final.irsBenefitTotal,
      6,
    );
  });

  it('does NOT add reinvested value again — the portfolio already holds it', () => {
    // The classic double count: when the redemption proceeds are reinvested,
    // the freed salary is already inside the ETF balance, so adding
    // mortgagePaidTotal on top would inflate the result by that amount twice.
    const s = byId(
      simulate(
        cfg({
          years: 20,
          mortgageStartYear: 6,
          benefitDestination: 'etf',
          reinvestRedemption: true,
        }),
      ),
      'hybrid',
    );
    expect(s.final.mortgagePaidTotal).toBeGreaterThan(0);
    expect(s.final.irsBenefitTotal).toBeGreaterThan(0);
    expect(s.final.netWithBenefits).toBeCloseTo(s.final.netValue, 6);
  });

  it('adds only the channel that was actually consumed', () => {
    // benefit reinvested, redemption consumed => only the mortgage counts
    const s = byId(
      simulate(
        cfg({
          years: 20,
          mortgageStartYear: 6,
          benefitDestination: 'etf',
          reinvestRedemption: false,
        }),
      ),
      'hybrid',
    );
    expect(s.final.netWithBenefits).toBeCloseTo(
      s.final.netValue + s.final.mortgagePaidTotal,
      6,
    );
  });

  it('leaves the ETF scenario unaffected — it has no other channel', () => {
    const s = byId(simulate(cfg({ years: 20 })), 'etf');
    expect(s.final.netWithBenefits).toBeCloseTo(s.final.netValue, 6);
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
  it('reduces the PPR result when a tracking error is applied', () => {
    // measured without a mortgage, so the PPR actually accumulates: with one,
    // the plan is drained every year and its closing balance is zero either way
    const base = { hasMortgage: false, years: 33 } as const;
    const without = byId(
      simulate(cfg({ ...base, pprTrackingError: 0 })),
      'hybrid',
    ).final.netWithBenefits;
    const with26 = byId(
      simulate(cfg({ ...base, pprTrackingError: 2.6 })),
      'hybrid',
    ).final.netWithBenefits;
    expect(with26).toBeLessThan(without);
  });

  it('still bites the hybrid when there is a mortgage', () => {
    const without = byId(simulate(cfg({ pprTrackingError: 0 })), 'hybrid').final
      .netWithBenefits;
    const with26 = byId(simulate(cfg({ pprTrackingError: 2.6 })), 'hybrid').final
      .netWithBenefits;
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

  it('reports no break-even when the hybrid leads from the very first year', () => {
    // The hybrid banks the IRS deduction in year 1, so it is normally ahead
    // immediately. There is no crossover, and calling year 1 a break-even
    // would be meaningless.
    const out = simulate(cfg());
    const hybrid = byId(out, 'hybrid');
    const etf = byId(out, 'etf');
    expect(hybrid.rows[0].netWithBenefits).toBeGreaterThanOrEqual(
      etf.rows[0].netWithBenefits,
    );
    expect(out.breakEvenYear).toBeNull();
  });

  it('finds the year from which the hybrid is ahead for good', () => {
    // A large broker cost drags the ETF-heavy hybrid down early, so it starts
    // behind and only overtakes later.
    const out = simulate(
      cfg({
        years: 40,
        pprReturn: 7.97,
        pprFee: 0,
        mortgageStartYear: 6,
        etfAnnualCost: 300,
      }),
    );
    const hybrid = byId(out, 'hybrid');
    const etf = byId(out, 'etf');

    if (hybrid.rows[0].netWithBenefits < etf.rows[0].netWithBenefits) {
      expect(out.breakEvenYear).not.toBeNull();
      const i = out.breakEvenYear! - 1;
      // ahead at the break-even year, and behind the year before
      expect(hybrid.rows[i].netWithBenefits).toBeGreaterThanOrEqual(
        etf.rows[i].netWithBenefits,
      );
      expect(hybrid.rows[i - 1].netWithBenefits).toBeLessThan(
        etf.rows[i - 1].netWithBenefits,
      );
      // and never falls behind again
      for (let k = i; k < hybrid.rows.length; k++) {
        expect(hybrid.rows[k].netWithBenefits).toBeGreaterThanOrEqual(
          etf.rows[k].netWithBenefits,
        );
      }
    }
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
