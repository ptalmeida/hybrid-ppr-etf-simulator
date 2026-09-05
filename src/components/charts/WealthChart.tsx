import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS,
  SERIES_COLORS,
  currencyFormatter,
  gridProps,
  logAxis,
  tooltipStyle,
} from './chartTheme';
import { formatCompactEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

export function WealthChart({
  scenarios,
  mortgageStartYear,
  logScale,
}: {
  scenarios: ScenarioResult[];
  mortgageStartYear: number;
  logScale: boolean;
}) {
  const data = scenarios[0].rows.map((row, i) => {
    const point: Record<string, number> = { year: row.year };
    // total value created, matching the summary cards and the delta chart
    for (const s of scenarios) point[s.id] = s.rows[i].netWithBenefits;
    return point;
  });

  const yAxis = logAxis(
    scenarios.flatMap((s) => s.rows.map((r) => r.netWithBenefits)),
    logScale,
  );

  const showMortgageLine =
    mortgageStartYear >= 1 && mortgageStartYear <= data.length;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="year"
          {...AXIS}
          label={{
            value: 'Ano',
            position: 'insideBottom',
            offset: -4,
            fontSize: 12,
          }}
        />
        <YAxis
          {...AXIS}
          tickFormatter={formatCompactEur}
          width={70}
          scale={yAxis.scale}
          domain={yAxis.domain}
          ticks={yAxis.ticks}
          allowDataOverflow={yAxis.applied}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={currencyFormatter('Valor')}
          labelFormatter={(y) => `Ano ${y}`}
        />
        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
        {showMortgageLine && (
          <ReferenceLine
            x={mortgageStartYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: 'início do crédito',
              fontSize: 11,
              fill: '#f59e0b',
            }}
          />
        )}
        {scenarios.map((s) => (
          <Line
            isAnimationActive={false}
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={SERIES_COLORS[s.id]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
