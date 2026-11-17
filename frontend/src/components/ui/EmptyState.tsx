import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/utils/format';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-3' : 'py-10')}>
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-slate-50 text-slate-400">
        {icon ?? <Inbox size={18} />}
      </span>
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
