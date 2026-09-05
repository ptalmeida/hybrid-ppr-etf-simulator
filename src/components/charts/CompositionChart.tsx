import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
import type { ScenarioResult, SimConfig } from '../../lib/types';

export function CompositionChart({
  hybrid,
  config,
}: {
  hybrid: ScenarioResult;
  config: SimConfig;
}) {
  const rows = hybrid.rows.map((r) => ({
    year: r.year,
    ppr: r.pprBalance,
    etf: r.etfBalance,
    mortgage: r.mortgagePaid,
  }));
  // stacked areas are always linear, so the origin can carry real zeros
  const data = withOrigin(rows, ['ppr', 'etf', 'mortgage'], false);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
          formatter={currencyFormatter('Valor')}
          labelFormatter={(y) => (y === 0 ? 'Hoje' : `Ano ${y}`)}
        />
        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="ppr"
          stackId="1"
          name={config.pprName}
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.55}
        />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="etf"
          stackId="1"
          name={config.etfName}
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.55}
        />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="mortgage"
          stackId="1"
          name="Prestações já pagas"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.35}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
