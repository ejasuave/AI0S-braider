import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  availabilityQuerySchema,
  bookingListQuerySchema,
  cancelBookingRequestSchema,
  createBookingHoldRequestSchema,
  createManualBookingRequestSchema,
  partialRefundRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import {
  requireAuthenticated,
  requireBusinessPermission,
  requireClient,
  requireStylist,
} from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { bookingService } from './service.js';
import { paymentService } from '../payments/service.js';
import '../payments/events.js';
import '../notifications/events.js';

export const bookingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/mine', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const query = bookingListQuerySchema.parse(request.query);
    const bookings = await bookingService.listClientBookings(auth.user.id, query);
    sendData(reply, bookings);
  });

  app.get('/mine/:id', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const booking = await bookingService.getBookingForClient(auth.user.id, id);
    sendData(reply, booking);
  });

  app.get('/', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const query = bookingListQuerySchema.parse(request.query);
    const bookings = await bookingService.listBookings(auth.stylistId!, query);
    sendData(reply, bookings);
  });

  app.get('/availability', { preHandler: [requireAuthenticated] }, async (request, reply) => {
    const query = availabilityQuerySchema.parse(request.query);
    const availability = await bookingService.getAvailability(query);
    sendData(reply, availability);
  });

  app.get('/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const booking = await bookingService.getBooking(auth.stylistId!, id);
    sendData(reply, booking);
  });

  const holdHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = createBookingHoldRequestSchema.parse(request.body);
    const booking = await bookingService.createHold(auth.user.id, body);
    sendData(reply, booking, 201);
  };

  app.post('/holds', { preHandler: [requireClient] }, holdHandler);
  app.post('/hold', { preHandler: [requireClient] }, holdHandler);

  app.post(
    '/manual',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const body = createManualBookingRequestSchema.parse(request.body);
      const booking = await bookingService.createManualBooking(auth.stylistId!, body);
      sendData(reply, booking, 201);
    },
  );

  app.post('/:id/deposit', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const payment = await paymentService.createDepositCharge(auth.user.id, id);
    sendData(reply, payment, 201);
  });

  app.post('/:id/balance', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const payment = await paymentService.createBalanceCharge(auth.user.id, id);
    sendData(reply, payment, 201);
  });

  app.post(
    '/:id/balance/paid-in-person',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.markBalancePaidInPerson(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );

  app.post(
    '/:id/partial-refund',
    { preHandler: [requireBusinessPermission('can_view_payouts')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const body = partialRefundRequestSchema.parse(request.body);
      const payment = await paymentService.processPartialRefundForStylist(
        auth.stylistId!,
        id,
        body.amount,
      );
      sendData(reply, payment);
    },
  );

  app.post('/:id/confirm', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const booking = await bookingService.confirmBookingAsStylist(auth.stylistId!, id);
    sendData(reply, booking);
  });

  app.post('/:id/cancel', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const body = cancelBookingRequestSchema.parse(request.body ?? {});
    const result = await bookingService.cancelBooking({ stylistId: auth.stylistId! }, id, body);
    sendData(reply, result);
  });

  app.post('/mine/:id/cancel', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const body = cancelBookingRequestSchema.parse(request.body ?? {});
    const result = await bookingService.cancelBooking({ clientId: auth.user.id }, id, body);
    sendData(reply, result);
  });

  app.post('/:id/complete', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const booking = await bookingService.completeBooking(auth.stylistId!, id);
    sendData(reply, booking);
  });

  app.post(
    '/:id/approve',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const booking = await bookingService.approveBooking(auth.stylistId!, id);
      sendData(reply, booking);
    },
  );

  app.post(
    '/:id/no-show',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const result = await bookingService.markNoShow(auth.stylistId!, id);
      sendData(reply, result);
    },
  );
};
