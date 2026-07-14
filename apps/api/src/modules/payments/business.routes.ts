import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { incomeReportQuerySchema } from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { requireBusinessPermission } from '../roles/guards.js';
import { rejectImpersonationOnSensitiveRoutes } from '../roles/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { paymentService } from './service.js';
import './events.js';

function resolveBusinessId(request: AuthenticatedRequest): string {
  const businessId = request.auth.businessId;
  if (!businessId) {
    throw ApiError.forbidden('Business context required');
  }
  return businessId;
}

async function handleConnectOnboarding(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  const businessId = resolveBusinessId(request);
  const stylistId = request.auth.stylistId;
  if (!stylistId) {
    throw ApiError.forbidden('Stylist tenant context required');
  }
  const result = await paymentService.startConnectOnboarding(
    businessId,
    stylistId,
    request.auth.user.email ?? undefined,
  );
  sendData(reply, result);
}

const connectOnboardingPreHandlers = [
  requireBusinessPermission('can_view_payouts'),
  rejectImpersonationOnSensitiveRoutes,
] as const;

export const paymentBusinessRoutes: FastifyPluginAsync = async (app) => {
  // GET avoids a dev-server hang seen with real HTTP POST while SSE is connected.
  app.get(
    '/me/stripe/onboarding-link',
    { preHandler: [...connectOnboardingPreHandlers] },
    async (request, reply) => {
      await handleConnectOnboarding(request as AuthenticatedRequest, reply);
    },
  );

  app.post(
    '/me/stripe/onboarding-link',
    { preHandler: [...connectOnboardingPreHandlers] },
    async (request, reply) => {
      await handleConnectOnboarding(request as AuthenticatedRequest, reply);
    },
  );

  app.get(
    '/me/stripe/status',
    { preHandler: [requireBusinessPermission('can_view_payouts')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const status = await paymentService.getConnectStatus(businessId);
      sendData(reply, status);
    },
  );

  app.get(
    '/me/payouts',
    { preHandler: [requireBusinessPermission('can_view_payouts')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const payouts = await paymentService.listPayoutHistory(businessId);
      sendData(reply, payouts);
    },
  );

  app.get(
    '/me/income-report',
    { preHandler: [requireBusinessPermission('can_view_payouts')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const query = incomeReportQuerySchema.parse(request.query);
      const report = await paymentService.getIncomeReport(businessId, query.from, query.to);
      sendData(reply, report);
    },
  );
};
