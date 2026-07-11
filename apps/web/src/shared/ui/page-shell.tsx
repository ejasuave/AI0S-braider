import Link from 'next/link';
import { cn } from '@/shared/lib/cn';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="space-y-1">
      {backHref ? (
        <Link href={backHref} className={TOUCH_LINK_CLASS}>
          ← Back
        </Link>
      ) : null}
      <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">{title}</h1>
      {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
    </header>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto min-h-screen w-full max-w-lg px-4 pt-6 md:max-w-2xl',
        'pb-[calc(6rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{children}</h2>
  );
}
