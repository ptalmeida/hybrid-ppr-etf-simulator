import { Check, Sparkles, TriangleAlert } from 'lucide-react';
import { SelectField } from './Field';
import { formatRate } from '../lib/format';
import { grossReturnFor, type EtfPreset, type PprPreset } from '../lib/presets';

const CUSTOM = '__custom__';

/**
 * Pick a real product instead of typing a fee schedule by hand.
 *
 * A preset sets the product's name and what it charges — facts published in
 * its KID. It deliberately does not set the expected return: that is a
 * forecast the user makes, and quietly filling in a short recent window as a
 * multi-decade assumption is exactly the error this simulator warns about.
 * The documented history is offered next to the picker, one click away, with
 * its window attached.
 */
export function PresetPicker<P extends EtfPreset | PprPreset>({
  id,
  label,
  presets,
  selected,
  currentReturn,
  onSelect,
  onUseHistory,
}: {
  id: string;
  label: string;
  presets: P[];
  selected: P | null;
  currentReturn: number;
  onSelect: (preset: P) => void;
  onUseHistory: (grossPct: number) => void;
}) {
  const options = [
    ...presets.map((p) => ({ value: p.id, label: p.label })),
    { value: CUSTOM, label: 'Personalizado' },
  ];

  const gross = selected ? grossReturnFor(selected) : null;
  const alreadyUsingHistory =
    gross !== null && Math.abs(currentReturn - gross) < 0.005;
  const usingExpected =
    selected !== null &&
    Math.abs(currentReturn - selected.expected.grossPct) < 0.005;

  return (
    <div className="space-y-2">
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
          selected ? (
            selected.description
          ) : (
            <>
              Alterou uma comissão ou um nome, por isso já não corresponde a
              nenhum produto da lista. Escolher um produto acima repõe os
              valores dele.
            </>
          )
        }
      />

      {selected && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            Expectativa de longo prazo:{' '}
            <strong className="tnum">
              {formatRate(selected.expected.grossPct)} ao ano
            </strong>{' '}
            bruto. É este o valor em uso.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {selected.expected.basis}
          </p>
          {!usingExpected && (
            <button
              type="button"
              onClick={() => onUseHistory(selected.expected.grossPct)}
              className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-400 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-white dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-slate-800"
            >
              <Sparkles size={13} /> Repor {formatRate(selected.expected.grossPct)}
            </button>
          )}
        </div>
      )}

      {selected?.history && gross !== null && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Só para referência — rendibilidade histórica:{' '}
            <strong className="tnum text-slate-800 dark:text-slate-200">
              {formatRate(selected.history.annualisedPct)} ao ano
            </strong>{' '}
            líquidos, {selected.history.window}.
          </p>

          {selected.history.years < 5 && (
            <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-500">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              <span>
                {selected.history.caution ??
                  'Menos de cinco anos de histórico — é uma amostra curta demais para projetar décadas.'}
              </span>
            </p>
          )}
          {selected.history.years >= 5 && selected.history.caution && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {selected.history.caution}
            </p>
          )}

          {selected.history.comparableEquity && (
            <p className="mt-1.5 rounded border-l-2 border-sky-400 bg-sky-50 py-1 pl-2 text-xs leading-relaxed text-slate-700 dark:bg-sky-950/40 dark:text-slate-300">
              No <strong>mesmo período</strong>, um ETF de ações globais (
              {selected.history.comparableEquity.label}) fez{' '}
              <strong className="tnum">
                {selected.history.comparableEquity.approximate ? '≈' : ''}
                {formatRate(selected.history.comparableEquity.annualisedPct)} ao
                ano
              </strong>
              {selected.history.comparableEquity.annualisedPct >
              selected.history.annualisedPct
                ? ' — mais do que este produto.'
                : ' — menos do que este produto.'}
            </p>
          )}

          <button
            type="button"
            onClick={() => onUseHistory(gross)}
            disabled={alreadyUsingHistory}
            className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {alreadyUsingHistory ? (
              <>
                <Check size={13} /> A usar esta rendibilidade
              </>
            ) : (
              <>
                <Sparkles size={13} /> Usar antes {formatRate(gross)} bruto
              </>
            )}
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {formatRate(gross)} é o valor <em>bruto</em> que, depois de
            descontadas as comissões anuais deste produto, devolve os{' '}
            {formatRate(selected.history.annualisedPct)} publicados. O passado
            não prevê o futuro.
          </p>
        </div>
      )}
    </div>
  );
}
