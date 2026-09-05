import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatEur, formatPct } from '../lib/format';
import type { ScenarioResult } from '../lib/types';

const ACCENTS: Record<string, string> = {
  etf: 'border-t-sky-500',
  hybrid: 'border-t-emerald-500',
  ppr: 'border-t-violet-500',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="tnum font-medium text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function SummaryCards({ scenarios }: { scenarios: ScenarioResult[] }) {
  const baseline = scenarios.find((s) => s.id === 'etf')!;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((s) => {
        // compared on total value created: the scenarios deliver value through
        // different channels, so portfolio alone is not a fair basis
        const delta = s.final.netWithBenefits - baseline.final.netWithBenefits;
        const isBaseline = s.id === 'etf';
        const hasOtherChannels =
          Math.abs(s.final.netWithBenefits - s.final.netValue) > 0.5;
        const totalTax =
          s.final.etfTax + s.final.pprTax + s.final.pprTaxDuringRedemptions;

        return (
          <article
            key={s.id}
            className={`rounded-xl border border-t-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${ACCENTS[s.id]}`}
          >
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {s.label}
            </h3>

            <p className="tnum mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              {formatEur(s.final.netWithBenefits)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              valor total criado, líquido de imposto
            </p>

            {!isBaseline && (
              <p
                className={`tnum mt-3 flex items-center gap-1.5 text-sm font-semibold ${
                  delta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                {delta >= 0 ? '+' : '−'}
                {formatEur(Math.abs(delta))} face a {baseline.label}
              </p>
            )}

            {s.final.penalisedExit && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                Resgate <strong>fora das condições legais</strong>: sem crédito
                habitação e ainda sem 60 anos no fim do horizonte. Paga 21,5% /
                17,2% / 8,6% conforme o prazo e devolve{' '}
                {formatEur(s.final.benefitClawback)} de benefícios majorados.
              </p>
            )}

            <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 dark:border-slate-800">
              {hasOtherChannels && (
                <Row label="Só a carteira" value={formatEur(s.final.netValue)} />
              )}
              <Row label="Imposto total" value={formatEur(totalTax)} />
              <Row
                label="Taxa efetiva sobre ganhos"
                value={formatPct(s.final.effectiveTaxRate)}
              />
              {s.final.irsBenefitTotal > 0 && (
                <Row
                  label="Benefício de IRS acumulado"
                  value={formatEur(s.final.irsBenefitTotal)}
                />
              )}
            </div>

            {/* The cash-flow block exists to prove the comparison is fair: the
                same mortgage is owed in every scenario, and the bottom line
                matches whenever the freed salary is reinvested. */}
            <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Sai do seu bolso
              </p>
              <Row
                label="Investido"
                value={formatEur(s.final.totalContributed)}
              />
              {s.final.mortgageDueTotal > 0 && (
                <>
                  <Row
                    label="Prestações do salário"
                    value={formatEur(s.final.mortgagePaidFromSalary)}
                  />
                  {s.final.mortgagePaidTotal > 0 && (
                    <Row
                      label="Prestações pagas pelo PPR"
                      value={formatEur(s.final.mortgagePaidTotal)}
                    />
                  )}
                  {s.final.freedSalaryReinvested > 0 && (
                    <Row
                      label="Folga do salário reinvestida"
                      value={formatEur(s.final.freedSalaryReinvested)}
                    />
                  )}
                </>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1.5 text-sm dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Total
                </span>
                <span className="tnum font-semibold text-slate-900 dark:text-slate-100">
                  {formatEur(s.final.totalOutOfPocket)}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
