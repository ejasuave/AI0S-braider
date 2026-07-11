import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../lib/errors.js';
import { requireRole } from './guards.js';
import type { AuthenticatedRequest } from './middleware.js';

vi.mock('./middleware.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    (request as AuthenticatedRequest).auth = {
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        role: 'client',
        phoneNumber: '+447700900123',
        email: null,
        phoneVerified: true,
        emailVerified: false,
      },
      sessionId: '22222222-2222-2222-2222-222222222222',
      stylistId: null,
      businessId: null,
      impersonation: null,
    };
  }),
}));

describe('requireRole', () => {
  it('allows matching roles', async () => {
    const handler = requireRole('client');
    const request = {} as FastifyRequest;
    const reply = {} as FastifyReply;

    await expect(handler(request, reply)).resolves.toBeUndefined();
  });

  it('rejects non-matching roles', async () => {
    const handler = requireRole('admin');
    const request = { log: { warn: vi.fn() } } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await expect(handler(request, reply)).rejects.toBeInstanceOf(ApiError);
  });
});
