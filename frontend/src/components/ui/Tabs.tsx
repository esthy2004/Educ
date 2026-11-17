import type { ReactNode } from 'react';
import { cn } from '@/utils/format';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors',
              active ? 'text-royal-700' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' ? (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-2xs font-semibold tabular',
                  active ? 'bg-royal-100 text-royal-700' : 'bg-slate-100 text-slate-500',
                )}
              >
                {item.count}
              </span>
            ) : null}
            {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-royal-600" /> : null}
          </button>
        );
      })}
    </div>
  );
}
