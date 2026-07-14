#!/usr/bin/env tsx
/**
 * End-to-end MVP demo: stylist onboarding → client hold → deposit → confirmed booking.
 * Requires API on :3001 and Postgres migrated. OTP is read from .local/last-otp.json (dev SMS).
 */
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:3001';
const OTP_FILE = path.resolve(process.cwd(), '.local/last-otp.json');
const suffix = Date.now().toString().slice(-5);
const stylistPhone = `+4477009${suffix}`;
const clientPhone = `+4477008${suffix}`;
const stylistEmail = `demo-${suffix}@example.com`;
const password = 'Password1';

type ApiEnvelope<T> = { data: T };

async function api<T>(method: string, route: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as ApiEnvelope<T> & { error?: { message: string } };
  if (!response.ok) {
    throw new Error(
      `${method} ${route} → ${response.status}: ${json.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json.data;
}

async function waitForOtp(phoneNumber: string, attempts = 20): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const raw = await readFile(OTP_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { phoneNumber: string; code: string };
      if (parsed.phoneNumber === phoneNumber) {
        return parsed.code;
      }
    } catch {
      // OTP file not written yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for OTP for ${phoneNumber}. Check API logs for [sms].`);
}

async function verifyPhone(phoneNumber: string): Promise<string> {
  const code = await waitForOtp(phoneNumber);
  const session = await api<{ tokens: { accessToken: string } }>(
    'POST',
    '/api/v1/auth/otp/verify',
    {
      phoneNumber,
      code,
      purpose: 'phone_verify',
    },
  );
  return session.tokens.accessToken;
}

function mockStripeSignature(body: string, secret = 'mock_webhook_secret'): string {
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return `mock_${digest}`;
}

async function sendStripeWebhook(event: {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  const body = JSON.stringify(event);
  const response = await fetch(`${API}/api/v1/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': mockStripeSignature(body),
    },
    body,
  });
  if (!response.ok) {
    const json = (await response.json()) as { error?: { message: string } };
    throw new Error(`Stripe webhook failed: ${json.error?.message ?? response.status}`);
  }
}

const DEFAULT_WORKING_HOURS = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: true, start: '10:00', end: '16:00' },
  sunday: { enabled: false, start: '10:00', end: '16:00' },
};

function availabilitySearchWindow(): { from: string; to: string } {
  const from = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function main(): Promise<void> {
  console.log('Project Braids — MVP demo\n');
  console.log(`API: ${API}\n`);

  const health = await fetch(`${API}/health/db`).then((r) => r.json());
  if (health.status !== 'ok') {
    throw new Error(
      `Database not connected (${health.error ?? 'unknown'}). Run: pnpm infra:up && pnpm db:migrate:deploy`,
    );
  }

  console.log('1. Register stylist…');
  await api('POST', '/api/v1/auth/register/stylist', {
    phoneNumber: stylistPhone,
    email: stylistEmail,
    password,
  });
  const stylistToken = await verifyPhone(stylistPhone);
  console.log(`   Stylist verified (${stylistEmail})`);

  console.log('2. Set up profile & service…');
  const me = await api<{ stylistId: string }>('GET', '/api/v1/auth/me', undefined, stylistToken);
  const stylistProfileId = me.stylistId;
  if (!stylistProfileId) {
    throw new Error('Stylist profile id missing after auth');
  }

  await api(
    'PATCH',
    '/api/v1/profile/me',
    {
      businessName: 'Demo Braids Studio',
      workingHours: DEFAULT_WORKING_HOURS,
      depositPolicy: { type: 'percent', value: 25 },
      onboardingStatus: 'complete',
    },
    stylistToken,
  );

  const offering = await api<{ id: string }>(
    'POST',
    '/api/v1/profile/services',
    {
      styleName: 'Knotless Braids',
      sizeTier: 'Medium',
      lengthTier: 'Waist-length',
      basePrice: 120,
      estimatedDurationMinutes: 240,
      hairIncluded: false,
    },
    stylistToken,
  );

  console.log('3. Stripe Connect (mock)…');
  const connect = await api<{ stripeAccountId: string }>(
    'POST',
    '/api/v1/payments/connect/onboard',
    undefined,
    stylistToken,
  );
  await sendStripeWebhook({
    id: `evt_${randomUUID().replace(/-/g, '')}`,
    type: 'account.updated',
    data: {
      object: {
        id: connect.stripeAccountId,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      },
    },
  });
  console.log(`   Connect account ready (${connect.stripeAccountId})`);

  console.log('4. Register client…');
  await api('POST', '/api/v1/auth/register/client', { phoneNumber: clientPhone });
  const clientToken = await verifyPhone(clientPhone);

  console.log('5. Check availability & create hold…');
  const { from, to } = availabilitySearchWindow();
  const availability = await api<{ slots: Array<{ startTime: string }> }>(
    'GET',
    `/api/v1/bookings/availability?stylistId=${stylistProfileId}&serviceOfferingId=${offering.id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=5`,
    undefined,
    clientToken,
  );
  const slot = availability.slots[0];
  if (!slot) {
    throw new Error('No availability slots returned — check working hours configuration.');
  }

  const booking = await api<{ id: string; depositAmount: string; status: string }>(
    'POST',
    '/api/v1/bookings/holds',
    {
      stylistId: stylistProfileId,
      serviceOfferingId: offering.id,
      startTime: slot.startTime,
      source: 'client_direct',
    },
    clientToken,
  );
  console.log(`   Hold created (${booking.id}) — deposit £${booking.depositAmount}`);

  console.log('6. Pay deposit (mock Stripe)…');
  const deposit = await api<{ stripePaymentIntentId: string }>(
    'POST',
    '/api/v1/payments/deposits',
    { bookingId: booking.id },
    clientToken,
  );
  await sendStripeWebhook({
    id: `evt_${randomUUID().replace(/-/g, '')}`,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: deposit.stripePaymentIntentId,
        metadata: { bookingId: booking.id },
      },
    },
  });

  const confirmed = await api<{ status: string; depositStatus: string }>(
    'GET',
    `/api/v1/bookings/${booking.id}`,
    undefined,
    stylistToken,
  );

  console.log('\n✓ MVP flow complete\n');
  console.log(`  Booking:  ${booking.id}`);
  console.log(`  Status:   ${confirmed.status}`);
  console.log(`  Deposit:  ${confirmed.depositStatus}`);
  console.log(`  Slot:     ${slot.startTime}`);
  console.log(`\nOpen http://localhost:3000 to see the web status panel.`);
}

main().catch((error: unknown) => {
  console.error('\nDemo failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
