import { createHash, randomBytes } from 'node:crypto';
import {
  STAFF_ROLE_PERMISSION_PRESETS,
  businessStaffPermissionsSchema,
  type BusinessStaffPermissions,
  type BusinessStaffRole,
  type BusinessStaffStatus,
} from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import {
  assertTransactionalEmailConfigured,
  getEmailProvider,
} from '../../lib/email/email-provider.js';
import { getSmsProvider } from '../../lib/sms/sms-provider.js';
import { buildStaffInviteEmail } from './invite-email.js';
import { businessService } from './business.service.js';
import { toBusinessStaffDto } from './mappers.js';

export const INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function permissionsForRole(
  role: BusinessStaffRole,
  override?: BusinessStaffPermissions,
): BusinessStaffPermissions {
  if (override) {
    return businessStaffPermissionsSchema.parse(override);
  }
  return STAFF_ROLE_PERMISSION_PRESETS[role];
}

export function staffStatusFromRow(row: {
  acceptedAt: Date | null;
  deactivatedAt: Date | null;
  removedAt: Date | null;
}): BusinessStaffStatus {
  if (row.deactivatedAt || row.removedAt) return 'deactivated';
  if (row.acceptedAt) return 'active';
  return 'pending';
}

export class StaffService {
  async inviteStaff(input: {
    businessId: string;
    email?: string;
    phoneNumber?: string;
    role: BusinessStaffRole;
    displayName?: string;
    permissions?: BusinessStaffPermissions;
    inviterName: string;
  }) {
    const env = getEnv();
    if (input.email) {
      assertTransactionalEmailConfigured(env);
    }

    const business = await businessService.getBusinessById(input.businessId);
    const permissions = permissionsForRole(input.role, input.permissions);
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await prisma.businessStaff.create({
      data: {
        businessId: input.businessId,
        inviteeEmail: input.email?.toLowerCase() ?? null,
        inviteePhone: input.phoneNumber ?? null,
        displayName: input.displayName ?? null,
        role: input.role,
        permissions,
        inviteTokenHash: tokenHash,
        inviteExpiresAt,
      },
    });

    const acceptUrl = `${env.WEB_APP_URL}/invite/${token}`;

    try {
      if (input.phoneNumber) {
        const roleLabel = input.role;
        await getSmsProvider().send({
          to: input.phoneNumber,
          body: `${input.inviterName} invited you to join ${business.businessName} as ${roleLabel}. Accept: ${acceptUrl} (expires in ${INVITE_TTL_DAYS} days)`,
        });
      } else if (input.email) {
        const email = buildStaffInviteEmail({
          to: input.email,
          platformName: env.PLATFORM_DISPLAY_NAME,
          businessName: business.businessName || env.PLATFORM_DISPLAY_NAME,
          inviterName: input.inviterName,
          role: input.role,
          acceptUrl,
          expiresAt: inviteExpiresAt,
        });
        await getEmailProvider().send({
          to: input.email,
          subject: email.subject,
          body: email.body,
          html: email.html,
        });
      }
    } catch (error) {
      await prisma.businessStaff.update({
        where: { id: invitation.id },
        data: { removedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null },
      });
      throw new ApiError(
        'SERVICE_UNAVAILABLE',
        error instanceof Error ? error.message : 'Failed to send invitation',
        503,
      );
    }

    return { invitation: toBusinessStaffDto(invitation), acceptUrl };
  }

