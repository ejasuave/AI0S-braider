import Link from 'next/link';
import { Card } from '@/shared/ui/card';

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">Join Project Braids</h1>
        <p className="text-sm text-ink-muted">Choose how you want to use the platform.</p>
      </div>

      <div className="space-y-3">
        <Link href="/register/stylist">
          <Card className="transition-shadow hover:shadow-raised">
            <h2 className="font-display text-lg font-semibold text-ink">I&apos;m a stylist</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Set up your profile, services, and take bookings with deposits.
            </p>
          </Card>
        </Link>
        <Link href="/register/client">
          <Card className="transition-shadow hover:shadow-raised">
            <h2 className="font-display text-lg font-semibold text-ink">I&apos;m booking</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Book with your stylist and pay your deposit securely.
            </p>
          </Card>
        </Link>
      </div>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
