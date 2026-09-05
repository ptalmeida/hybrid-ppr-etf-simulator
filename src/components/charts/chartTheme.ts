import { formatEur } from '../../lib/format';

export const SERIES_COLORS: Record<string, string> = {
  etf: '#0ea5e9',
  hybrid: '#10b981',
};

export const AXIS = {
  stroke: 'currentColor',
  fontSize: 12,
} as const;

export const gridProps = {
  strokeDasharray: '3 3',
  className: 'stroke-slate-200 dark:stroke-slate-800',
} as const;

/**
 * Recharts types a tooltip value as `ValueType | undefined`, so every
 * formatter needs the same narrowing. Doing it once here keeps the charts
 * free of casts.
 */
export function currencyFormatter(fallbackName: string) {
  return (value: unknown, name?: unknown): [string, string] => [
    typeof value === 'number' ? formatEur(value) : '—',
    typeof name === 'string' ? name : fallbackName,
  ];
}

export interface AxisScale {
  scale: 'log' | 'linear';
  domain?: [number, number];
  ticks?: number[];
  /** True when a log axis was actually applied, not silently refused. */
  applied: boolean;
}

const LINEAR: AxisScale = { scale: 'linear', applied: false };

/**
 * Y-axis props for a log scale, or linear when a log scale is impossible.
 *
 * log(x) is undefined at zero and below, so a single non-positive value in the
 * series makes the whole axis invalid. Rather than let Recharts render a broken
 * or empty chart, this falls back to linear and reports it via `applied`, so
 * the UI can tell the reader the toggle did not take effect.
 *
 * The domain is snapped to whole decades so the gridlines land on round
 * numbers, which is the point of reading a log chart in the first place.
 */
export function logAxis(values: number[], enabled: boolean): AxisScale {
  if (!enabled) return LINEAR;

  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0 || finite.some((v) => v <= 0)) return LINEAR;

  const lo = 10 ** Math.floor(Math.log10(Math.min(...finite)));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...finite)));

  const ticks: number[] = [];
  for (let t = lo; t <= hi * 1.000001; t *= 10) ticks.push(t);

  return { scale: 'log', domain: [lo, hi], ticks, applied: true };
}

export const tooltipStyle = {
  contentStyle: {
    borderRadius: '0.5rem',
    border: '1px solid rgb(148 163 184)',
    backgroundColor: 'rgb(255 255 255 / 0.96)',
    color: 'rgb(15 23 42)',
    fontSize: '0.8125rem',
  },
} as const;
