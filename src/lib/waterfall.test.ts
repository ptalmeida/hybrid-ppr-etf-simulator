import { describe, it, expect } from 'vitest';
import { buildWaterfall } from './waterfall';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';
import type { SimConfig } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

/**
 * The waterfall is only useful if it lands on the number printed on the card.
 * These run across configurations that exercise every step, because the two
 * failure modes (double-counting reinvested value, and subtracting redemption
 * tax that was never in the gross) only show up in some of them.
 */
const CONFIGS: [string, SimConfig][] = [
  ['defaults', cfg()],
  ['long horizon, 20-year mortgage', cfg({ years: 33, mortgageYears: 20, monthlyInstalment: 2000 })],
  ['nothing reinvested', cfg({ benefitDestination: 'consumed', reinvestRedemption: false })],
  ['benefit consumed, redemption reinvested', cfg({ benefitDestination: 'consumed' })],
  ['benefit into PPR', cfg({ benefitDestination: 'ppr' })],
  ['no mortgage, penalised exit', cfg({ hasMortgage: false, years: 25, currentAge: 30 })],
  ['no mortgage, legal exit at 60', cfg({ hasMortgage: false, years: 31, currentAge: 30 })],
  ['mortgage ends early', cfg({ years: 30, mortgageStartYear: 3, mortgageYears: 8 })],
  ['tiny instalment', cfg({ monthlyInstalment: 50 })],
  ['zero contribution', cfg({ annualInvestment: 0 })],
];

describe('buildWaterfall', () => {
  for (const [name, config] of CONFIGS) {
    it(`reconciles with the card headline — ${name}`, () => {
      for (const scenario of simulate(config).scenarios) {
        const steps = buildWaterfall(scenario);
        const total = steps.find((s) => s.isTotal)!;
        expect(total.amount).toBeCloseTo(scenario.final.netWithBenefits, 6);
      }
    });

    it(`has deltas that sum to the total — ${name}`, () => {
      for (const scenario of simulate(config).scenarios) {
        const steps = buildWaterfall(scenario);
        const sum = steps
          .filter((s) => !s.isTotal)
          .reduce((acc, s) => acc + s.amount, 0);
        expect(sum).toBeCloseTo(scenario.final.netWithBenefits, 6);
      }
    });
  }

  it('shows the mortgage exactly once, however the surplus was used', () => {
    // reinvested and consumed are the same euros in different roles, so the
    // step must be identical either way — counting both would double it
    for (const reinvestRedemption of [true, false]) {
      const hybrid = simulate(cfg({ reinvestRedemption })).scenarios.find(
        (s) => s.id === 'hybrid',
      )!;
      const steps = buildWaterfall(hybrid).filter(
        (s) => s.name === 'Prestações pagas pelo PPR',
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].amount).toBeCloseTo(hybrid.final.mortgagePaidTotal, 6);
    }
  });

  it('shows the mortgage even when everything is reinvested', () => {
    // the old chart hid it entirely in this case, which made it useless
    const hybrid = simulate(cfg()).scenarios.find((s) => s.id === 'hybrid')!;
    expect(hybrid.final.freedSalaryReinvested).toBeGreaterThan(0);
    expect(buildWaterfall(hybrid).map((s) => s.name)).toContain(
      'Prestações pagas pelo PPR',
    );
  });

  it('gives the ETF scenario no mortgage or benefit step', () => {
    const etf = simulate(cfg()).scenarios.find((s) => s.id === 'etf')!;
    const names = buildWaterfall(etf).map((s) => s.name);
    expect(names).not.toContain('Prestações pagas pelo PPR');
    expect(names).not.toContain('Benefício de IRS');
    expect(names).toContain('Rendimento dos investimentos');
  });

  it('charges the redemption tax against the inflows', () => {
    // it is a real cost; it just could not be subtracted from grossValue,
    // which never contained it
    const hybrid = simulate(cfg()).scenarios.find((s) => s.id === 'hybrid')!;
    expect(hybrid.final.pprTaxDuringRedemptions).toBeGreaterThan(0);
    const step = buildWaterfall(hybrid).find((s) => s.name === 'Imposto PPR')!;
    expect(step.amount).toBeCloseTo(
      -(hybrid.final.pprTax + hybrid.final.pprTaxDuringRedemptions),
      6,
    );
  });

  it('reports growth as the market return, not a plug that hides tax', () => {
    const etf = simulate(cfg()).scenarios.find((s) => s.id === 'etf')!;
    const growth = buildWaterfall(etf).find(
      (s) => s.name === 'Rendimento dos investimentos',
    )!;
    // with no mortgage or benefit, growth is simply gross minus what went in
    expect(growth.amount).toBeCloseTo(
      etf.final.grossValue - etf.final.totalContributed,
      6,
    );
  });

  it('shows the clawback only on a penalised exit', () => {
    const penalised = simulate(
      cfg({ hasMortgage: false, years: 25, currentAge: 30 }),
    ).scenarios.find((s) => s.id === 'hybrid')!;
    expect(buildWaterfall(penalised).map((s) => s.name)).toContain(
      'Devolução de benefícios',
    );

    const clean = simulate(cfg()).scenarios.find((s) => s.id === 'hybrid')!;
    expect(buildWaterfall(clean).map((s) => s.name)).not.toContain(
      'Devolução de benefícios',
    );
  });

  it('always keeps the opening bar and the total', () => {
    const steps = buildWaterfall(
      simulate(cfg({ annualInvestment: 0 })).scenarios[0],
    );
    expect(steps[0].name).toBe('Entregas do seu bolso');
    expect(steps.at(-1)!.isTotal).toBe(true);
  });
});
