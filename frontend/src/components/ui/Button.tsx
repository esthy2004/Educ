import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/format';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-navy-900 text-white hover:bg-navy-800 focus-visible:ring-navy-400 disabled:bg-navy-700/50',
  secondary:
    'border border-line bg-white text-navy-800 hover:border-slate-300 hover:bg-royal-50 focus-visible:ring-royal-300 disabled:text-slate-400',
  outline:
    'border border-line bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-royal-300 disabled:text-slate-400',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-slate-300',
  danger:
    'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 focus-visible:ring-rose-300 disabled:bg-rose-50 disabled:text-rose-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400 disabled:bg-emerald-300',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9 gap-2 px-3.5 text-[13px]',
  lg: 'h-10 gap-2 px-4 text-sm',
  icon: 'h-9 w-9 justify-center',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
