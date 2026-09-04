import { describe, it, expect } from 'vitest';
import { buildExplanation } from './explain';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';

const textOf = (cfg = DEFAULT_CONFIG) =>
  buildExplanation(cfg, simulate(cfg))
    .map((s) => `${s.title} ${s.body}`)
    .join(' ');

describe('buildExplanation', () => {
  it('names the configured products', () => {
    const text = textOf({
      ...DEFAULT_CONFIG,
      etfName: 'VWCE',
      pprName: 'Golden SGF',
    });
    expect(text).toContain('VWCE');
    expect(text).toContain('Golden SGF');
  });

  it('warns explicitly when nothing is reinvested', () => {
    const text = textOf({
      ...DEFAULT_CONFIG,
      benefitDestination: 'consumed',
      reinvestRedemption: false,
    });
    expect(text).toContain('gasta');
    expect(text).toContain('Sem reinvestimento');
  });

  it('returns at least four steps for the default configuration', () => {
    expect(
      buildExplanation(DEFAULT_CONFIG, simulate(DEFAULT_CONFIG)).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('does not throw when no redemption ever happens', () => {
    const cfg = { ...DEFAULT_CONFIG, mortgageStartYear: 999 };
    expect(() => buildExplanation(cfg, simulate(cfg))).not.toThrow();
    expect(textOf(cfg)).toContain('não há resgates');
  });

  it('quotes the actual computed totals', () => {
    const out = simulate(DEFAULT_CONFIG);
    const hybrid = out.scenarios.find((s) => s.id === 'hybrid')!;
    const text = buildExplanation(DEFAULT_CONFIG, out)
      .map((s) => s.body)
      .join(' ');
    // the total contributed appears verbatim, formatted for pt-PT
    expect(text).toContain(
      new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(hybrid.final.totalContributed),
    );
  });
});
