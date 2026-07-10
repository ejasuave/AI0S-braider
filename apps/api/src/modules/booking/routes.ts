import type { FastifyPluginAsync } from 'fastify';
import {
  availabilityQuerySchema,
  bookingListQuerySchema,
  cancelBookingRequestSchema,
  createBookingHoldRequestSchema,
  createManualBookingRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import {
  requireAuthenticated,
  requireClient,
  requireStylist,
  requireStylistTenant,
} from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { bookingService } from './service.js';

export const bookingRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const query = bookingListQuerySchema.parse(request.query);
      const bookings = await bookingService.listBookings(auth.stylistId!, query);
      sendData(reply, bookings);
    },
  );

  app.get(
    '/availability',
    { preHandler: [requireAuthenticated] },
    async (request, reply) => {
      const query = availabilityQuerySchema.parse(request.query);
      const availability = await bookingService.getAvailability(query);
      sendData(reply, availability);
    },
  );

  app.get(
    '/:id',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.getBooking(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );

  app.post('/holds', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = createBookingHoldRequestSchema.parse(request.body);
    const booking = await bookingService.createHold(auth.user.id, body);
    sendData(reply, booking, 201);
  });

  app.post(
    '/manual',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const body = createManualBookingRequestSchema.parse(request.body);
      const booking = await bookingService.createManualBooking(auth.stylistId!, body);
      sendData(reply, booking, 201);
    },
  );

  app.post(
    '/:id/confirm',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.confirmBooking(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );

  app.post(
    '/:id/cancel',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const body = cancelBookingRequestSchema.parse(request.body ?? {});
      const booking = await bookingService.cancelBooking(auth.stylistId!, id, body);
      sendData(reply, booking);
    },
  );

  app.post(
    '/:id/complete',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.completeBooking(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );

  app.post(
    '/:id/no-show',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.markNoShow(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );
};
