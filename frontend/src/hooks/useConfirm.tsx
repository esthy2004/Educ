import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((nextOptions) => {
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-950/50 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <div className="w-full max-w-md animate-slide-up rounded-lg border border-line bg-white p-5 shadow-pop">
            <div className="flex items-start gap-3">
              <span
                className={
                  options.danger
                    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-700'
                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700'
                }
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-navy-900">{options.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{options.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Annuler'}
              </Button>
              <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {options.confirmLabel ?? 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm doit être utilisé dans ConfirmProvider.');
  return context;
}
