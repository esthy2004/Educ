import { cn, initials } from '@/utils/format';

const palettes = [
  'bg-royal-100 text-royal-800',
  'bg-slate-200 text-slate-700',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-teal-100 text-teal-800',
  'bg-sky-100 text-sky-800',
];

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({ firstName, lastName, size = 'md', className }: AvatarProps) {
  const seed = `${firstName}${lastName}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/5',
        palettes[seed % palettes.length],
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </span>
  );
}
