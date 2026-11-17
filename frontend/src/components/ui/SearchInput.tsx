import { Search, X } from 'lucide-react';
import { cn } from '@/utils/format';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className, ariaLabel }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-9 text-[13px] text-slate-800 placeholder:text-slate-400 transition-colors focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-100 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Effacer la recherche"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
