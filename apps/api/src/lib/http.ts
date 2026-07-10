import type { FastifyReply } from 'fastify';
import type { ApiErrorEnvelope } from '@project-braids/shared-types/api';
import { ApiError } from './errors.js';

export function sendApiError(reply: FastifyReply, error: ApiError): void {
  const body: ApiErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
  void reply.status(error.statusCode).send(body);
}

export function sendData<T>(reply: FastifyReply, data: T, statusCode = 200): void {
  void reply.status(statusCode).send({ data });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
