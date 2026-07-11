import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@project-braids/shared-types/api';
import { roleHasPermission } from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { authenticate, type AuthenticatedRequest } from './middleware.js';

export function requireRoles(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);

    const auth = (request as AuthenticatedRequest).auth;
    if (!roleHasPermission(auth.user.role, allowedRoles)) {
      throw new ApiError('FORBIDDEN', 'Insufficient permissions', 403);
    }
  };
}

export function requireStylistTenant(request: FastifyRequest, _reply: FastifyReply): void {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth.stylistId) {
    throw new ApiError('FORBIDDEN', 'Stylist tenant context required', 403);
  }
}

export const requireAdmin = requireRoles('admin');
export const requireClient = requireRoles('client');
export const requireAuthenticated = requireRoles(
  'admin',
  'stylist_owner',
  'stylist_staff',
  'client',
);

const requireStylistRoles = requireRoles('stylist_owner', 'stylist_staff');

export async function requireStylist(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireStylistRoles(request, reply);
  requireStylistTenant(request, reply);
}