  async resendInvite(input: {
    businessId: string;
    staffId: string;
    inviterName: string;
  }) {
    const env = getEnv();
    const staff = await prisma.businessStaff.findFirst({
      where: { id: input.staffId, businessId: input.businessId, removedAt: null },
    });
    if (!staff) {
      throw ApiError.notFound('Staff member not found');
    }
    if (staff.acceptedAt) {
      throw new ApiError('CONFLICT', 'Invitation already accepted', 409);
    }
    if (!staff.inviteeEmail && !staff.inviteePhone) {
      throw new ApiError('VALIDATION_ERROR', 'Invitation has no email or phone', 400);
    }
    if (staff.inviteeEmail) {
      assertTransactionalEmailConfigured(env);
    }

    const business = await businessService.getBusinessById(input.businessId);
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.businessStaff.update({
      where: { id: staff.id },
      data: {
        inviteTokenHash: tokenHash,
        inviteExpiresAt,
        invitedAt: new Date(),
        deactivatedAt: null,
      },
    });

    const acceptUrl = `${env.WEB_APP_URL}/invite/${token}`;

    try {
      if (staff.inviteePhone) {
        await getSmsProvider().send({
          to: staff.inviteePhone,
          body: `${input.inviterName} invited you to join ${business.businessName}. Accept: ${acceptUrl}`,
        });
      } else if (staff.inviteeEmail) {
        const email = buildStaffInviteEmail({
          to: staff.inviteeEmail,
          platformName: env.PLATFORM_DISPLAY_NAME,
          businessName: business.businessName || env.PLATFORM_DISPLAY_NAME,
          inviterName: input.inviterName,
          role: staff.role,
          acceptUrl,
          expiresAt: inviteExpiresAt,
        });
        await getEmailProvider().send({
          to: staff.inviteeEmail,
          subject: email.subject,
          body: email.body,
          html: email.html,
        });
      }
    } catch (error) {
      throw new ApiError(
        'SERVICE_UNAVAILABLE',
        error instanceof Error ? error.message : 'Failed to resend invitation',
        503,
      );
    }

    return { invitation: toBusinessStaffDto(updated), acceptUrl };
  }

  async acceptInvitationByToken(input: {
    token: string;
    userId: string;
    email: string | null;
    phoneNumber: string;
  }) {
    const token = input.token.trim();
    const tokenHash = hashInviteToken(token);
    const invitation = await prisma.businessStaff.findFirst({
      where: { inviteTokenHash: tokenHash },
    });

    if (!invitation || invitation.removedAt) {
      throw ApiError.notFound(
        'Invitation not found or no longer valid. Ask the owner to send a new invite.',
      );
    }
    if (invitation.acceptedAt) {
      throw new ApiError('CONFLICT', 'Invitation has already been used', 409);
    }
    if (invitation.deactivatedAt) {
      throw new ApiError('FORBIDDEN', 'Invitation was deactivated', 403);
    }
    if (!invitation.inviteExpiresAt || invitation.inviteExpiresAt.getTime() < Date.now()) {
      throw new ApiError('CONFLICT', 'Invitation has expired', 409);
    }

    const business = await businessService.getBusinessById(invitation.businessId);
    if (business.ownerUserId === input.userId) {
      throw new ApiError(
        'CONFLICT',
        'You already own this business — staff invites are for other team members',
        409,
      );
    }

    const emailMatches =
      Boolean(invitation.inviteeEmail) &&
      Boolean(input.email) &&
      invitation.inviteeEmail!.toLowerCase() === input.email!.toLowerCase();
    const phoneMatches =
      Boolean(invitation.inviteePhone) && invitation.inviteePhone === input.phoneNumber;

    // Token is the secret; email/phone match is preferred but not required so
    // invitees can accept after phone OTP when the invite was sent to email.
    if (!emailMatches && !phoneMatches) {
      if (invitation.inviteeEmail && input.email) {
        throw new ApiError(
          'FORBIDDEN',
          'Sign in with the email or phone that received this invitation',
          403,
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: input.userId },
      data: {
        role: 'stylist_staff',
        ...(invitation.inviteeEmail && !input.email
          ? { email: invitation.inviteeEmail.toLowerCase() }
          : {}),
      },
    });

    const updated = await prisma.businessStaff.update({
      where: { id: invitation.id },
      data: {
        userId: user.id,
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
        deactivatedAt: null,
      },
    });

    return toBusinessStaffDto(updated);
  }

