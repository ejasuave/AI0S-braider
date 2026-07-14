import type { FastifyPluginAsync } from 'fastify';
import { getStorageProvider, verifyUploadToken } from '../../lib/storage/index.js';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { MAX_PORTFOLIO_IMAGE_BYTES } from './mappers.js';

export const storageRoutes: FastifyPluginAsync = async (app) => {
  for (const contentType of ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream']) {
    app.addContentTypeParser(contentType, { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body);
    });
  }

  app.put('/presigned-upload', async (request, reply) => {
    const token = (request.headers['x-upload-token'] as string | undefined)?.trim();
    if (!token) {
      throw ApiError.validation('x-upload-token header is required');
    }

    let payload: { key: string; contentType: string; expiresAt: number };
    try {
      payload = verifyUploadToken(token);
    } catch {
      throw ApiError.validation('Invalid or expired upload token');
    }

    const body = request.body;
    if (!body || !(body instanceof Buffer) || body.byteLength === 0) {
      throw ApiError.validation('Request body must be raw image bytes');
    }

    if (body.byteLength > MAX_PORTFOLIO_IMAGE_BYTES) {
      throw ApiError.validation('Image must be 5 MB or smaller');
    }

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(payload.contentType)) {
      throw ApiError.validation('Unsupported image type. Use JPEG, PNG, or WebP.');
    }

    const storage = getStorageProvider();
    const uploaded = await storage.upload({
      key: payload.key,
      body,
      contentType: payload.contentType,
    });

    sendData(reply, uploaded);
  });
};
