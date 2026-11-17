import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/format';
import { formatNumber } from '@/utils/format';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

function pageNumbers(current: number, count: number): Array<number | 'ellipsis'> {
  if (count <= 6) return Array.from({ length: count }, (_, index) => index + 1);
  const pages = new Set<number>([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) result.push('ellipsis');
    result.push(page);
  });
  return result;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-0.5">
      <div className="flex items-center gap-3 text-2xs text-slate-500">
        <span className="tabular">
          {formatNumber(from)}–{formatNumber(to)} sur {formatNumber(total)}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Lignes par page</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded border border-line bg-white px-1.5 py-1 text-2xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-royal-100"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Page précédente"
        >
          <ChevronLeft size={15} />
        </button>
        {pageNumbers(current, pageCount).map((entry, index) =>
          entry === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-2xs text-slate-400">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              className={cn(
                'h-7 min-w-7 rounded px-1.5 text-2xs font-medium transition',
                entry === current ? 'bg-royal-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {entry}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= pageCount}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Page suivante"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
