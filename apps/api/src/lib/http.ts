import type { FastifyReply } from 'fastify';
import type { ApiErrorEnvelope } from '@project-braids/shared-types/api';
import { ZodError } from 'zod';
import { ApiError } from './errors.js';

export function sendApiError(reply: FastifyReply, error: ApiError): void {
  const body: ApiErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };

  const retryAfterSeconds = error.details?.retryAfterSeconds;
  if (typeof retryAfterSeconds === 'number') {
    void reply.header('Retry-After', String(retryAfterSeconds));
  }

  void reply.status(error.statusCode).send(body);
}

export function sendData<T>(reply: FastifyReply, data: T, statusCode = 200): void {
  void reply.status(statusCode).send({ data });
}

export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (error instanceof Error &&
      error.name === 'ApiError' &&
      'statusCode' in error &&
      'code' in error)
  );
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (error instanceof Error && error.name === 'ZodError');
}
