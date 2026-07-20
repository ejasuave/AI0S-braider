import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  impersonationStartRequestSchema,
  staffAcceptInvitationRequestSchema,
  staffInviteRequestSchema,
  staffUpdatePermissionsSchema,
  staffUpdateRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { authenticate, type AuthenticatedRequest } from '../identity/middleware.js';
import { requireAdmin, requireBusinessPermission, requireRole } from './guards.js';
import { staffService } from './staff.service.js';
import { impersonationService } from './impersonation.service.js';

function inviterDisplayName(auth: AuthenticatedRequest['auth']): string {
  return auth.user.email?.split('@')[0] || auth.user.phoneNumber || 'A team member';
}

export const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/businesses/:businessId/permission-demo',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { businessId } = request.params as { businessId: string };
      sendData(reply, {
        allowed: true,
        businessId,
        permission: 'can_manage_bookings',
        userId: auth.user.id,
      });
    },
  );

  app.get(
    '/businesses/:businessId/staff',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const { businessId } = request.params as { businessId: string };
      const staff = await staffService.listStaff(businessId);
      sendData(reply, { staff });
    },
  );

  app.post(
    '/businesses/:businessId/staff/invite',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { businessId } = request.params as { businessId: string };
      const body = staffInviteRequestSchema.parse(request.body);
      const invitation = await staffService.inviteStaff({
        businessId,
        email: body.email,
        phoneNumber: body.phoneNumber,
        role: body.role,
        displayName: body.displayName,
        permissions: body.permissions,
        inviterName: inviterDisplayName(auth),
      });
      sendData(reply, { invitation }, 201);
    },
  );

  app.post(
    '/businesses/:businessId/staff/:staffId/resend',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { businessId, staffId } = request.params as { businessId: string; staffId: string };
      const invitation = await staffService.resendInvite({
        businessId,
        staffId,
        inviterName: inviterDisplayName(auth),
      });
      sendData(reply, { invitation });
    },
  );

  app.patch(
    '/businesses/:businessId/staff/:staffId',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const { businessId, staffId } = request.params as { businessId: string; staffId: string };
      const raw = request.body as Record<string, unknown>;
      // Support legacy { permissions } and new { role, displayName, permissions }
      if (raw && typeof raw === 'object' && 'permissions' in raw && Object.keys(raw).length === 1) {
        const body = staffUpdatePermissionsSchema.parse(raw);
        const updated = await staffService.updateStaffPermissions({
          businessId,
          staffId,
          permissions: body.permissions,
        });
        sendData(reply, { staff: updated });
        return;
      }
      const body = staffUpdateRequestSchema.parse(raw);
      const updated = await staffService.updateStaff({
        businessId,
        staffId,
        role: body.role,
        displayName: body.displayName,
        permissions: body.permissions,
      });
      sendData(reply, { staff: updated });
    },
  );

  app.post(
    '/businesses/:businessId/staff/:staffId/deactivate',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const { businessId, staffId } = request.params as { businessId: string; staffId: string };
      const staff = await staffService.deactivateStaff({ businessId, staffId });
      sendData(reply, { staff });
    },
  );

  app.delete(
    '/businesses/:businessId/staff/:staffId',
    { preHandler: [requireBusinessPermission('can_manage_staff')] },
    async (request, reply) => {
      const { businessId, staffId } = request.params as { businessId: string; staffId: string };
      const removed = await staffService.removeStaff({ businessId, staffId });
      sendData(reply, { staff: removed });
    },
  );

  app.post(
    '/staff/invitations/accept',
    { preHandler: authenticate },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const body = staffAcceptInvitationRequestSchema.parse(request.body);
      const staff = await staffService.acceptInvitationByToken({
        token: body.token,
        userId: auth.user.id,
        email: auth.user.email,
        phoneNumber: auth.user.phoneNumber,
      });
      sendData(reply, { staff });
    },
  );

  app.post(
    '/staff/invitations/:invitationId/accept',
    { preHandler: authenticate },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { invitationId } = request.params as { invitationId: string };
      const staff = await staffService.acceptInvitation({
        invitationId,
        userId: auth.user.id,
        email: auth.user.email,
        phoneNumber: auth.user.phoneNumber,
      });
      sendData(reply, { staff });
    },
  );

  app.post(
    '/admin/impersonate/:targetUserId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { targetUserId } = request.params as { targetUserId: string };
      const body = impersonationStartRequestSchema.parse(request.body);
      const session = await impersonationService.startSession({
        adminUserId: auth.user.id,
        targetUserId,
        reason: body.reason,
        createdFromIp: request.ip,
      });

      request.log.info(
        {
          event: 'impersonation_started',
          adminUserId: session.adminUserId,
          targetUserId: session.targetUser.id,
          impersonationSessionId: session.impersonationSessionId,
        },
        'Admin impersonation session started',
      );

      sendData(reply, {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        impersonationSessionId: session.impersonationSessionId,
        targetUserId: session.targetUser.id,
        adminUserId: session.adminUserId,
      });
    },
  );

  app.post('/admin/impersonate/end', { preHandler: [requireAdmin] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = z.object({ impersonationSessionId: z.string().uuid() }).parse(request.body);

    await impersonationService.endSession({
      sessionId: body.impersonationSessionId,
      adminUserId: auth.user.id,
    });

    sendData(reply, { ended: true });
  });
};

/** Guard verification routes (Ch.4.2). */
export const rolesAccessRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/stylist-only',
    { preHandler: [requireRole('stylist_owner', 'stylist_staff')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      sendData(reply, { role: auth.user.role, scope: 'stylist_only' });
    },
  );
};
