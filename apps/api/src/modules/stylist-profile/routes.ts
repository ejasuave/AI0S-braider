import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  createBusinessServiceRequestSchema,
  createScheduleExceptionRequestSchema,
  createServiceAddonRequestSchema,
  instagramConnectRequestSchema,
  instagramImportRequestSchema,
  portfolioUploadUrlRequestSchema,
  profilePhotoUploadUrlRequestSchema,
  registerPortfolioItemRequestSchema,
  registerProfilePhotoRequestSchema,
  reorderPortfolioRequestSchema,
  reorderServiceAddonsRequestSchema,
  replaceWorkingHoursRequestSchema,
  updateBusinessPolicyRequestSchema,
  updateBusinessProfileRequestSchema,
  updateBusinessServiceRequestSchema,
  updateScheduleExceptionRequestSchema,
  updateServiceAddonRequestSchema,
  resolveCalendarConflictRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { requireRole, requireBusinessPermission } from '../roles/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { calendarConflictService } from '../booking/calendar-conflicts.js';
import { stylistProfileService } from './service.js';

async function resolveMe(
  request: FastifyRequest,
): Promise<{ businessId: string; stylistId: string }> {
  const auth = (request as AuthenticatedRequest).auth;
  return stylistProfileService.resolveBusinessContext(auth.user.id, auth.user.role);
}

