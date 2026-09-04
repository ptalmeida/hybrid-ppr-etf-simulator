const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurPrecise = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat('pt-PT', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const formatEur = (n: number) => eur.format(n);
export const formatEurPrecise = (n: number) => eurPrecise.format(n);
export const formatPct = (fraction: number) => pct.format(fraction);
export const formatRate = (percent: number) =>
  `${percent.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`;

/** Compact axis labels: 12 500 -> "12,5 mil", 1 250 000 -> "1,25 M". */
export function formatCompactEur(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(n) >= 1_000)
    return `${(n / 1_000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} mil`;
  return formatEur(n);
}
