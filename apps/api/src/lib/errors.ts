import type { ApiErrorCode } from '@project-braids/shared-types/api';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError('NOT_FOUND', message, 404);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable'): ApiError {
    return new ApiError('SERVICE_UNAVAILABLE', message, 503);
  }

  static validation(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError('VALIDATION_ERROR', message, 400, details);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError('INTERNAL_ERROR', message, 500);
  }
}
