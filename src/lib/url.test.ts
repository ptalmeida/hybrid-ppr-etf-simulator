import { describe, it, expect } from 'vitest';
import { serialiseConfig, parseConfig } from './url';
import { DEFAULT_CONFIG } from './defaults';

describe('serialiseConfig / parseConfig', () => {
  it('round-trips the default config', () => {
    expect(parseConfig(serialiseConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a fully customised config', () => {
    const custom = {
      ...DEFAULT_CONFIG,
      currentAge: 41,
      contributionMode: 'maxDeductible' as const,
      contributionTiming: 'end' as const,
      years: 25,
      etfReturn: 6.5,
      pprTrackingError: 2.6,
      benefitDestination: 'ppr' as const,
      reinvestRedemption: false,
      etfTaxMode: 'englobamento' as const,
      use35Rule: false,
      irsBandsEnabled: false,
      etfName: 'VWCE',
      pprName: 'Golden SGF',
    };
    expect(parseConfig(serialiseConfig(custom))).toEqual(custom);
  });

  it('omits values that match the defaults, keeping links short', () => {
    expect(serialiseConfig(DEFAULT_CONFIG)).toBe('');
    expect(serialiseConfig({ ...DEFAULT_CONFIG, years: 20 })).toBe('yrs=20');
  });

  it('falls back to defaults for an empty query string', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unknown keys', () => {
    expect(parseConfig('nonsense=1&yrs=20').years).toBe(20);
  });

  it('falls back to the default for an unparseable number', () => {
    expect(parseConfig('yrs=banana').years).toBe(DEFAULT_CONFIG.years);
  });

  it('clamps numbers to their bounds instead of throwing', () => {
    expect(parseConfig('yrs=9999').years).toBe(60);
    expect(parseConfig('yrs=-5').years).toBe(1);
    expect(parseConfig('age=3').currentAge).toBe(18);
  });

  it('falls back to the default for an invalid enum value', () => {
    expect(parseConfig('etfTax=bogus').etfTaxMode).toBe('ladder');
    expect(parseConfig('bdest=bogus').benefitDestination).toBe('etf');
    expect(parseConfig('ctime=bogus').contributionTiming).toBe('start');
  });

  it('truncates over-long product names', () => {
    expect(parseConfig(`etfN=${'x'.repeat(200)}`).etfName).toHaveLength(40);
  });

  it('falls back to the default name when the value is blank', () => {
    expect(parseConfig('etfN=%20%20').etfName).toBe(DEFAULT_CONFIG.etfName);
  });

  it('does not throw on a malformed query string', () => {
    expect(() => parseConfig('%%%&&&=')).not.toThrow();
  });
});
