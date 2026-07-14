import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { getSmsProvider } from '../../lib/sms/sms-provider.js';
import { getEmailProvider } from '../../lib/email/email-provider.js';
import {
  businessStaffPermissionsSchema,
  type BusinessStaffPermissions,
} from '@project-braids/shared-types/api';
import { businessService } from './business.service.js';
import { toBusinessStaffDto } from './mappers.js';

export class StaffService {
  async inviteStaff(input: {
    businessId: string;
    email?: string;
    phoneNumber?: string;
    permissions: BusinessStaffPermissions;
  }) {
    await businessService.getBusinessById(input.businessId);

    const invitation = await prisma.businessStaff.create({
      data: {
        businessId: input.businessId,
        inviteeEmail: input.email?.toLowerCase(),
        inviteePhone: input.phoneNumber,
        permissions: input.permissions,
      },
    });

    const env = getEnv();
    const message = `You have been invited to join a team on ${env.PLATFORM_DISPLAY_NAME}. Sign in and accept invitation ${invitation.id}.`;

    if (input.phoneNumber) {
      await getSmsProvider().send({ to: input.phoneNumber, body: message });
    } else if (input.email) {
      await getEmailProvider().send({
        to: input.email,
        subject: `${env.PLATFORM_DISPLAY_NAME} staff invitation`,
        body: message,
      });
    }

    return toBusinessStaffDto(invitation);
  }

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

    const emailMatches =
      invitation.inviteeEmail &&
      input.email &&
      invitation.inviteeEmail.toLowerCase() === input.email.toLowerCase();
    const phoneMatches = invitation.inviteePhone && invitation.inviteePhone === input.phoneNumber;

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
      },
    });

    return toBusinessStaffDto(updated);
  }

  async updateStaffPermissions(input: {
    businessId: string;
    staffId: string;
    permissions: BusinessStaffPermissions;
  }) {
    businessStaffPermissionsSchema.parse(input.permissions);

    const staff = await prisma.businessStaff.findFirst({
      where: { id: input.staffId, businessId: input.businessId, removedAt: null },
    });
    if (!staff) {
      throw ApiError.notFound('Staff member not found');
    }

    const updated = await prisma.businessStaff.update({
      where: { id: staff.id },
      data: { permissions: input.permissions },
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
      data: { removedAt: new Date() },
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
