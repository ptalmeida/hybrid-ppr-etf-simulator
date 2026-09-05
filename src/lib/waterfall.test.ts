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

  it('never adds back value that was reinvested', () => {
    // defaults reinvest both channels, so neither may appear as a step
    const hybrid = simulate(cfg()).scenarios.find((s) => s.id === 'hybrid')!;
    expect(hybrid.final.mortgagePaidTotal).toBeGreaterThan(0);
    expect(hybrid.final.irsBenefitTotal).toBeGreaterThan(0);

    const names = buildWaterfall(hybrid).map((s) => s.name);
    expect(names).not.toContain('Prestações pagas');
    expect(names).not.toContain('Benefício IRS');
  });

  it('does add back value that was consumed', () => {
    const hybrid = simulate(
      cfg({ benefitDestination: 'consumed', reinvestRedemption: false }),
    ).scenarios.find((s) => s.id === 'hybrid')!;
    const names = buildWaterfall(hybrid).map((s) => s.name);
    expect(names).toContain('Prestações pagas');
    expect(names).toContain('Benefício IRS');
  });

  it('never subtracts the tax withheld on redemptions', () => {
    // that money left the plan years earlier and is not inside grossValue
    const hybrid = simulate(cfg()).scenarios.find((s) => s.id === 'hybrid')!;
    expect(hybrid.final.pprTaxDuringRedemptions).toBeGreaterThan(0);
    const steps = buildWaterfall(hybrid);
    const pprTaxStep = steps.find((s) => s.name === 'Imposto PPR');
    if (pprTaxStep) {
      expect(pprTaxStep.amount).toBeCloseTo(-hybrid.final.pprTax, 6);
    }
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
    expect(steps[0].name).toBe('Carteira bruta');
    expect(steps.at(-1)!.isTotal).toBe(true);
  });
});
