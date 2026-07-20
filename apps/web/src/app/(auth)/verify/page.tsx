'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { getWebEnv } from '@/env';
import { isStagingWebSurface } from '@project-braids/shared-types/env';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { clearPostAuthNext, resolvePostAuthRedirect } from '@/shared/lib/auth-redirect';
import { getPendingOtp, type PendingOtp } from '@/shared/lib/auth-storage';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';

function shouldShowDevOtp(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return isStagingWebSurface(getWebEnv());
}

export default function VerifyOtpPage() {
  const auth = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingOtp | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const showDevOtp = shouldShowDevOtp();

  useEffect(() => {
    const stored = getPendingOtp();
    if (!stored) {
      router.replace('/register');
      return;
    }
    setPending(stored);
  }, [router]);

  useEffect(() => {
    if (!showDevOtp || !pending) return;

    async function fetchDevCode() {
      try {
        const result = await apiFetchData<{ code: string }>(
          `/auth/dev/last-otp?phoneNumber=${encodeURIComponent(pending!.phoneNumber)}`,
          { auth: false },
        );
        setDevCode(result.code);
      } catch {
        // OTP not written yet — registration may still be in flight.
      }
    }

    void fetchDevCode();
    const interval = setInterval(() => void fetchDevCode(), 2000);
    return () => clearInterval(interval);
  }, [pending, showDevOtp]);

  if (!pending) {
    return <div className="text-center text-sm text-ink-muted">Loading…</div>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setError(null);
    setLoading(true);
    try {
      await auth.verifyOtp({
        phoneNumber: pending.phoneNumber,
        code,
        purpose: pending.purpose,
      });
      const redirectTo =
        pending.role === 'client'
          ? resolvePostAuthRedirect('client')
          : resolvePostAuthRedirect('stylist');
      clearPostAuthNext();
      window.location.assign(redirectTo);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pending) return;
    setError(null);
    try {
      await apiFetchData('/auth/otp/request', {
        auth: false,
        method: 'POST',
        json: { phoneNumber: pending.phoneNumber, purpose: pending.purpose },
      });
      setResent(true);
      setDevCode(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resend code'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">Verify your phone</h1>
        <p className="text-sm text-ink-muted">Enter the 6-digit code for {pending.phoneNumber}.</p>
      </div>

      {showDevOtp ? (
        <Card className="space-y-2 border-ai/30 bg-ai/5">
          <p className="text-sm font-medium text-ink">Staging / local testing</p>
          <p className="text-sm text-ink-muted">
            SMS OTP is disabled here. Use the code below:
          </p>
          {devCode ? (
            <p className="font-mono text-2xl font-semibold tracking-widest text-ai">{devCode}</p>
          ) : (
            <p className="text-sm text-ink-muted">Waiting for code…</p>
          )}
        </Card>
      ) : null}

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error ? <FormError message={error} /> : null}
          {resent ? <p className="text-sm text-success">Code resent.</p> : null}
          <Button type="submit" fullWidth disabled={loading || code.length !== 6}>
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={handleResend}>
            Resend code
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-muted">
        {pending.role === 'client' ? (
          <>
            Wrong number?{' '}
            <Link href="/login/client" className="font-medium text-primary hover:underline">
              Try again
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Stylist sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
