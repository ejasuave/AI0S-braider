import type { FastifyPluginAsync } from 'fastify';
import { directorySearchQuerySchema } from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { profileService } from '../profile/service.js';

export const directoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stylists', async (request, reply) => {
    const query = directorySearchQuerySchema.parse(request.query);
    const result = await profileService.searchDirectory(query);
    sendData(reply, result);
  });

  app.get<{ Params: { stylistId: string } }>('/stylists/:stylistId', async (request, reply) => {
    const detail = await profileService.getDirectoryStylist(request.params.stylistId);
    sendData(reply, detail);
  });
};
