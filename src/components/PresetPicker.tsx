import { RotateCcw, TriangleAlert } from 'lucide-react';
import { NumberField, SelectField } from './Field';
import { formatRate } from '../lib/format';
import { grossReturnFor, type EtfPreset, type PprPreset } from '../lib/presets';

const CUSTOM = '__custom__';

/**
 * Pick a real product, then set what you expect it to return.
 *
 * A preset sets the product's name and what it charges — facts published in
 * its KID — plus a long-run expectation derived from its asset mix. The return
 * input sits right here rather than in another card, because disagreeing with
 * the estimate is the single most likely thing a reader wants to do, and
 * making them hunt for the field buries it.
 *
 * The trailing figure is kept, collapsed, as reference only. It is not a
 * forecast and giving it equal visual weight invites the exact mistake this
 * simulator warns about.
 */
export function PresetPicker<P extends EtfPreset | PprPreset>({
  id,
  label,
  presets,
  selected,
  currentReturn,
  returnBounds,
  onSelect,
  onReturnChange,
}: {
  id: string;
  label: string;
  presets: P[];
  selected: P | null;
  currentReturn: number;
  returnBounds: [number, number];
  onSelect: (preset: P) => void;
  onReturnChange: (pct: number) => void;
}) {
  const options = [
    ...presets.map((p) => ({ value: p.id, label: p.label })),
    { value: CUSTOM, label: 'Personalizado' },
  ];

  const history = selected?.history;
  const historyGross = selected ? grossReturnFor(selected) : null;
  const expected = selected?.expected.grossPct ?? null;
  const usingExpected =
    expected !== null && Math.abs(currentReturn - expected) < 0.005;

  return (
    <div className="space-y-3">
      <SelectField
        id={id}
        label={label}
        value={selected?.id ?? CUSTOM}
        onChange={(value) => {
          const next = presets.find((p) => p.id === value);
          if (next) onSelect(next);
        }}
        options={options}
        hint={
          selected
            ? selected.description
            : 'Alterou uma comissão ou um nome, por isso já não corresponde a nenhum produto da lista. Escolher um produto acima repõe os valores dele.'
        }
      />

      <NumberField
        id={`${id}Return`}
        label="Rendibilidade bruta esperada"
        suffix="% / ano"
        step={0.1}
        min={returnBounds[0]}
        max={returnBounds[1]}
        value={currentReturn}
        onChange={onReturnChange}
        hint={
          expected === null ? (
            'Antes de comissões e impostos.'
          ) : usingExpected ? (
            <>
              A usar a estimativa de longo prazo deste produto. Se discorda,
              escreva o seu próprio valor.
            </>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>
                O seu valor. A estimativa para este produto é{' '}
                {formatRate(expected)}.
              </span>
              <button
                type="button"
                onClick={() => onReturnChange(expected)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw size={11} /> repor
              </button>
            </span>
          )
        }
      />

      {selected && (
        <details className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-400">
            De onde vem {formatRate(selected.expected.grossPct)}
          </summary>

          <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            {selected.expected.basis}
          </p>

          {history && historyGross !== null && (
            <>
              <p className="mt-2 leading-relaxed text-slate-500 dark:text-slate-400">
                Rendibilidade histórica, só para referência:{' '}
                <strong className="tnum">
                  {formatRate(history.annualisedPct)} ao ano
                </strong>{' '}
                líquidos, {history.window}. O passado não prevê o futuro.
              </p>

              {history.comparableEquity && (
                <p className="mt-1.5 border-l-2 border-sky-400 pl-2 leading-relaxed text-slate-600 dark:text-slate-300">
                  No <strong>mesmo período</strong>, um ETF de ações globais (
                  {history.comparableEquity.label}) fez{' '}
                  <strong className="tnum">
                    {history.comparableEquity.approximate ? '≈' : ''}
                    {formatRate(history.comparableEquity.annualisedPct)} ao ano
                  </strong>
                  {history.comparableEquity.annualisedPct >
                  history.annualisedPct
                    ? ' — mais do que este produto.'
                    : ' — menos do que este produto.'}
                </p>
              )}

              {history.years < 5 && (
                <p className="mt-1.5 flex gap-1.5 leading-relaxed text-amber-700 dark:text-amber-500">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  <span>
                    {history.caution ??
                      'Menos de cinco anos de histórico — amostra curta demais para projetar décadas.'}
                  </span>
                </p>
              )}

              <button
                type="button"
                onClick={() => onReturnChange(historyGross)}
                className="mt-2 rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Usar antes {formatRate(historyGross)} bruto
              </button>
            </>
          )}
        </details>
      )}
    </div>
  );
}
