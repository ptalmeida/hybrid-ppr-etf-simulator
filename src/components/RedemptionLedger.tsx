import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCopy } from 'lucide-react';
import { formatEurPrecise } from '../lib/format';
import type { RedemptionEntry } from '../lib/types';

const HEADERS = [
  'Ano',
  'Idade',
  'Entrega de',
  'Antiguidade',
  'Resgatado',
  'Capital',
  'Lucro',
  'Imposto 8%',
  'Para a prestação',
  'Dedução obtida',
] as const;

function toCsv(entries: RedemptionEntry[]): string {
  const rows = entries.map((e) =>
    [
      e.year,
      e.age,
      e.entregaYear,
      e.ageYears,
      e.gross.toFixed(2),
      e.principal.toFixed(2),
      e.profit.toFixed(2),
      e.tax.toFixed(2),
      e.net.toFixed(2),
      e.benefitEarned.toFixed(2),
      e.clawback.toFixed(2),
    ].join(','),
  );
  return [[...HEADERS, 'Benefício devolvido'].join(','), ...rows].join('\n');
}

/**
 * Every redemption, row by row, so the headline numbers can be audited rather
 * than taken on trust. Each row shows the tranche's age, which is the test the
 * whole strategy turns on.
 */
export function RedemptionLedger({
  entries,
  pprName,
}: {
  entries: RedemptionEntry[];
  pprName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (entries.length === 0) return null;

  const totals = entries.reduce(
    (a, e) => ({
      gross: a.gross + e.gross,
      principal: a.principal + e.principal,
      profit: a.profit + e.profit,
      tax: a.tax + e.tax,
      net: a.net + e.net,
      benefitEarned: a.benefitEarned + e.benefitEarned,
      clawback: a.clawback + e.clawback,
    }),
    {
      gross: 0,
      principal: 0,
      profit: 0,
      tax: 0,
      net: 0,
      benefitEarned: 0,
      clawback: 0,
    },
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const num = 'tnum px-3 py-1.5 text-right whitespace-nowrap';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
          Extrato dos resgates
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {entries.length} {entries.length === 1 ? 'movimento' : 'movimentos'}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Cada linha é uma entrega ao {pprName} a ser resgatada para pagar
              prestações. A coluna «antiguidade» é o teste que decide tudo: só a
              partir dos 5 anos é que a dedução de IRS sobrevive ao resgate. O
              imposto incide apenas sobre o lucro, nunca sobre o capital. A
              «dedução obtida» é o que essa entrega rendeu no ano em que foi
              feita — desce com a idade (400 €, 350 € a partir dos 35, 300 €
              acima dos 50), mesmo quando o valor entregue se mantém.
            </p>
            <button
              type="button"
              onClick={copy}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ClipboardCopy size={14} />
              {copied ? 'CSV copiado' : 'Copiar CSV'}
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr>
                  {HEADERS.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-3 py-2 font-medium whitespace-nowrap text-slate-600 dark:text-slate-300 ${
                        i < 4 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={`${e.year}-${e.entregaYear}-${i}`}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="tnum px-3 py-1.5">{e.year}</td>
                    <td className="tnum px-3 py-1.5 text-slate-500 dark:text-slate-400">
                      {e.age}
                    </td>
                    <td className="tnum px-3 py-1.5">ano {e.entregaYear}</td>
                    <td
                      className={`tnum px-3 py-1.5 ${
                        e.ageYears < 5
                          ? 'font-semibold text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {e.ageYears} anos
                      {e.ageYears < 5 && ' ⚠'}
                    </td>
                    <td className={num}>{formatEurPrecise(e.gross)}</td>
                    <td className={`${num} text-slate-500 dark:text-slate-400`}>
                      {formatEurPrecise(e.principal)}
                    </td>
                    <td className={`${num} text-slate-500 dark:text-slate-400`}>
                      {formatEurPrecise(e.profit)}
                    </td>
                    <td className={`${num} text-rose-600 dark:text-rose-400`}>
                      −{formatEurPrecise(e.tax)}
                    </td>
                    <td className={`${num} font-medium`}>
                      {formatEurPrecise(e.net)}
                    </td>
                    <td className={`${num} text-emerald-700 dark:text-emerald-400`}>
                      {formatEurPrecise(e.benefitEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td className="px-3 py-2" colSpan={4}>
                    Total
                  </td>
                  <td className={num}>{formatEurPrecise(totals.gross)}</td>
                  <td className={num}>{formatEurPrecise(totals.principal)}</td>
                  <td className={num}>{formatEurPrecise(totals.profit)}</td>
                  <td className={`${num} text-rose-600 dark:text-rose-400`}>
                    −{formatEurPrecise(totals.tax)}
                  </td>
                  <td className={num}>{formatEurPrecise(totals.net)}</td>
                  <td className={`${num} text-emerald-700 dark:text-emerald-400`}>
                    {formatEurPrecise(totals.benefitEarned)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totals.clawback > 0 && (
            <p className="border-t border-slate-200 px-5 py-3 text-xs leading-relaxed text-rose-700 dark:border-slate-800 dark:text-rose-300">
              As linhas marcadas com ⚠ são entregas com menos de cinco anos.
              Resgatá-las devolveu {formatEurPrecise(totals.clawback)} de
              deduções de IRS, majoradas em 10% por cada ano (art. 21.º/4 do
              EBF).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
