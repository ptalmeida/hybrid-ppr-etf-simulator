import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS,
  currencyFormatter,
  gridProps,
  tooltipStyle,
  withOrigin,
} from './chartTheme';
import { formatCompactEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

export function DeltaChart({
  etf,
  hybrid,
  breakEvenYear,
}: {
  etf: ScenarioResult;
  hybrid: ScenarioResult;
  breakEvenYear: number | null;
}) {
  const rows = hybrid.rows.map((r, i) => ({
    year: r.year,
    delta: r.netWithBenefits - etf.rows[i].netWithBenefits,
  }));
  // the difference is zero before anything is invested, so the origin is real
  const data = withOrigin(rows, ['delta'], false);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id="deltaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="year"
          type="number"
          domain={[0, rows.length]}
          allowDecimals={false}
          {...AXIS}
        />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          formatter={currencyFormatter('Diferença')}
          labelFormatter={(y) => (y === 0 ? 'Hoje' : `Ano ${y}`)}
        />
        <ReferenceLine y={0} stroke="#94a3b8" />
        {breakEvenYear !== null && (
          <ReferenceLine
            x={breakEvenYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: `equilíbrio: ano ${breakEvenYear}`,
              fontSize: 11,
              fill: '#f59e0b',
            }}
          />
        )}
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="delta"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#deltaFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
