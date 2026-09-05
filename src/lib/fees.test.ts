import { describe, it, expect } from 'vitest';
import {
  annualFixed,
  annualRatePct,
  chargeFor,
  feeSchedule,
  scalarFeeRules,
  type FeeRule,
} from './fees';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';
import type { SimConfig } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

const ctx = (over: Partial<Parameters<typeof chargeFor>[2]> = {}) => ({
  product: 'ppr' as const,
  year: 1,
  balance: 1000,
  amount: 1000,
  ...over,
});

describe('chargeFor — conditions', () => {
  const rule = (over: Partial<FeeRule>): FeeRule => ({
    label: 'test',
    product: 'ppr',
    basis: 'annual',
    pct: 1,
    ...over,
  });

  it('charges a percentage of the amount', () => {
    expect(chargeFor([rule({})], 'annual', ctx())).toBeCloseTo(10, 10);
  });

  it('adds a flat component', () => {
    expect(chargeFor([rule({ pct: 0, fixed: 25 })], 'annual', ctx())).toBe(25);
  });

  it('ignores rules for the other product', () => {
    expect(
      chargeFor([rule({ product: 'etf' })], 'annual', ctx({ product: 'ppr' })),
    ).toBe(0);
  });

  it('ignores rules for another basis', () => {
    expect(chargeFor([rule({ basis: 'exit' })], 'annual', ctx())).toBe(0);
  });

  it('sums every rule that applies', () => {
    expect(
      chargeFor([rule({ pct: 1 }), rule({ pct: 0.5 })], 'annual', ctx()),
    ).toBeCloseTo(15, 10);
  });

  it('respects a balance floor', () => {
    const r = rule({ minBalance: 10000 });
    expect(chargeFor([r], 'annual', ctx({ balance: 9999 }))).toBe(0);
    expect(chargeFor([r], 'annual', ctx({ balance: 10000 }))).toBeCloseTo(10, 10);
  });

  it('respects a balance ceiling, exclusive at the top', () => {
    const r = rule({ maxBalance: 10000 });
    expect(chargeFor([r], 'annual', ctx({ balance: 9999 }))).toBeCloseTo(10, 10);
    expect(chargeFor([r], 'annual', ctx({ balance: 10000 }))).toBe(0);
  });

  it('respects a year window', () => {
    const r = rule({ fromYear: 3, toYear: 5 });
    expect(chargeFor([r], 'annual', ctx({ year: 2 }))).toBe(0);
    expect(chargeFor([r], 'annual', ctx({ year: 3 }))).toBeCloseTo(10, 10);
    expect(chargeFor([r], 'annual', ctx({ year: 5 }))).toBeCloseTo(10, 10);
    expect(chargeFor([r], 'annual', ctx({ year: 6 }))).toBe(0);
  });

  it('respects an age window', () => {
    const r = rule({ basis: 'redemption', maxAgeYears: 2 });
    expect(
      chargeFor([r], 'redemption', ctx({ ageYears: 1 })),
    ).toBeCloseTo(10, 10);
    expect(chargeFor([r], 'redemption', ctx({ ageYears: 2 }))).toBe(0);
  });

  it('never applies an age rule to an event with no age', () => {
    const r = rule({ maxAgeYears: 2 });
    expect(chargeFor([r], 'annual', ctx())).toBe(0);
  });

  it('charges performance only above the hurdle', () => {
    const r = rule({ basis: 'performance', pct: 20, hurdlePct: 5 });
    // balance 1000, hurdle 5% = 50. Gain 200 => 150 above => 20% = 30
    expect(
      chargeFor([r], 'performance', ctx({ gain: 200 })),
    ).toBeCloseTo(30, 10);
    // a gain below the hurdle costs nothing
    expect(chargeFor([r], 'performance', ctx({ gain: 40 }))).toBe(0);
    // and a loss certainly does not
    expect(chargeFor([r], 'performance', ctx({ gain: -100 }))).toBe(0);
  });

  it('never returns a negative charge', () => {
    expect(chargeFor([rule({ pct: -5 })], 'annual', ctx())).toBe(0);
  });
});

describe('annualRatePct / annualFixed', () => {
  it('splits the percentage and flat parts', () => {
    const rules: FeeRule[] = [
      { label: 'a', product: 'etf', basis: 'annual', pct: 0.2 },
      { label: 'b', product: 'etf', basis: 'annual', pct: 0.3, fixed: 12 },
    ];
    const c = ctx({ product: 'etf' });
    expect(annualRatePct(rules, c)).toBeCloseTo(0.5, 10);
    expect(annualFixed(rules, c)).toBe(12);
  });

  it('applies balance tiers to the rate', () => {
    // the shape Golden SGF actually uses: 1% below 10k, 0.75% at or above
    const rules: FeeRule[] = [
      {
        label: 'Classe Start',
        product: 'ppr',
        basis: 'annual',
        pct: 1,
        maxBalance: 10000,
      },
      {
        label: 'Classe Plus',
        product: 'ppr',
        basis: 'annual',
        pct: 0.75,
        minBalance: 10000,
      },
    ];
    expect(annualRatePct(rules, ctx({ balance: 5000 }))).toBeCloseTo(1, 10);
    expect(annualRatePct(rules, ctx({ balance: 50000 }))).toBeCloseTo(0.75, 10);
  });
});

