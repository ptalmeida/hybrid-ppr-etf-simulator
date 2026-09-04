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
import type { ScenarioResult } from '../../lib/types';

interface WaterfallBar {
  name: string;
  range: [number, number];
  amount: number;
  positive: boolean;
}

/**
 * A floating-bar waterfall. Each bar is [start, end] so Recharts draws it
 * suspended at the right height; `amount` carries the signed value shown
 * in the tooltip.
 */
function buildSteps(s: ScenarioResult): WaterfallBar[] {
  const steps = [
    { name: 'Carteira bruta', amount: s.final.grossValue },
    { name: 'Imposto ETF', amount: -s.final.etfTax },
    {
      name: 'Imposto PPR',
      amount: -(s.final.pprTax + s.final.pprTaxDuringRedemptions),
    },
    { name: 'Prestações pagas', amount: s.final.mortgagePaidTotal },
    { name: 'Benefício IRS', amount: s.final.irsBenefitTotal },
  ].filter((step, i) => i === 0 || Math.abs(step.amount) > 0.005);

  let running = 0;
  const bars: WaterfallBar[] = steps.map((step) => {
    const start = running;
    running += step.amount;
    return {
      name: step.name,
      range: [Math.min(start, running), Math.max(start, running)],
      amount: step.amount,
      positive: step.amount >= 0,
    };
  });

  bars.push({
    name: 'Total',
    range: [0, running],
    amount: running,
    positive: true,
  });

  return bars;
}

export function TaxWaterfall({ scenario }: { scenario: ScenarioResult }) {
  const data = buildSteps(scenario);

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
            const bar = (item as { payload?: WaterfallBar })?.payload;
            return [bar ? formatEur(bar.amount) : '—', bar?.name ?? ''] as [
              string,
              string,
            ];
          }}
        />
        <Bar dataKey="range" radius={[3, 3, 3, 3]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.name === 'Total' ? '#334155' : d.positive ? '#10b981' : '#f43f5e'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
