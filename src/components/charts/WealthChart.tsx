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
  withOrigin,
} from './chartTheme';
import { formatCompactEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

export function WealthChart({
  scenarios,
  mortgageStartYear,
  mortgageEndYear,
  yearAt60,
  logScale,
}: {
  scenarios: ScenarioResult[];
  mortgageStartYear: number | null;
  mortgageEndYear: number | null;
  yearAt60: number | null;
  logScale: boolean;
}) {
  const rows = scenarios[0].rows.map((row, i) => {
    const point: Record<string, number> = { year: row.year };
    // total value created, matching the summary cards and the delta chart
    for (const s of scenarios) point[s.id] = s.rows[i].netWithBenefits;
    return point;
  });

  const data = withOrigin(
    rows,
    scenarios.map((s) => s.id),
    logScale,
  );

  const yAxis = logAxis(
    scenarios.flatMap((s) => s.rows.map((r) => r.netWithBenefits)),
    logScale,
  );

  const lastYear = rows.length;
  const inRange = (y: number | null): y is number =>
    y !== null && y >= 1 && y <= lastYear;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="year"
          type="number"
          domain={[0, lastYear]}
          allowDecimals={false}
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
          labelFormatter={(y) => (y === 0 ? 'Hoje' : `Ano ${y}`)}
        />
        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />

        {inRange(mortgageStartYear) && (
          <ReferenceLine
            x={mortgageStartYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: 'início do crédito',
              fontSize: 11,
              fill: '#f59e0b',
              position: 'insideTopLeft',
            }}
          />
        )}
        {inRange(mortgageEndYear) && (
          <ReferenceLine
            x={mortgageEndYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: 'fim do crédito',
              fontSize: 11,
              fill: '#f59e0b',
              position: 'insideTopRight',
            }}
          />
        )}
        {inRange(yearAt60) && (
          <ReferenceLine
            x={yearAt60}
            stroke="#8b5cf6"
            strokeDasharray="2 4"
            label={{
              value: '60 anos',
              fontSize: 11,
              fill: '#8b5cf6',
              position: 'insideBottomRight',
            }}
          />
        )}

        {scenarios.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={SERIES_COLORS[s.id]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
