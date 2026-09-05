/**
 * Linear / logarithmic switch for the value axis.
 *
 * A logarithmic axis makes equal percentage changes equal distances, so the
 * early years stop being flattened against the baseline by later compounding
 * and the growth *rates* of the strategies become comparable by eye.
 */
export function ScaleToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const options: { label: string; log: boolean }[] = [
    { label: 'Linear', log: false },
    { label: 'Log', log: true },
  ];

  return (
    <div
      role="group"
      aria-label="Escala do eixo dos valores"
      className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
    >
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.log}
          onClick={() => onChange(o.log)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === o.log
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
