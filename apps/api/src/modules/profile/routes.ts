import type { FastifyPluginAsync } from 'fastify';
import {
  createPortfolioItemRequestSchema,
  createServiceOfferingRequestSchema,
  pricingLookupRequestSchema,
  updatePortfolioItemRequestSchema,
  updateServiceOfferingRequestSchema,
  updateStylistProfileRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { requireStylist } from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { profileService } from './service.js';

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const profile = await profileService.getOrCreateProfile(auth.user.id);
    sendData(reply, profile);
  });

  app.patch('/me', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = updateStylistProfileRequestSchema.parse(request.body);
    const profile = await profileService.updateProfile(auth.stylistId!, body);
    sendData(reply, profile);
  });

  app.get('/style-categories', async (_request, reply) => {
    const categories = await profileService.listStyleCategories();
    sendData(reply, categories);
  });

  app.get('/stylists/:stylistId/booking-page', async (request, reply) => {
    const { stylistId } = request.params as { stylistId: string };
    const page = await profileService.getPublicBookingPage(stylistId);
    sendData(reply, page);
  });

  app.get('/stylists/by-slug/:slug/booking-page', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const page = await profileService.getPublicBookingPageBySlug(slug);
    sendData(reply, page);
  });

  app.get(
    '/stylists/by-slug/:slug/services/:styleSlug/:sizeSlug/:lengthSlug',
    async (request, reply) => {
      const { slug, styleSlug, sizeSlug, lengthSlug } = request.params as {
        slug: string;
        styleSlug: string;
        sizeSlug: string;
        lengthSlug: string;
      };
      const resolved = await profileService.resolveServiceShare(
        slug,
        styleSlug,
        sizeSlug,
        lengthSlug,
      );
      sendData(reply, resolved);
    },
  );

  app.get('/services', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const offerings = await profileService.listServiceOfferings(auth.stylistId!);
    sendData(reply, offerings);
  });

  app.post('/services', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = createServiceOfferingRequestSchema.parse(request.body);
    const offering = await profileService.createServiceOffering(auth.stylistId!, body);
    sendData(reply, offering, 201);
  });

  app.get('/services/lookup', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const query = pricingLookupRequestSchema.parse(request.query);
    const result = await profileService.lookupPricing(auth.stylistId!, query);
    sendData(reply, result);
  });

  app.patch('/services/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const body = updateServiceOfferingRequestSchema.parse(request.body);
    const offering = await profileService.updateServiceOffering(auth.stylistId!, id, body);
    sendData(reply, offering);
  });

  app.delete('/services/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const offering = await profileService.deactivateServiceOffering(auth.stylistId!, id);
    sendData(reply, offering);
  });

  app.get('/portfolio', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const items = await profileService.listPortfolioItems(auth.stylistId!);
    sendData(reply, items);
  });

  app.post('/portfolio', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = createPortfolioItemRequestSchema.parse(request.body ?? {});
    const item = await profileService.createPortfolioItemFromUrl(auth.stylistId!, body);
    sendData(reply, item, 201);
  });

  app.patch('/portfolio/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const body = updatePortfolioItemRequestSchema.parse(request.body);
    const item = await profileService.updatePortfolioItem(auth.stylistId!, id, body);
    sendData(reply, item);
  });

  app.delete('/portfolio/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    await profileService.deletePortfolioItem(auth.stylistId!, id);
    sendData(reply, { status: 'deleted' });
  });
};
