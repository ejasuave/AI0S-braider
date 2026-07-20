import type {
  BusinessStaffRole,
  BusinessStaffPermissions,
} from '@project-braids/shared-types/api';
import { BUSINESS_STAFF_ROLE_LABELS } from '@project-braids/shared-types/api';

export type StaffInviteEmailInput = {
  to: string;
  platformName: string;
  businessName: string;
  inviterName: string;
  role: BusinessStaffRole;
  acceptUrl: string;
  expiresAt: Date;
};

function formatExpiry(date: Date): string {
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  });
}

export function buildStaffInviteEmail(input: StaffInviteEmailInput): {
  subject: string;
  body: string;
  html: string;
} {
  const roleLabel = BUSINESS_STAFF_ROLE_LABELS[input.role];
  const expiresLabel = formatExpiry(input.expiresAt);
  const subject = `${input.inviterName} invited you to join ${input.businessName} on ${input.platformName}`;

  const body = [
    `${input.inviterName} invited you to join ${input.businessName} on ${input.platformName}.`,
    '',
    `Role: ${roleLabel}`,
    `This invitation expires on ${expiresLabel}.`,
    '',
    `Accept your invitation:`,
    input.acceptUrl,
    '',
    `If you did not expect this email, you can ignore it.`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px;"><strong>${escapeHtml(input.inviterName)}</strong> invited you to join <strong>${escapeHtml(input.businessName)}</strong> on ${escapeHtml(input.platformName)}.</p>
  <p style="margin: 16px 0;"><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
  <p style="margin: 16px 0;"><strong>Expires:</strong> ${escapeHtml(expiresLabel)}</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(input.acceptUrl)}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Accept Invitation</a>
  </p>
  <p style="font-size: 13px; color: #666;">Or open this link:<br /><a href="${escapeHtml(input.acceptUrl)}">${escapeHtml(input.acceptUrl)}</a></p>
  <p style="font-size: 13px; color: #666;">If you did not expect this email, you can ignore it.</p>
</body>
</html>`;

  return { subject, body, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type { BusinessStaffPermissions };
