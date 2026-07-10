import pino from 'pino';
import { getEnv } from '../config/env.js';

const PII_KEYS = new Set([
  'phone',
  'phoneNumber',
  'phone_number',
  'email',
  'password',
  'token',
  'authorization',
  'otp',
  'refreshToken',
]);

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.includes('@')) {
      const [local, domain] = value.split('@');
      return `${local?.slice(0, 1) ?? ''}***@${domain ?? 'redacted'}`;
    }
    if (value.startsWith('+') && value.length > 4) {
      return `${value.slice(0, 3)}***${value.slice(-2)}`;
    }
    return '***';
  }
  return '[redacted]';
}

function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (PII_KEYS.has(key)) {
      output[key] = redactValue(value);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = redactObject(value as Record<string, unknown>);
      continue;
    }
    output[key] = value;
  }
  return output;
}

export function createLogger() {
  const env = getEnv();
  const isDev = env.NODE_ENV === 'development';

  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        'phone',
        'email',
      ],
      censor: '[redacted]',
    },
    serializers: {
      req(request: { method?: string; url?: string; headers?: Record<string, string> }) {
        return {
          method: request.method,
          url: request.url,
          headers: request.headers ? redactObject(request.headers) : undefined,
        };
      },
      err: pino.stdSerializers.err,
    },
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
  });
}
