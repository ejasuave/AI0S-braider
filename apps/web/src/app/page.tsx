import Link from 'next/link';
import { getWebEnv } from '@/env';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

export default function HomePage() {
  const env = getWebEnv();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12 md:max-w-2xl">
      <div className="space-y-8">
        <header className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-ai">
            Your business finally has a front desk
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink md:text-5xl">
            {env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME}
          </h1>
          <p className="text-lg text-ink-muted">
            AI receptionist and operating system for independent UK hair braiders and stylists.
          </p>
        </header>

        <div className="space-y-3">
          <Link href="/register/stylist">
            <Card className="transition-shadow hover:shadow-raised">
              <h2 className="font-display text-xl font-semibold text-ink">I&apos;m a stylist</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Set up your profile, services, and Stripe deposits. Run your chair from your phone.
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">
                Get started →
              </span>
            </Card>
          </Link>

          <Link href="/login">
            <Card className="transition-shadow hover:shadow-raised">
              <h2 className="font-display text-xl font-semibold text-ink">Stylist sign in</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Email and password for your stylist dashboard.
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">
                Sign in →
              </span>
            </Card>
          </Link>
        </div>

        <Card className="space-y-3 bg-surface-raised">
          <h3 className="font-medium text-ink">Booking as a client?</h3>
          <p className="text-sm text-ink-muted">
            Browse the beta directory or use the direct link your stylist shares.
          </p>
          <Link href="/directory">
            <Button fullWidth>Find a braider</Button>
          </Link>
          <Link href="/register/client">
            <Button variant="secondary" fullWidth>
              Create client account
            </Button>
          </Link>
          <Link href="/login/client">
            <Button variant="ghost" fullWidth>
              Client sign in
            </Button>
          </Link>
        </Card>

        <p className="text-center text-xs text-ink-muted">
          API status available at{' '}
          <Link href="/status" className="text-primary hover:underline">
            /status
          </Link>
        </p>
      </div>
    </main>
  );
}
