import { formatEur, formatPct } from '../lib/format';
import type { ScenarioResult } from '../lib/types';

/**
 * The headline comparison, as a table rather than a row of cards.
 *
 * Cards forced one metric per box and pushed everything else off the screen.
 * A table puts every figure for both strategies in one glance and lets the eye
 * run across a row — which is how anyone actually compares two products, and
 * how every financial data tool presents this.
 */

interface Row {
  label: string;
  value: (s: ScenarioResult) => number;
  /** Rendered as a percentage rather than euros. */
  percent?: boolean;
  /** Larger type: the figure the whole page is about. */
  headline?: boolean;
  /** Skip when neither strategy has a non-zero value. */
  hideIfZero?: boolean;
  /** Skip when it would just repeat another row for both strategies. */
  hideIfSameAs?: (s: ScenarioResult) => number;
  note?: string;
}

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Resultado',
    rows: [
      {
        label: 'Valor total criado',
        value: (s) => s.final.netWithBenefits,
        headline: true,
      },
      {
        label: 'Só a carteira',
        value: (s) => s.final.netValue,
        // identical to the headline whenever everything is reinvested, and a
        // row that repeats the one above it is noise
        hideIfSameAs: (s) => s.final.netWithBenefits,
        note: 'sem contar prestações pagas nem benefícios em mão',
      },
    ],
  },
  {
    title: 'O que ficou pelo caminho',
    rows: [
      {
        label: 'Imposto total',
        value: (s) =>
          s.final.etfTax + s.final.pprTax + s.final.pprTaxDuringRedemptions,
      },
      {
        label: 'Comissões pagas',
        value: (s) => s.final.feesPaid,
        hideIfZero: true,
      },
      {
        label: 'Devolução de benefícios',
        value: (s) => s.final.benefitClawback,
        hideIfZero: true,
      },
      {
        label: 'Taxa efetiva sobre ganhos',
        value: (s) => s.final.effectiveTaxRate,
        percent: true,
      },
    ],
  },
  {
    title: 'O que o PPR trouxe',
    rows: [
      {
        label: 'Benefício de IRS',
        value: (s) => s.final.irsBenefitTotal,
        hideIfZero: true,
      },
      {
        label: 'Prestações pagas pelo PPR',
        value: (s) => s.final.mortgagePaidTotal,
        hideIfZero: true,
      },
    ],
  },
  {
    title: 'Sai do seu bolso',
    rows: [
      { label: 'Investido', value: (s) => s.final.totalContributed },
      {
        label: 'Prestações do salário',
        value: (s) => s.final.mortgagePaidFromSalary,
        hideIfZero: true,
      },
      {
        label: 'Folga do salário reinvestida',
        value: (s) => s.final.freedSalaryReinvested,
        hideIfZero: true,
      },
      {
        label: 'Total',
        value: (s) => s.final.totalOutOfPocket,
        note: 'igual nos dois quando a folga é reinvestida — é o que torna a comparação justa',
      },
    ],
  },
];

export function ComparisonTable({
  scenarios,
}: {
  scenarios: ScenarioResult[];
}) {
  const [etf, hybrid] = scenarios;
  const delta = hybrid.final.netWithBenefits - etf.final.netWithBenefits;

  const cell = 'px-3 py-2 text-right tnum whitespace-nowrap';

  return (
    <div className="surface overflow-hidden rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="label px-3 py-2.5 text-left font-medium">
                Estratégia
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                {etf.label}
              </th>
              <th className="border-l-2 border-brand-500 px-3 py-2.5 text-right text-xs font-semibold text-slate-900 dark:text-slate-100">
                {hybrid.label}
              </th>
            </tr>
          </thead>

          <tbody>
            {SECTIONS.map((section) => {
              const rows = section.rows.filter((r) => {
                if (
                  r.hideIfZero &&
                  Math.abs(r.value(etf)) <= 0.5 &&
                  Math.abs(r.value(hybrid)) <= 0.5
                ) {
                  return false;
                }
                if (
                  r.hideIfSameAs &&
                  Math.abs(r.value(etf) - r.hideIfSameAs(etf)) <= 0.5 &&
                  Math.abs(r.value(hybrid) - r.hideIfSameAs(hybrid)) <= 0.5
                ) {
                  return false;
                }
                return true;
              });
              if (rows.length === 0) return null;

              return (
                <SectionRows
                  key={section.title}
                  title={section.title}
                  rows={rows}
                  etf={etf}
                  hybrid={hybrid}
                  delta={delta}
                  cell={cell}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  title,
  rows,
  etf,
  hybrid,
  delta,
  cell,
}: {
  title: string;
  rows: Row[];
  etf: ScenarioResult;
  hybrid: ScenarioResult;
  delta: number;
  cell: string;
}) {
  return (
    <>
      <tr className="bg-slate-50 dark:bg-slate-800/40">
        <td
          colSpan={3}
          className="label border-y border-slate-200 px-3 py-1.5 dark:border-slate-800"
        >
          {title}
        </td>
      </tr>

      {rows.map((r) => {
        const a = r.value(etf);
        const b = r.value(hybrid);
        const fmt = (n: number) => (r.percent ? formatPct(n) : formatEur(n));

        return (
          <tr
            key={r.label}
            className="row-hover border-b border-slate-100 last:border-0 dark:border-slate-800/60"
          >
            <td className="px-3 py-2">
              <span
                className={
                  r.headline
                    ? 'font-medium text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }
              >
                {r.label}
              </span>
              {r.note && (
                <span className="mt-0.5 block text-xs leading-snug text-slate-400 dark:text-slate-500">
                  {r.note}
                </span>
              )}
            </td>

            <td
              className={`${cell} ${
                r.headline
                  ? 'text-lg font-semibold text-slate-900 dark:text-slate-50'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {fmt(a)}
            </td>

            <td
              className={`${cell} border-l-2 border-brand-500 ${
                r.headline
                  ? 'text-lg font-semibold text-slate-900 dark:text-slate-50'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {fmt(b)}
              {r.headline && (
                <span
                  className={`mt-0.5 block text-xs font-medium ${
                    delta >= 0
                      ? 'text-brand-700 dark:text-brand-500'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {delta >= 0 ? '+' : '−'}
                  {formatEur(Math.abs(delta))}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
