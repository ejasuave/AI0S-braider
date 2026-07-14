import type { FastifyReply, FastifyRequest } from 'fastify';
import type { BusinessPermissionFlag, UserRole } from '@project-braids/shared-types/api';
import { roleHasPermission } from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { authenticate, type AuthenticatedRequest } from '../identity/middleware.js';
import { businessService } from './business.service.js';
import { ownerHasAllPermissions, staffHasPermission } from './permissions.js';

export function logPermissionDenied(
  request: FastifyRequest,
  details: {
    userId: string;
    requiredRoles?: readonly UserRole[];
    requiredPermission?: BusinessPermissionFlag;
    businessId?: string;
    resource: string;
  },
): void {
  request.log.warn(
    {
      event: 'permission_denied',
      userId: details.userId,
      requiredRoles: details.requiredRoles,
      requiredPermission: details.requiredPermission,
      businessId: details.businessId,
      resource: details.resource,
      method: request.method,
      url: request.url,
    },
    'Authorization check failed',
  );
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    const auth = (request as AuthenticatedRequest).auth;

    if (!roleHasPermission(auth.user.role, allowedRoles)) {
      logPermissionDenied(request, {
        userId: auth.user.id,
        requiredRoles: allowedRoles,
        resource: request.url,
      });
      throw new ApiError('FORBIDDEN', 'Insufficient permissions', 403);
    }
  };
}

function resolveBusinessIdFromRequest(
  request: FastifyRequest,
  auth: AuthenticatedRequest['auth'],
): string {
  const params = request.params as { businessId?: string };
  if (params.businessId) {
    return params.businessId;
  }
  if (auth.businessId) {
    return auth.businessId;
  }
  throw new ApiError('FORBIDDEN', 'Business context required', 403);
}

export function requireBusinessPermission(permissionFlag: BusinessPermissionFlag) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    const auth = (request as AuthenticatedRequest).auth;
    const businessId = resolveBusinessIdFromRequest(request, auth);

    if (auth.user.role === 'stylist_owner') {
      const isOwner = await businessService.isBusinessOwner(businessId, auth.user.id);
      if (isOwner && ownerHasAllPermissions()) {
        return;
      }
    }

    if (auth.user.role === 'stylist_staff') {
      const staff = await businessService.getActiveStaffMembership(businessId, auth.user.id);
      if (staffHasPermission(staff, permissionFlag)) {
        return;
      }
    }

    logPermissionDenied(request, {
      userId: auth.user.id,
      requiredPermission: permissionFlag,
      businessId,
      resource: request.url,
    });
    throw new ApiError('FORBIDDEN', 'Insufficient business permissions', 403);
  };
}

/** Sensitive routes blocked during admin impersonation (Ch.4.4). */
const IMPERSONATION_BLOCKED_PATTERNS: RegExp[] = [
  /^\/api\/v1\/auth\/password/,
  /^\/api\/v1\/auth\/password-reset/,
  /^\/api\/v1\/auth\/phone-change/,
  /^\/api\/v1\/auth\/oauth/,
  /^\/api\/v1\/payments\/connect/,
];

export async function rejectImpersonationOnSensitiveRoutes(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth?.impersonation) {
    return;
  }

  const path = request.url.split('?')[0] ?? request.url;
  const blocked = IMPERSONATION_BLOCKED_PATTERNS.some((pattern) => pattern.test(path));
  if (blocked) {
    logPermissionDenied(request, {
      userId: auth.user.id,
      resource: path,
    });
    throw new ApiError(
      'FORBIDDEN',
      'This action is not permitted during an impersonation session',
      403,
    );
  }
}

export const requireAdmin = requireRole('admin');
export const requireClient = requireRole('client');
export const requireAuthenticated = requireRole(
  'admin',
  'stylist_owner',
  'stylist_staff',
  'client',
);

export async function requireStylist(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireRole('stylist_owner', 'stylist_staff')(request, reply);
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth.stylistId) {
    logPermissionDenied(request, {
      userId: auth.user.id,
      requiredRoles: ['stylist_owner', 'stylist_staff'],
      resource: request.url,
    });
    throw new ApiError('FORBIDDEN', 'Stylist tenant context required', 403);
  }
}

export function requireStylistTenant(request: FastifyRequest, _reply: FastifyReply): void {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth.stylistId) {
    throw new ApiError('FORBIDDEN', 'Stylist tenant context required', 403);
  }
}
