'use client';

import Link from 'next/link';
import { Calendar, Image, MessageSquare, Scissors, Shield, Star, User, Users } from 'lucide-react';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { useStylistPermissions } from '@/features/dashboard/use-stylist-permissions';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import type { BusinessStaffPermissions } from '@project-braids/shared-types/api';

type MoreLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Calendar;
  permission?: keyof BusinessStaffPermissions;
};

const moreLinks: MoreLink[] = [
  {
    href: '/stylist/services',
    label: 'Services',
    description: 'Structured styles and pricing',
    icon: Scissors,
    permission: 'can_manage_pricing',
  },
  {
    href: '/stylist/portfolio',
    label: 'Portfolio',
    description: 'Upload and manage your work',
    icon: Image,
    permission: 'can_manage_profile',
  },
  {
    href: '/stylist/calendar',
    label: 'Calendar',
    description: 'Google sync, buffer time, conflicts',
    icon: Calendar,
    permission: 'can_manage_bookings',
  },
  {
    href: '/stylist/hours',
    label: 'Working hours',
    description: 'Weekly schedule',
    icon: Calendar,
    permission: 'can_manage_bookings',
  },
  {
    href: '/stylist/policy',
    label: 'Policies',
    description: 'Deposit and cancellation rules',
    icon: Shield,
    permission: 'can_manage_profile',
  },
  {
    href: '/stylist/profile',
    label: 'Profile',
    description: 'Business details, directory listing, onboarding',
    icon: User,
    permission: 'can_manage_profile',
  },
  {
    href: '/stylist/reviews',
    label: 'Reviews',
    description: 'Client feedback after appointments',
    icon: Star,
  },
  {
    href: '/stylist/staff',
    label: 'Team',
    description: 'Invite staff and manage permissions',
    icon: Users,
    permission: 'can_manage_staff',
  },
  {
    href: '/stylist/inbox',
    label: 'Inbox',
    description: 'Escalated SMS conversations',
    icon: MessageSquare,
  },
];

export default function StylistMorePage() {
  const permissions = useStylistPermissions();
  const visibleLinks = moreLinks.filter((link) => !link.permission || permissions[link.permission]);

  return (
    <PageShell>
      <PageHeader title="More" subtitle="Services, profile, and account settings." />

      <div className="mt-6 space-y-3">
        {visibleLinks.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="block active:opacity-90">
            <Card className="flex min-h-14 items-center gap-4">
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{label}</p>
                <p className="text-sm text-ink-muted">{description}</p>
              </div>
            </Card>
          </Link>
        ))}

        <Card className="space-y-3 pt-2">
          <SignOutButton />
          <Link href="/stylist" className={TOUCH_LINK_CLASS}>
            ← Back to home
          </Link>
        </Card>
      </div>
    </PageShell>
  );
}
