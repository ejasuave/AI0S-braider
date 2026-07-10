import { z } from 'zod';

export const pingResponseSchema = z.object({
  pong: z.literal(true),
  timestamp: z.string().datetime(),
  service: z.string(),
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