describe('scalarFeeRules', () => {
  it('emits nothing when every fee is zero', () => {
    const zero = cfg({
      pprSubscriptionFee: 0,
      pprFee: 0,
      pprDepositaryFee: 0,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 0,
      pprTrackingError: 0,
      etfFee: 0,
      etfCustodyFee: 0,
      etfBuyFee: 0,
      etfBuyFeeFixed: 0,
      etfSellFee: 0,
      etfAnnualCost: 0,
    });
    expect(scalarFeeRules(zero)).toEqual([]);
  });

  it('turns the defaults into the expected annual drag', () => {
    const rules = scalarFeeRules(DEFAULT_CONFIG);
    expect(
      annualRatePct(rules, ctx({ product: 'ppr' })),
    ).toBeCloseTo(DEFAULT_CONFIG.pprFee + DEFAULT_CONFIG.pprDepositaryFee, 10);
    expect(annualRatePct(rules, ctx({ product: 'etf' }))).toBeCloseTo(
      DEFAULT_CONFIG.etfFee,
      10,
    );
  });

  it('appends extraFees to the scalar rules', () => {
    const extra: FeeRule = {
      label: 'Comissão de performance',
      product: 'ppr',
      basis: 'performance',
      pct: 10,
      hurdlePct: 4,
    };
    const schedule = feeSchedule(cfg({ extraFees: [extra] }));
    expect(schedule).toContainEqual(extra);
    expect(schedule.length).toBe(scalarFeeRules(DEFAULT_CONFIG).length + 1);
  });
});

describe('simulate — irregular fees end to end', () => {
  const flat = {
    pprFee: 0,
    pprDepositaryFee: 0,
    pprUnderlyingFee: 0,
    etfFee: 0,
    years: 20,
    mortgageStartYear: 999,
  } as const;

  it('switches management fee band as the balance grows', () => {
    const tiered = simulate(
      cfg({
        ...flat,
        extraFees: [
          {
            label: 'Classe Start',
            product: 'ppr',
            basis: 'annual',
            pct: 1,
            maxBalance: 10000,
          },
          {
            label: 'Classe Plus',
            product: 'ppr',
            basis: 'annual',
            pct: 0.75,
            minBalance: 10000,
          },
        ],
      }),
    );
    const alwaysHigh = simulate(cfg({ ...flat, pprFee: 1 }));
    const alwaysLow = simulate(cfg({ ...flat, pprFee: 0.75 }));

    const v = (o: ReturnType<typeof simulate>) =>
      o.scenarios.find((s) => s.id === 'hybrid')!.final.grossValue;

    // pays 1% early and 0.75% later, so it must land strictly between
    expect(v(tiered)).toBeGreaterThan(v(alwaysHigh));
    expect(v(tiered)).toBeLessThan(v(alwaysLow));
  });

  it('charges a promotional rate only for its window', () => {
    const promo = simulate(
      cfg({
        ...flat,
        extraFees: [
          {
            label: 'Promoção 2 anos',
            product: 'ppr',
            basis: 'annual',
            pct: 2,
            toYear: 2,
          },
        ],
      }),
    );
    const none = simulate(cfg({ ...flat }));
    const fees = (o: ReturnType<typeof simulate>) =>
      o.scenarios.find((s) => s.id === 'hybrid')!.final.feesPaid;
    expect(fees(promo)).toBeGreaterThan(fees(none));
    // only two years of 2% on a small early balance, so it stays modest
    expect(fees(promo) - fees(none)).toBeLessThan(200);
  });

  it('charges a performance fee only on gains above the hurdle', () => {
    const withPerf = cfg({
      ...flat,
      pprReturn: 10,
      extraFees: [
        {
          label: 'Comissão de performance',
          product: 'ppr',
          basis: 'performance',
          pct: 20,
          hurdlePct: 5,
        },
      ],
    });
    const charged = simulate(withPerf).scenarios.find(
      (s) => s.id === 'hybrid',
    )!.final;
    expect(charged.feesPaid).toBeGreaterThan(0);

    // the same fee against a return below the hurdle costs nothing
    const belowHurdle = simulate({
      ...withPerf,
      pprReturn: 3,
    }).scenarios.find((s) => s.id === 'hybrid')!.final;
    expect(belowHurdle.feesPaid).toBeCloseTo(0, 6);
  });

  it('charges a flat euro account fee on the PPR', () => {
    const withFlat = simulate(
      cfg({
        ...flat,
        extraFees: [
          {
            label: 'Manutenção de conta',
            product: 'ppr',
            basis: 'annual',
            fixed: 20,
          },
        ],
      }),
    ).scenarios.find((s) => s.id === 'hybrid')!.final;
    expect(withFlat.feesPaid).toBeCloseTo(20 * 20, 6);
  });

  it('steps a redemption fee down by holding period', () => {
    const stepped = simulate(
      cfg({
        years: 25,
        mortgageStartYear: 3,
        pprRedemptionFee: 0,
        extraFees: [
          {
            label: 'Reembolso até 6 anos',
            product: 'ppr',
            basis: 'redemption',
            pct: 1,
            maxAgeYears: 6,
          },
          {
            label: 'Reembolso 6 a 8 anos',
            product: 'ppr',
            basis: 'redemption',
            pct: 0.5,
            minAgeYears: 6,
            maxAgeYears: 8,
          },
        ],
      }),
    ).scenarios.find((s) => s.id === 'hybrid')!;

    for (const e of stepped.redemptions) {
      const expected =
        e.ageYears < 6 ? 0.01 : e.ageYears < 8 ? 0.005 : 0;
      expect(e.fee).toBeCloseTo(e.gross * expected, 6);
    }
  });

  it('leaves results identical when extraFees is empty', () => {
    const a = simulate(cfg({ years: 25 }));
    const b = simulate(cfg({ years: 25, extraFees: [] }));
    expect(b.scenarios[1].final.netWithBenefits).toBeCloseTo(
      a.scenarios[1].final.netWithBenefits,
      10,
    );
  });
});
