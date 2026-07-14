import type { FastifyPluginAsync } from 'fastify';
import { requireStylist } from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { realtimeHub } from './hub.js';

export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Ch.17.5 — Server-Sent Events for stylist dashboard push updates.
   * SSE chosen over WebSocket: one-directional server→client push is sufficient;
   * client actions use REST per Chapter 2 conventions.
   */
  app.get('/stylist/events', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const stylistId = auth.stylistId;
    if (!stylistId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Stylist required' } });
    }

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);

    const unsubscribe = realtimeHub.subscribe(stylistId, (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    });

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};
