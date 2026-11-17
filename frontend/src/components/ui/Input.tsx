import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/format';

const baseField =
  'w-full rounded-md border bg-white px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
const stateClasses = (invalid?: boolean) =>
  invalid
    ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
    : 'border-line focus:border-royal-400 focus:ring-royal-100';

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
          {label}
          {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, fieldClassName, id, required, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <Field label={label} htmlFor={inputId} required={required} error={error} hint={hint} className={fieldClassName}>
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          className={cn(baseField, stateClasses(Boolean(error)), 'h-9', Boolean(leftIcon) && 'pl-9', className)}
          {...props}
        />
      </div>
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, fieldClassName, id, required, children, ...props },
  ref,
) {
  const selectId = id ?? props.name;
  return (
    <Field label={label} htmlFor={selectId} required={required} error={error} hint={hint} className={fieldClassName}>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(baseField, stateClasses(Boolean(error)), 'h-9 pr-8', className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, fieldClassName, id, required, ...props },
  ref,
) {
  const textareaId = id ?? props.name;
  return (
    <Field label={label} htmlFor={textareaId} required={required} error={error} hint={hint} className={fieldClassName}>
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(baseField, stateClasses(Boolean(error)), 'min-h-[88px] py-2', className)}
        {...props}
      />
    </Field>
  );
});
