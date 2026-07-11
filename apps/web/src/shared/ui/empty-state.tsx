import Link from 'next/link';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-raised/50 px-6 py-10 text-center">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