  /** Legacy accept by invitation id (kept for older links / tests). */
  async acceptInvitation(input: {
    invitationId: string;
    userId: string;
    email: string | null;
    phoneNumber: string;
  }) {
    const invitation = await prisma.businessStaff.findUnique({
      where: { id: input.invitationId },
    });

    if (!invitation || invitation.removedAt || invitation.acceptedAt) {
      throw ApiError.notFound('Invitation not found or no longer valid');
    }
    if (invitation.deactivatedAt) {
      throw new ApiError('FORBIDDEN', 'Invitation was deactivated', 403);
    }
    if (invitation.inviteExpiresAt && invitation.inviteExpiresAt.getTime() < Date.now()) {
      throw new ApiError('CONFLICT', 'Invitation has expired', 409);
    }

    const emailMatches =
      invitation.inviteeEmail &&
      input.email &&
      invitation.inviteeEmail.toLowerCase() === input.email.toLowerCase();
    const phoneMatches =
      invitation.inviteePhone && invitation.inviteePhone === input.phoneNumber;

    if (!emailMatches && !phoneMatches) {
      throw new ApiError('FORBIDDEN', 'Invitation does not belong to this account', 403);
    }

    const user = await prisma.user.update({
      where: { id: input.userId },
      data: { role: 'stylist_staff' },
    });

    const updated = await prisma.businessStaff.update({
      where: { id: invitation.id },
      data: {
        userId: user.id,
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    return toBusinessStaffDto(updated);
  }

  async updateStaff(input: {
    businessId: string;
    staffId: string;
    role?: BusinessStaffRole;
    displayName?: string | null;
    permissions?: BusinessStaffPermissions;
  }) {
    const staff = await prisma.businessStaff.findFirst({
      where: { id: input.staffId, businessId: input.businessId, removedAt: null },
    });
    if (!staff) {
      throw ApiError.notFound('Staff member not found');
    }

    const role = input.role ?? staff.role;
    const permissions =
      input.permissions !== undefined
        ? businessStaffPermissionsSchema.parse(input.permissions)
        : input.role
          ? permissionsForRole(input.role)
          : businessStaffPermissionsSchema.parse(staff.permissions);

    const updated = await prisma.businessStaff.update({
      where: { id: staff.id },
      data: {
        role,
        permissions,
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      },
    });

    return toBusinessStaffDto(updated);
  }

  async updateStaffPermissions(input: {
    businessId: string;
    staffId: string;
    permissions: BusinessStaffPermissions;
  }) {
    return this.updateStaff({
      businessId: input.businessId,
      staffId: input.staffId,
      permissions: input.permissions,
    });
  }

  async deactivateStaff(input: { businessId: string; staffId: string }) {
    const staff = await prisma.businessStaff.findFirst({
      where: { id: input.staffId, businessId: input.businessId, removedAt: null },
    });
    if (!staff) {
      throw ApiError.notFound('Staff member not found');
    }

    const updated = await prisma.businessStaff.update({
      where: { id: staff.id },
      data: {
        deactivatedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    return toBusinessStaffDto(updated);
  }

  async removeStaff(input: { businessId: string; staffId: string }) {
    const staff = await prisma.businessStaff.findFirst({
      where: { id: input.staffId, businessId: input.businessId, removedAt: null },
    });
    if (!staff) {
      throw ApiError.notFound('Staff member not found');
    }

    const updated = await prisma.businessStaff.update({
      where: { id: staff.id },
      data: {
        removedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    return toBusinessStaffDto(updated);
  }

  async listStaff(businessId: string) {
    const staff = await prisma.businessStaff.findMany({
      where: { businessId, removedAt: null },
      orderBy: { invitedAt: 'asc' },
    });
    return staff.map(toBusinessStaffDto);
  }
}

export const staffService = new StaffService();
