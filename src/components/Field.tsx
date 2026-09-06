import type { ReactNode } from 'react';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  id: string;
}

const inputClass = 'control';

function Wrapper({
  label,
  hint,
  id,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-[0.8125rem] font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function NumberField({
  label,
  hint,
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: BaseProps & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          className={inputClass}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export function TextField({
  label,
  hint,
  id,
  value,
  onChange,
  maxLength,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <input
        id={id}
        type="text"
        className={inputClass}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrapper>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  id,
  value,
  onChange,
  options,
}: BaseProps & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <select
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function ToggleField({
  label,
  hint,
  id,
  value,
  onChange,
}: BaseProps & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <label
          htmlFor={id}
          className="block cursor-pointer text-[0.8125rem] font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        {hint && (
          <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
