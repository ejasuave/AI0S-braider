import { cn } from '@/shared/lib/cn';

const toneStyles = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  neutral: 'bg-surface-raised text-ink-muted',
  ai: 'bg-ai/10 text-ai',
};

const dotStyles = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-ink-muted',
  ai: 'bg-ai',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: keyof typeof toneStyles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneStyles[tone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[tone])} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
