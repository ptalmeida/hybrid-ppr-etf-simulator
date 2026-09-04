import { formatEur } from '../../lib/format';

export const SERIES_COLORS: Record<string, string> = {
  etf: '#0ea5e9',
  hybrid: '#10b981',
  ppr: '#8b5cf6',
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

export const tooltipStyle = {
  contentStyle: {
    borderRadius: '0.5rem',
    border: '1px solid rgb(148 163 184)',
    backgroundColor: 'rgb(255 255 255 / 0.96)',
    color: 'rgb(15 23 42)',
    fontSize: '0.8125rem',
  },
} as const;
