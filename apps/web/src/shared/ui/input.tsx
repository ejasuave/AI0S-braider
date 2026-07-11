import { cn } from '@/shared/lib/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ className, label, hint, error, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-ink">{label}</span> : null}
      <input
        id={inputId}
        className={cn(
          'min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted/70',
          error && 'border-error',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-sm text-error">{error}</span> : null}
      {hint && !error ? <span className="text-sm text-ink-muted">{hint}</span> : null}
    </label>
  );
}
