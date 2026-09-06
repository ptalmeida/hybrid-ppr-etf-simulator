import { useEffect, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { formatEur } from '../lib/format';

/**
 * Configuration on a phone.
 *
 * Stacking the panel above the results means scrolling past a long form to
 * reach the answer; stacking it below means the controls are invisible and
 * the page looks static. Neither works. A sticky bar keeps the headline
 * result and a way into the settings on screen at all times, and the sheet
 * covers the viewport so the form has room to breathe.
 *
 * Desktop keeps the sidebar, where both are visible at once and neither
 * problem exists.
 */
export function MobileConfigBar({
  delta,
  onOpen,
}: {
  delta: number;
  onOpen: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label">Híbrido vs. só ETF</p>
          <p
            className={`tnum text-base font-semibold ${
              delta >= 0
                ? 'text-brand-700 dark:text-brand-500'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {delta >= 0 ? '+' : '−'}
            {formatEur(Math.abs(delta))}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          <SlidersHorizontal size={15} />
          Configurar
        </button>
      </div>
    </div>
  );
}

export function MobileConfigSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  // A sheet that scrolls the page behind it is disorienting, and Escape is
  // what people reach for to dismiss an overlay.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Fechar definições"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Definições"
        className="absolute inset-x-0 bottom-0 top-10 flex flex-col rounded-t-xl border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Definições</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24">
          {children}
        </div>

        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}
