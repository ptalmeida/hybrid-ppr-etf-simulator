import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, gridProps, tooltipStyle } from './chartTheme';
import { formatCompactEur, formatEur } from '../../lib/format';
import { buildWaterfall, type WaterfallStep } from '../../lib/waterfall';
import type { ScenarioResult } from '../../lib/types';

export function TaxWaterfall({ scenario }: { scenario: ScenarioResult }) {
  // built in lib/ so it can be tested to land on the summary card's headline
  const data = buildWaterfall(scenario);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis
          dataKey="name"
          {...AXIS}
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgb(148 163 184 / 0.15)' }}
          formatter={(_value: unknown, _name: unknown, item: unknown) => {
            const bar = (item as { payload?: WaterfallStep })?.payload;
            return [bar ? formatEur(bar.amount) : '—', bar?.name ?? ''] as [
              string,
              string,
            ];
          }}
        />
        <Bar dataKey="range" radius={[3, 3, 3, 3]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.isTotal ? '#334155' : d.positive ? '#10b981' : '#f43f5e'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
