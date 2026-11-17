import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/format';

type Tone = 'royal' | 'emerald' | 'amber' | 'violet' | 'rose' | 'teal';

const tones: Record<Tone, string> = {
  royal: 'border-royal-100 bg-royal-50 text-royal-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  violet: 'border-slate-200 bg-slate-50 text-slate-600',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
  teal: 'border-teal-100 bg-teal-50 text-teal-700',
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: Tone;
  trend?: { value: string; positive?: boolean };
}

export function StatCard({ label, value, hint, icon, tone = 'royal', trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-navy-900 tabular">
            {value}
          </p>
        </div>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', tones[tone])}>
          {icon}
        </span>
      </div>
      <div className="mt-2 flex min-h-[16px] flex-wrap items-center gap-1.5">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-semibold',
              trend.positive === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {trend.positive === false ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="truncate text-2xs text-slate-400">{hint}</span> : null}
      </div>
    </div>
  );
}
