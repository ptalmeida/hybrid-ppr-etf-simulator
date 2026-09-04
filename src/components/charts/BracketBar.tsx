import { formatEur, formatRate } from '../../lib/format';
import type { BracketSlice } from '../../lib/types';

const BRACKET_ORDER = [
  '8 anos ou mais',
  '5 a 8 anos',
  '2 a 5 anos',
  'menos de 2 anos',
];

const BRACKET_COLORS: Record<string, string> = {
  '8 anos ou mais': '#059669',
  '5 a 8 anos': '#34d399',
  '2 a 5 anos': '#fbbf24',
  'menos de 2 anos': '#f43f5e',
};

export function BracketBar({ slices }: { slices: BracketSlice[] }) {
  const ordered = BRACKET_ORDER.map((b) =>
    slices.find((s) => s.bracket === b),
  ).filter((s): s is BracketSlice => s !== undefined && s.gain > 0);

  const totalGain = ordered.reduce((sum, s) => sum + s.gain, 0);

  if (totalGain <= 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sem mais-valias no ETF para repartir por escalões.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="flex h-8 w-full overflow-hidden rounded-lg"
        role="img"
        aria-label="Repartição das mais-valias do ETF por escalão de tributação"
      >
        {ordered.map((s) => (
          <div
            key={s.bracket}
            style={{
              width: `${(s.gain / totalGain) * 100}%`,
              backgroundColor: BRACKET_COLORS[s.bracket],
            }}
            title={`${s.bracket}: ${formatEur(s.gain)}`}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {ordered.map((s) => (
          <li
            key={s.bracket}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: BRACKET_COLORS[s.bracket] }}
            />
            <span className="flex-1 text-slate-700 dark:text-slate-300">
              {s.bracket}{' '}
              <span className="text-slate-500 dark:text-slate-400">
                ({formatRate(s.ratePct)})
              </span>
            </span>
            <span className="tnum text-slate-600 dark:text-slate-400">
              {formatEur(s.gain)} de ganho
            </span>
            <span className="tnum w-24 text-right font-medium text-rose-600 dark:text-rose-400">
              {formatEur(s.tax)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
