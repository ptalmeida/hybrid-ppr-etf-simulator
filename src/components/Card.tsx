import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
