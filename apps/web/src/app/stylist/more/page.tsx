'use client';

import Link from 'next/link';
import { Calendar, Image, Scissors, Shield, User, Users } from 'lucide-react';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

const moreLinks = [
  {
    href: '/stylist/services',
    label: 'Services',
    description: 'Structured styles and pricing',
    icon: Scissors,
  },
  {
    href: '/stylist/portfolio',
    label: 'Portfolio',
    description: 'Upload and manage your work',
    icon: Image,
  },
  {
    href: '/stylist/hours',
    label: 'Working hours',
    description: 'Weekly schedule',
    icon: Calendar,
  },
  {
    href: '/stylist/policy',
    label: 'Policies',
    description: 'Deposit and cancellation rules',
    icon: Shield,
  },
  {
    href: '/stylist/profile',
    label: 'Profile',
    description: 'Business details and onboarding',
    icon: User,
  },
  {
    href: '/stylist/staff',
    label: 'Team',
    description: 'Invite staff and manage permissions',
    icon: Users,
  },
] as const;

export default function StylistMorePage() {
  return (
    <PageShell>
      <PageHeader title="More" subtitle="Services, profile, and account settings." />

      <div className="mt-6 space-y-3">
        {moreLinks.map(({ href, label, description, icon: Icon }) => (
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
