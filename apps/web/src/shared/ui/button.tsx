import { cn } from '@/shared/lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
};

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover shadow-sm disabled:bg-primary/50',
  secondary:
    'bg-surface text-ink border border-border hover:bg-surface-raised active:bg-surface-raised disabled:opacity-50',
  ghost:
    'bg-transparent text-ink hover:bg-surface-raised active:bg-surface-raised disabled:opacity-50',
  danger: 'bg-error text-white hover:bg-error/90 active:bg-error/90 disabled:opacity-50',
};

export function Button({
  className,
  variant = 'primary',
  fullWidth,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
