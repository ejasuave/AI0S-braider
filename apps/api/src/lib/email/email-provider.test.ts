import { describe, expect, it } from 'vitest';
import {
  CapturingEmailProvider,
  createEmailProviderFromEnv,
  assertTransactionalEmailConfigured,
} from './email-provider.js';
import { buildStaffInviteEmail } from '../../modules/roles/invite-email.js';
import {
  generateInviteToken,
  hashInviteToken,
  permissionsForRole,
} from '../../modules/roles/staff.service.js';

describe('email provider', () => {
  it('uses Resend when API key is set', () => {
    const provider = createEmailProviderFromEnv({
      RESEND_API_KEY: 're_test',
      PLATFORM_DISPLAY_NAME: 'Braids',
    });
    expect(provider.constructor.name).toBe('ResendEmailProvider');
  });

  it('falls back to console without API key', () => {
    const provider = createEmailProviderFromEnv({
      PLATFORM_DISPLAY_NAME: 'Braids',
    });
    expect(provider.constructor.name).toBe('ConsoleEmailProvider');
  });

  it('fails closed for staging/production without Resend', () => {
    expect(() => assertTransactionalEmailConfigured({ NODE_ENV: 'staging' })).toThrow(
      /Email invites are not configured/,
    );
    expect(() =>
      assertTransactionalEmailConfigured({ NODE_ENV: 'production', RESEND_API_KEY: 're_x' }),
    ).not.toThrow();
  });

  it('capturing provider records messages', async () => {
    const capture = new CapturingEmailProvider();
    await capture.send({ to: 'a@b.com', subject: 'Hi', body: 'Hello', html: '<p>Hello</p>' });
    expect(capture.sent).toHaveLength(1);
    expect(capture.sent[0]?.html).toContain('Hello');
  });
});

describe('staff invite helpers', () => {
  it('hashes invite tokens stably', () => {
    const token = generateInviteToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(hashInviteToken(`${token}x`));
  });

  it('maps roles to permission presets', () => {
    expect(permissionsForRole('manager').can_manage_staff).toBe(true);
    expect(permissionsForRole('stylist').can_manage_pricing).toBe(false);
    expect(permissionsForRole('receptionist').can_manage_bookings).toBe(true);
  });

  it('builds invite email with accept link and expiry', () => {
    const email = buildStaffInviteEmail({
      to: 'staff@example.com',
      platformName: 'Project Braids',
      businessName: 'Maya Braids',
      inviterName: 'Maya',
      role: 'manager',
      acceptUrl: 'http://localhost:3000/invite/abc',
      expiresAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    expect(email.subject).toContain('Maya Braids');
    expect(email.body).toContain('http://localhost:3000/invite/abc');
    expect(email.html).toContain('Accept Invitation');
    expect(email.html).toContain('Manager');
  });
});
