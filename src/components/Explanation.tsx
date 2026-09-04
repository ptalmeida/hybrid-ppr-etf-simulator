import type { ExplanationStep } from '../lib/explain';

export function Explanation({ steps }: { steps: ExplanationStep[] }) {
  return (
    <ol className="space-y-5">
      {steps.map((step) => (
        <li key={step.title} className="border-l-2 border-emerald-500 pl-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {step.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
