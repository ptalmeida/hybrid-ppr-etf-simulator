import { describe, it, expect } from 'vitest';
import {
  ETF_PRESETS,
  PPR_PRESETS,
  applyEtfPreset,
  applyPprPreset,
  grossReturnFor,
  matchEtfPreset,
  matchPprPreset,
} from './presets';
import { DEFAULT_CONFIG } from './defaults';
import { parseConfig, serialiseConfig } from './url';
import { simulate } from './engine';
import { annualRatePct, feeSchedule } from './fees';
import type { SimConfig } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

describe('preset catalogue', () => {
  it('has unique ids', () => {
    for (const list of [ETF_PRESETS, PPR_PRESETS]) {
      const ids = list.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('cites a source for every entry', () => {
    for (const p of [...ETF_PRESETS, ...PPR_PRESETS]) {
      expect(p.sources.length).toBeGreaterThan(0);
    }
  });

  it('gives every historical figure a machine-comparable window', () => {
    for (const p of [...ETF_PRESETS, ...PPR_PRESETS]) {
      if (!p.history) continue;
      expect(p.history.from).toMatch(/^\d{4}-\d{2}$/);
      expect(p.history.to).toMatch(/^\d{4}-\d{2}$/);
      expect(p.history.from < p.history.to).toBe(true);
    }
  });

  it('carries a same-window equity comparison wherever the window is unusual', () => {
    // Golden's window starts at the oct-2023 low and skips the 2022 fall, so
    // its 12.4% reads as beating a 100% equity fund unless the same-window
    // figure is shown beside it
    const golden = PPR_PRESETS.find((p) => p.id === 'golden-etf')!;
    expect(golden.history!.from).toBe('2023-10');
    expect(golden.history!.comparableEquity).toBeDefined();
    expect(
      golden.history!.comparableEquity!.annualisedPct,
    ).toBeGreaterThan(golden.history!.annualisedPct);
  });

  it('gives every PPR a same-window equity comparison', () => {
    for (const p of PPR_PRESETS) {
      if (!p.history) continue;
      expect(p.history.comparableEquity).toBeDefined();
    }
  });

  it('states the window for every historical figure', () => {
    for (const p of [...ETF_PRESETS, ...PPR_PRESETS]) {
      if (!p.history) continue;
      expect(p.history.window).toMatch(/\d/);
      expect(p.history.years).toBeGreaterThan(0);
    }
  });

  it('gives every preset a finite, plausible long-run expected return', () => {
    for (const p of [...ETF_PRESETS, ...PPR_PRESETS]) {
      expect(Number.isFinite(p.expected.grossPct)).toBe(true);
      expect(p.expected.grossPct).toBeGreaterThan(0);
      expect(p.expected.grossPct).toBeLessThan(15);
    }
  });

  it('never expects a 100% equity ETF to repeat its own recent bull run', () => {
    // the long-run forward estimate must be more conservative than a trailing
    // window that happened to catch a bull market
    for (const p of ETF_PRESETS) {
      if (!p.history) continue;
      expect(p.expected.grossPct).toBeLessThan(p.history.annualisedPct);
    }
  });

  it('keeps the return out of `values`, so matching ignores it', () => {
    // applying a preset does set the return, but a user who then edits it is
    // still holding the same product and must not read as custom
    for (const p of ETF_PRESETS) {
      expect(p.values).not.toHaveProperty('etfReturn');
    }
    for (const p of PPR_PRESETS) {
      expect(p.values).not.toHaveProperty('pprReturn');
    }
  });

  it('applies the long-run expectation, not the trailing window', () => {
    for (const p of ETF_PRESETS) {
      expect(applyEtfPreset(p).etfReturn).toBe(p.expected.grossPct);
    }
    for (const p of PPR_PRESETS) {
      expect(applyPprPreset(p).pprReturn).toBe(p.expected.grossPct);
    }
  });

  it('moves the return when the product changes', () => {
    const vwce = applyEtfPreset(ETF_PRESETS.find((p) => p.id === 'vwce')!);
    const vuaa = applyEtfPreset(ETF_PRESETS.find((p) => p.id === 'vuaa')!);
    // the S&P 500 estimate is deliberately below the global one
    expect(vuaa.etfReturn).toBeLessThan(vwce.etfReturn!);
  });

  it('expects less from every PPR than from a global equity ETF', () => {
    // they are all mixed funds, so none should out-expect 100% equities
    const vwce = ETF_PRESETS.find((p) => p.id === 'vwce')!;
    for (const p of PPR_PRESETS) {
      expect(p.expected.grossPct).toBeLessThan(vwce.expected.grossPct);
    }
  });

  it('never sets broker costs, which belong to the user not the fund', () => {
    for (const p of ETF_PRESETS) {
      expect(p.values).not.toHaveProperty('etfBuyFee');
      expect(p.values).not.toHaveProperty('etfCustodyFee');
      expect(p.values).not.toHaveProperty('etfAnnualCost');
    }
  });
});

describe('applying and matching', () => {
  it('ships defaults that match a preset, so nothing opens as custom', () => {
    expect(matchEtfPreset(DEFAULT_CONFIG)?.id).toBe('vwce');
    expect(matchPprPreset(DEFAULT_CONFIG)?.id).toBe('golden-etf');
  });

  it('round-trips every ETF preset', () => {
    for (const p of ETF_PRESETS) {
      const applied = cfg(applyEtfPreset(p));
      expect(matchEtfPreset(applied)?.id).toBe(p.id);
    }
  });

  it('round-trips every PPR preset', () => {
    for (const p of PPR_PRESETS) {
      const applied = cfg(applyPprPreset(p));
      expect(matchPprPreset(applied)?.id).toBe(p.id);
    }
  });

  it('becomes custom when a fee the preset owns is edited', () => {
    const applied = cfg(applyPprPreset(PPR_PRESETS[0]));
    expect(matchPprPreset(applied)).not.toBeNull();
    expect(matchPprPreset({ ...applied, pprDepositaryFee: 0.5 })).toBeNull();
  });

  it('becomes custom when the product name is edited', () => {
    const applied = cfg(applyEtfPreset(ETF_PRESETS[0]));
    expect(matchEtfPreset({ ...applied, etfName: 'outro' })).toBeNull();
  });

  it('stays on the preset when a field it does not own changes', () => {
    // the return is the user's forecast, so changing it must NOT make the
    // product read as custom — it is still the same product
    const applied = cfg(applyPprPreset(PPR_PRESETS[0]));
    expect(matchPprPreset({ ...applied, pprReturn: 3 })?.id).toBe(
      PPR_PRESETS[0].id,
    );
    expect(matchEtfPreset({ ...applied, etfReturn: 4 })).not.toBeNull();
  });

  it('becomes custom when the tiered fee rules are edited', () => {
    const golden = PPR_PRESETS.find((p) => p.id === 'golden-etf')!;
    const applied = cfg(applyPprPreset(golden));
    expect(matchPprPreset(applied)?.id).toBe('golden-etf');
    expect(matchPprPreset({ ...applied, extraFees: [] })).toBeNull();
  });

  it('clears the previous tiered rules when switching product', () => {
    const golden = cfg(applyPprPreset(PPR_PRESETS.find((p) => p.id === 'golden-etf')!));
    expect(golden.extraFees?.length).toBeGreaterThan(0);

    const flat = PPR_PRESETS.find((p) => p.id === 'stoik')!;
    const switched = cfg({ ...golden, ...applyPprPreset(flat) });
    // Golden's bands must not linger and quietly keep charging
    expect(switched.extraFees).toEqual([]);
    expect(matchPprPreset(switched)?.id).toBe('stoik');
  });
});

describe('grossReturnFor', () => {
  it('grosses the published net figure up by the annual charges', () => {
    const stoik = PPR_PRESETS.find((p) => p.id === 'stoik')!;
    // 3.10 net + 1.00 management + 0.08 depositary
    expect(grossReturnFor(stoik)).toBeCloseTo(4.18, 6);
  });

  it('reproduces the published figure once the engine takes its cut', () => {
    const stoik = PPR_PRESETS.find((p) => p.id === 'stoik')!;
    const gross = grossReturnFor(stoik)!;
    const applied = cfg({ ...applyPprPreset(stoik), pprReturn: gross });
    const netRate = annualRatePct(feeSchedule(applied), {
      product: 'ppr',
      year: 1,
      balance: 1000,
      amount: 1000,
    });
    expect(gross - netRate).toBeCloseTo(stoik.history!.annualisedPct, 6);
  });

  it('uses the dearest band for a balance-tiered product', () => {
    // a small plan pays Classe Start's 1%, so grossing up by less would
    // overstate what the product actually delivered
    const golden = PPR_PRESETS.find((p) => p.id === 'golden-etf')!;
    // 12.40 net + 1.00 (Start) + 0.08 depositary + 0.35 underlying
    expect(grossReturnFor(golden)).toBeCloseTo(13.83, 6);
  });

  it('returns null when a preset has no published history', () => {
    const noHistory = ETF_PRESETS.find((p) => !p.history);
    expect(noHistory).toBeDefined();
    expect(grossReturnFor(noHistory!)).toBeNull();
  });
});

describe('presets survive a shared link', () => {
  it('round-trips the tiered default through the URL', () => {
    const back = parseConfig(serialiseConfig(DEFAULT_CONFIG));
    expect(back.extraFees).toEqual(DEFAULT_CONFIG.extraFees);
    expect(matchPprPreset(back)?.id).toBe('golden-etf');
  });

  it('round-trips a switch to a preset with no tiered fees', () => {
    const stoik = cfg(applyPprPreset(PPR_PRESETS.find((p) => p.id === 'stoik')!));
    const back = parseConfig(serialiseConfig(stoik));
    expect(back.extraFees).toEqual([]);
    expect(matchPprPreset(back)?.id).toBe('stoik');
  });

  it('computes the same result after a round trip', () => {
    const golden = cfg({ years: 25 });
    const back = parseConfig(serialiseConfig(golden));
    expect(simulate(back).scenarios[1].final.netWithBenefits).toBeCloseTo(
      simulate(golden).scenarios[1].final.netWithBenefits,
      10,
    );
  });

  it('falls back to defaults on a mangled fee payload', () => {
    expect(() => parseConfig('xf=not-base64!!')).not.toThrow();
    expect(parseConfig('xf=not-base64!!').extraFees).toEqual([]);
  });
});

describe('the presets tell an honest story', () => {
  it('makes the market-average PPR lose badly to a global ETF', () => {
    const avg = PPR_PRESETS.find((p) => p.id === 'media-mercado')!;
    const vwce = ETF_PRESETS.find((p) => p.id === 'vwce')!;
    const out = simulate(
      cfg({
        ...applyPprPreset(avg),
        ...applyEtfPreset(vwce),
        pprReturn: grossReturnFor(avg)!,
        etfReturn: grossReturnFor(vwce)!,
        years: 30,
      }),
    );
    const [etf, hybrid] = out.scenarios;
    expect(hybrid.final.netWithBenefits).toBeLessThan(
      etf.final.netWithBenefits,
    );
  });

  it('charges Optimize Agressivo far more than Golden over 30 years', () => {
    const fees = (id: string) => {
      const p = PPR_PRESETS.find((x) => x.id === id)!;
      return simulate(cfg({ ...applyPprPreset(p), years: 30 })).scenarios[1]
        .final.feesPaid;
    };
    expect(fees('optimize-agressivo')).toBeGreaterThan(fees('golden-etf'));
  });
});
