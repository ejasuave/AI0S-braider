import { z } from 'zod';
import { paginationMetaSchema } from './pagination.js';

export const pingResponseSchema = z.object({
  pong: z.literal(true),
  timestamp: z.string().datetime(),
  service: z.string(),
  meta: paginationMetaSchema.optional(),
});

export type PingResponse = z.infer<typeof pingResponseSchema>;

export const exampleJobEnqueueResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal('queued'),
});

export type ExampleJobEnqueueResponse = z.infer<typeof exampleJobEnqueueResponseSchema>;

export const exampleJobStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'active', 'completed', 'failed', 'unknown']),
  result: z.string().optional(),
});

export type ExampleJobStatusResponse = z.infer<typeof exampleJobStatusResponseSchema>;

export const exampleDelayedJobRequestSchema = z.object({
  message: z.string().trim().min(1).max(200),
  delayMs: z.number().int().min(0).max(300_000).default(3000),
});

export type ExampleDelayedJobRequest = z.infer<typeof exampleDelayedJobRequestSchema>;

export const exampleDelayedJobResponseSchema = z.object({
  jobId: z.string(),
  delayMs: z.number().int().nonnegative(),
  status: z.literal('queued'),
});

export type ExampleDelayedJobResponse = z.infer<typeof exampleDelayedJobResponseSchema>;

export const opsStatusResponseSchema = z.object({
  service: z.literal('api'),
  environment: z.enum(['development', 'test', 'staging', 'production']),
  version: z.string(),
  gitSha: z.string().nullable(),
  aiReceptionistEnabled: z.boolean(),
  killSwitchActive: z.boolean(),
  /** Inferred from `STRIPE_SECRET_KEY` prefix — never returns the key itself. */
  stripeMode: z.enum(['test', 'live', 'mock']),
  timestamp: z.string().datetime(),
});

export type OpsStatusResponse = z.infer<typeof opsStatusResponseSchema>;
