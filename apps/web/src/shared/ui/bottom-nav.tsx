'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Calendar, CreditCard, Home, Menu, MessageSquare, Search } from 'lucide-react';
import { useEscalationCount } from '@/features/dashboard/use-escalation-count';
import { cn } from '@/shared/lib/cn';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
};

/** Five primary tabs per visual-identity-and-ux.md — avoids overcrowding at 375px. */
const stylistItems: NavItem[] = [
  { href: '/stylist', label: 'Home', icon: Home },
  { href: '/stylist/bookings', label: 'Calendar', icon: Calendar },
  { href: '/stylist/inbox', label: 'Inbox', icon: MessageSquare, badge: true },
  { href: '/stylist/payments', label: 'Pay', icon: CreditCard },
  { href: '/stylist/more', label: 'More', icon: Menu },
];

const clientItems: NavItem[] = [
  { href: '/client', label: 'Home', icon: Home },
  { href: '/client/bookings', label: 'Bookings', icon: Calendar },
  { href: '/directory', label: 'Find', icon: Search },
];

export function BottomNav({ role }: { role: 'stylist' | 'client' }) {
  const pathname = usePathname();
  const items = role === 'stylist' ? stylistItems : clientItems;
  const escalationCountQuery = useEscalationCount();
  const escalationCount = role === 'stylist' ? (escalationCountQuery.data ?? 0) : 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5 md:max-w-2xl">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === '/stylist/more' &&
              (pathname.startsWith('/stylist/services') ||
                pathname.startsWith('/stylist/profile')));

          const showBadge = Boolean(badge) && escalationCount > 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-xs font-medium',
                active ? 'text-primary' : 'text-ink-muted active:text-ink',
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {showBadge ? (
                  <span
                    className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-white"
                    aria-label={`${escalationCount} conversations need reply`}
                  >
                    {escalationCount > 9 ? '9+' : escalationCount}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
