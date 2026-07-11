import { cn } from '@/shared/lib/cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4 shadow-card', className)}>
      {children}
    </div>
  );
}
