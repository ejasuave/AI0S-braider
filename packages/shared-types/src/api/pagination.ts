import { z } from 'zod';

/** Ch.2.3 — shared pagination query params for list endpoints. */
export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative().optional(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
