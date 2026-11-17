import type { ReactNode } from 'react';
import { cn } from '@/utils/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  data: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  compact?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle = 'Aucun résultat',
  emptyDescription = 'Aucune donnée ne correspond aux critères sélectionnés.',
  loading = false,
  onRowClick,
  footer,
  compact = false,
}: DataTableProps<T>) {
  return (
    <div className="relative">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <Loader2 className="animate-spin text-royal-600" size={20} />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8">
                  <EmptyState title={emptyTitle} description={emptyDescription} compact />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line/70 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-royal-50/40',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 text-[13px] text-slate-700',
                        compact ? 'py-2' : 'py-2.5',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right tabular',
                        column.className,
                      )}
                    >
                      {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-line px-3 py-2">{footer}</div> : null}
    </div>
  );
}