export const stylistProfileRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preHandler: [requireRole('stylist_owner')] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = (request.body ?? {}) as { businessName?: string };
    const profile = await stylistProfileService.createBusinessForOwner(
      auth.user.id,
      body.businessName ?? '',
    );
    sendData(reply, profile, 201);
  });

  app.get(
    '/me',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const profile = await stylistProfileService.getBusinessProfile(businessId);
      sendData(reply, profile);
    },
  );

  app.patch(
    '/me',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = updateBusinessProfileRequestSchema.parse(request.body);
      const profile = await stylistProfileService.updateBusinessProfile(businessId, body);
      sendData(reply, profile);
    },
  );

  app.patch(
    '/me/onboarding-status',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const profile = await stylistProfileService.completeOnboarding(businessId);
      sendData(reply, profile);
    },
  );

  app.post(
    '/me/portfolio/upload-url',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = portfolioUploadUrlRequestSchema.parse(request.body ?? {});
      const result = await stylistProfileService.createPortfolioUploadUrl(
        businessId,
        body.contentType,
        body.serviceOfferingId,
      );
      sendData(reply, result);
    },
  );

  app.post(
    '/me/portfolio',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId, stylistId } = await resolveMe(request);
      const body = registerPortfolioItemRequestSchema.parse(request.body);
      const item = await stylistProfileService.registerPortfolioItem(businessId, stylistId, body);
      sendData(reply, item, 201);
    },
  );

  app.get(
    '/me/portfolio',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const query = request.query as { serviceOfferingId?: string };
      const items = await stylistProfileService.listPortfolioItems(
        businessId,
        query.serviceOfferingId,
      );
      sendData(reply, items);
    },
  );

  app.patch(
    '/me/portfolio/reorder',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = reorderPortfolioRequestSchema.parse(request.body);
      const items = await stylistProfileService.reorderPortfolio(businessId, body);
      sendData(reply, items);
    },
  );

  app.delete(
    '/me/portfolio/:itemId',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { itemId } = request.params as { itemId: string };
      await stylistProfileService.deletePortfolioItem(businessId, itemId);
      sendData(reply, { status: 'deleted' });
    },
  );

  app.post(
    '/me/photo/upload-url',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { stylistId } = await resolveMe(request);
      const body = profilePhotoUploadUrlRequestSchema.parse(request.body ?? {});
      const result = await stylistProfileService.createProfilePhotoUploadUrl(
        stylistId,
        body.contentType,
      );
      sendData(reply, result);
    },
  );

  app.post(
    '/me/photo',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { stylistId } = await resolveMe(request);
      const body = registerProfilePhotoRequestSchema.parse(request.body);
      const result = await stylistProfileService.setProfilePhoto(stylistId, body);
      sendData(reply, result);
    },
  );

  app.delete(
    '/me/photo',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { stylistId } = await resolveMe(request);
      await stylistProfileService.deleteProfilePhoto(stylistId);
      sendData(reply, { status: 'deleted' });
    },
  );

  app.post(
    '/me/instagram/connect',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = instagramConnectRequestSchema.parse(request.body);
      const result = await stylistProfileService.connectInstagram(businessId, body);
      sendData(reply, result);
    },
  );

  app.post(
    '/me/instagram/import',
    { preHandler: [requireBusinessPermission('can_manage_profile')] },
    async (request, reply) => {
      const { businessId, stylistId } = await resolveMe(request);
      const body = instagramImportRequestSchema.parse(request.body ?? {});
      const result = await stylistProfileService.importInstagram(businessId, stylistId, body.limit);
      sendData(reply, result);
    },
  );

  app.get(
    '/me/services',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const services = await stylistProfileService.listServices(businessId, false);
      sendData(reply, services);
    },
  );

  app.post(
    '/me/services',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId, stylistId } = await resolveMe(request);
      const body = createBusinessServiceRequestSchema.parse(request.body);
      const service = await stylistProfileService.createService(businessId, stylistId, body);
      sendData(reply, service, 201);
    },
  );

  app.patch(
    '/me/services/:serviceId',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId } = request.params as { serviceId: string };
      const body = updateBusinessServiceRequestSchema.parse(request.body);
      const service = await stylistProfileService.updateService(businessId, serviceId, body);
      sendData(reply, service);
    },
  );

  app.delete(
    '/me/services/:serviceId',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId } = request.params as { serviceId: string };
      const service = await stylistProfileService.deactivateService(businessId, serviceId);
      sendData(reply, service);
    },
  );

  app.post(
    '/me/services/:serviceId/addons',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId } = request.params as { serviceId: string };
      const body = createServiceAddonRequestSchema.parse(request.body);
      const addon = await stylistProfileService.createAddon(businessId, serviceId, body);
      sendData(reply, addon, 201);
    },
  );

  app.patch(
    '/me/services/:serviceId/addons/:addonId',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId, addonId } = request.params as { serviceId: string; addonId: string };
      const body = updateServiceAddonRequestSchema.parse(request.body);
      const addon = await stylistProfileService.updateAddon(businessId, serviceId, addonId, body);
      sendData(reply, addon);
    },
  );

  app.delete(
    '/me/services/:serviceId/addons/:addonId',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId, addonId } = request.params as { serviceId: string; addonId: string };
      await stylistProfileService.deleteAddon(businessId, serviceId, addonId);
      reply.status(204).send();
    },
  );

  app.put(
    '/me/services/:serviceId/addons/reorder',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { serviceId } = request.params as { serviceId: string };
      const body = reorderServiceAddonsRequestSchema.parse(request.body);
      const addons = await stylistProfileService.reorderAddons(businessId, serviceId, body);
      sendData(reply, addons);
    },
  );

  app.get('/:businessId/services', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const services = await stylistProfileService.listServices(businessId, true);
    sendData(reply, services);
  });

  app.get(
    '/me/policy',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const policy = await stylistProfileService.getPolicy(businessId);
      sendData(reply, policy);
    },
  );

  app.patch(
    '/me/policy',
    { preHandler: [requireBusinessPermission('can_manage_pricing')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = updateBusinessPolicyRequestSchema.parse(request.body);
      const policy = await stylistProfileService.updatePolicy(businessId, body);
      sendData(reply, policy);
    },
  );

  app.get('/:businessId/policy', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const policy = await stylistProfileService.getPolicy(businessId);
    sendData(reply, policy);
  });

  app.get(
    '/me/working-hours',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const hours = await stylistProfileService.listWorkingHours(businessId);
      sendData(reply, hours);
    },
  );

  app.put(
    '/me/working-hours',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = replaceWorkingHoursRequestSchema.parse(request.body);
      const hours = await stylistProfileService.replaceWorkingHours(businessId, body.hours);
      sendData(reply, hours);
    },
  );

  app.post(
    '/me/schedule-exceptions',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const body = createScheduleExceptionRequestSchema.parse(request.body);
      const row = await stylistProfileService.createScheduleException(businessId, body);
      sendData(reply, row, 201);
    },
  );

  app.patch(
    '/me/schedule-exceptions/:exceptionId',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { exceptionId } = request.params as { exceptionId: string };
      const body = updateScheduleExceptionRequestSchema.parse(request.body);
      const row = await stylistProfileService.updateScheduleException(
        businessId,
        exceptionId,
        body,
      );
      sendData(reply, row);
    },
  );

  app.delete(
    '/me/schedule-exceptions/:exceptionId',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { exceptionId } = request.params as { exceptionId: string };
      await stylistProfileService.deleteScheduleException(businessId, exceptionId);
      sendData(reply, { status: 'deleted' });
    },
  );

  app.get(
    '/me/calendar-conflicts',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const conflicts = await calendarConflictService.listUnresolved(businessId);
      sendData(reply, conflicts);
    },
  );

  app.post(
    '/me/calendar-conflicts/:conflictId/resolve',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const { businessId } = await resolveMe(request);
      const { conflictId } = request.params as { conflictId: string };
      const body = resolveCalendarConflictRequestSchema.parse(request.body);
      const conflict = await calendarConflictService.resolveConflict(businessId, conflictId, body);
      sendData(reply, conflict);
    },
  );
};

export const styleCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const categories = await stylistProfileService.listStyleCategories();
    sendData(reply, categories);
  });
};
