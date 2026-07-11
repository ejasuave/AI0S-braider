'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-context';
import { getApiErrorMessage } from '@/shared/lib/api-client';
import { formatPhoneHint, isValidE164Phone, normalizePhoneNumber } from '@/shared/lib/phone';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';

export default function RegisterStylistPage() {
  const auth = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!isValidE164Phone(normalizedPhone)) {
      setError(`Enter a valid UK mobile number. ${formatPhoneHint()}`);
      setLoading(false);
      return;
    }

    try {
      await auth.registerStylist({
        phoneNumber: normalizedPhone,
        email: email.trim(),
        password,
      });
      window.location.assign('/verify');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create account'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          ← Back
        </Link>
        <h1 className="font-display text-3xl font-semibold text-ink">Stylist account</h1>
        <p className="text-sm text-ink-muted">We&apos;ll verify your phone by SMS.</p>
        {process.env.NODE_ENV !== 'production' ? (
          <p className="text-xs text-ai">
            Local dev: codes are not sent by SMS — you&apos;ll see your code on the next screen.
          </p>
        ) : null}
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            hint={formatPhoneHint()}
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters with a letter and number"
            required
          />
          {error ? <FormError message={error} /> : null}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating account…' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
