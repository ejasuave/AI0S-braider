import { cn } from '@/shared/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-surface-raised', className)} aria-hidden />
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
