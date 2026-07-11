import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { MockClaudeProvider, setClaudeProvider } from '../../lib/claude/index.js';
import { prisma } from '../../lib/db.js';
import {
  clearLastDevOtp,
  getLastDevOtp,
  setLastDevOtpForTests,
  setSmsProvider,
} from '../../lib/sms/sms-provider.js';
import type { SmsProvider } from '../../lib/sms/sms-provider.types.js';

const stylistCreds = {
  phoneNumber: '+447700900301',
  email: 'stylist.ch11@example.com',
  password: 'Password1',
};

const clientPhone = '+447700900302';
const bookingNumber = '+447700900399';

class CapturingSmsProvider implements SmsProvider {
  readonly sent: Array<{ to: string; body: string; from?: string }> = [];

  async send(message: { to: string; body: string; from?: string }) {
    const match = message.body.match(/\b(\d{6})\b/);
    if (match?.[1]) {
      setLastDevOtpForTests(message.to, match[1]);
    }
    this.sent.push(message);
    return { providerMessageId: `test-${this.sent.length}` };
  }
}

let databaseAvailable = false;
let stylistAccessToken = '';

async function registerAndLoginStylist(app: Awaited<ReturnType<typeof buildApp>>) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register/stylist',
    payload: stylistCreds,
  });

  const otp = getLastDevOtp();
  const verify = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/otp/verify',
    payload: {
      phoneNumber: stylistCreds.phoneNumber,
      code: otp?.code,
      purpose: 'phone_verify',
    },
  });

  stylistAccessToken = verify.json().data.tokens.accessToken;
}

describe('messaging routes', () => {
  const sms = new CapturingSmsProvider();
  const mockClaude = new MockClaudeProvider();

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    setSmsProvider(sms);
    setClaudeProvider(mockClaude);
    mockClaude.setFallback({
      intent: 'general',
      extracted_slots: {},
      confidence: 0.95,
      next_action: 'noop',
      client_message: 'Thanks — the stylist will follow up shortly.',
    });
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    clearLastDevOtp();
    sms.sent.length = 0;
    mockClaude.clearScenarios();

    try {
      await prisma.message.deleteMany();
      await prisma.escalation.deleteMany();
      await prisma.conversation.deleteMany();
      await prisma.session.deleteMany();
      await prisma.otpChallenge.deleteMany();
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: stylistCreds.email },
            { phoneNumber: { in: [stylistCreds.phoneNumber, clientPhone] } },
          ],
        },
      });
    } catch {
      // Tables may be missing if Ch.11 migration has not been applied yet.
    }
  });

  it('stores inbound SMS, escalates, stylist replies, and resolves handoff', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    await registerAndLoginStylist(app);

    const setNumber = await app.inject({
      method: 'PUT',
      url: '/api/v1/messaging/booking-number',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { smsBookingNumber: bookingNumber },
    });
    expect(setNumber.statusCode).toBe(200);

    const inbound = await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: {
        from: clientPhone,
        to: bookingNumber,
        body: 'Hi, I want knotless braids next week',
        messageSid: 'SM123',
      },
    });
    expect(inbound.statusCode).toBe(200);
    const inboundBody = inbound.json().data;
    expect(inboundBody.duplicate).toBe(false);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: {
        from: clientPhone,
        to: bookingNumber,
        body: 'Hi, I want knotless braids next week',
        messageSid: 'SM123',
      },
    });
    expect(duplicate.json().data.duplicate).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/messaging/conversations',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items).toHaveLength(1);

    const conversationId = list.json().data.items[0].id;

    const escalate = await app.inject({
      method: 'POST',
      url: `/api/v1/messaging/conversations/${conversationId}/escalate`,
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { reason: 'Client asked for custom style' },
    });
    expect(escalate.statusCode).toBe(200);
    expect(escalate.json().data.status).toBe('escalated');
    expect(sms.sent.some((item) => item.body.includes('stylist will reply'))).toBe(true);
    expect(sms.sent.some((item) => item.body.includes('needs your reply'))).toBe(true);

    const reply = await app.inject({
      method: 'POST',
      url: `/api/v1/messaging/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { content: 'Hi! I can do medium knotless on Friday.' },
    });
    expect(reply.statusCode).toBe(200);
    expect(sms.sent.some((item) => item.to === clientPhone)).toBe(true);

    const resolve = await app.inject({
      method: 'POST',
      url: `/api/v1/messaging/conversations/${conversationId}/resolve-escalation`,
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: {},
    });
    expect(resolve.statusCode).toBe(200);
    expect(resolve.json().data.status).toBe('active');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/messaging/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${stylistAccessToken}` },
    });
    expect(detail.json().data.messages.length).toBeGreaterThanOrEqual(4);

    await app.close();
  });

  it('rejects stylist reply before escalation', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    await registerAndLoginStylist(app);

    await app.inject({
      method: 'PUT',
      url: '/api/v1/messaging/booking-number',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { smsBookingNumber: bookingNumber },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: {
        from: clientPhone,
        to: bookingNumber,
        body: 'Hello',
        messageSid: 'SM456',
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/messaging/conversations',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
    });
    const conversationId = list.json().data.items[0].id;

    const reply = await app.inject({
      method: 'POST',
      url: `/api/v1/messaging/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { content: 'Jumping in early' },
    });
    expect(reply.statusCode).toBe(403);

    await app.close();
  });

  it('reuses an active conversation for the same client stylist and channel', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    await registerAndLoginStylist(app);

    await app.inject({
      method: 'PUT',
      url: '/api/v1/messaging/booking-number',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { smsBookingNumber: bookingNumber },
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: { from: clientPhone, to: bookingNumber, body: 'First', messageSid: 'SM-A' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: { from: clientPhone, to: bookingNumber, body: 'Second', messageSid: 'SM-B' },
    });

    expect(first.json().data.conversationId).toBe(second.json().data.conversationId);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/messaging/conversations',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
    });
    expect(list.json().data.total).toBe(1);

    await app.close();
  });

  it('blocks clients from reading another clients conversation', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    await registerAndLoginStylist(app);

    await app.inject({
      method: 'PUT',
      url: '/api/v1/messaging/booking-number',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
      payload: { smsBookingNumber: bookingNumber },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/messaging/dev/inbound-sms',
      payload: { from: clientPhone, to: bookingNumber, body: 'Hello', messageSid: 'SM-C' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/messaging/conversations',
      headers: { authorization: `Bearer ${stylistAccessToken}` },
    });
    const conversationId = list.json().data.items[0].id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/client',
      payload: { phoneNumber: '+447700900303' },
    });
    const otherOtp = getLastDevOtp();
    const otherVerify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: '+447700900303',
        code: otherOtp?.code,
        purpose: 'phone_verify',
      },
    });
    const otherToken = otherVerify.json().data.tokens.accessToken;

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/messaging/client/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(forbidden.statusCode).toBe(404);

    await app.close();
  });
});
