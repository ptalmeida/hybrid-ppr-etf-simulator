import { describe, it, expect } from 'vitest';
import { logAxis } from './chartTheme';

describe('logAxis', () => {
  it('stays linear when the toggle is off', () => {
    const a = logAxis([1, 10, 100], false);
    expect(a.scale).toBe('linear');
    expect(a.applied).toBe(false);
  });

  it('applies a log scale to all-positive values', () => {
    const a = logAxis([2000, 50000, 280000], true);
    expect(a.scale).toBe('log');
    expect(a.applied).toBe(true);
  });

  it('snaps the domain to whole decades', () => {
    const a = logAxis([2000, 280000], true);
    expect(a.domain).toEqual([1000, 1000000]);
    expect(a.ticks).toEqual([1000, 10000, 100000, 1000000]);
  });

  it('refuses a log scale when any value is zero', () => {
    // log(0) is undefined, so one zero invalidates the whole axis
    const a = logAxis([0, 100, 1000], true);
    expect(a.scale).toBe('linear');
    expect(a.applied).toBe(false);
  });

  it('refuses a log scale when any value is negative', () => {
    // the delta chart crosses zero, so it can never use a log axis
    const a = logAxis([-500, 100, 1000], true);
    expect(a.scale).toBe('linear');
    expect(a.applied).toBe(false);
  });

  it('refuses a log scale for an empty series', () => {
    expect(logAxis([], true).applied).toBe(false);
  });

  it('ignores non-finite values rather than throwing', () => {
    expect(() => logAxis([NaN, Infinity, 100], true)).not.toThrow();
    expect(logAxis([NaN, Infinity, 100], true).applied).toBe(true);
  });

  it('handles a single value', () => {
    const a = logAxis([5000], true);
    expect(a.applied).toBe(true);
    expect(a.domain![0]).toBeLessThanOrEqual(5000);
    expect(a.domain![1]).toBeGreaterThanOrEqual(5000);
  });

  it('produces a domain that contains every value', () => {
    const values = [1234, 98765, 4321];
    const a = logAxis(values, true);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(a.domain![0]);
      expect(v).toBeLessThanOrEqual(a.domain![1]);
    }
  });
});
