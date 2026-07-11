import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { sendData } from '../../lib/http.js';
import { ApiError } from '../../lib/errors.js';
import { requireStylist } from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { profileService } from './service.js';

export const profileUploadRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });

  app.post('/portfolio/upload', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const file = await request.file();
    if (!file) {
      throw ApiError.validation('Image file is required');
    }

    const buffer = await file.toBuffer();
    const item = await profileService.uploadPortfolioImage(
      auth.stylistId!,
      {
        buffer,
        contentType: file.mimetype,
        filename: file.filename,
      },
      undefined,
    );
    sendData(reply, item, 201);
  });
};
