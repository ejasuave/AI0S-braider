import { describe, expect, it } from 'vitest';
import { paginationParamsSchema } from './pagination.js';

describe('paginationParamsSchema', () => {
  it('applies defaults', () => {
    const parsed = paginationParamsSchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects pageSize above max', () => {
    const result = paginationParamsSchema.safeParse({ pageSize: 500 });
    expect(result.success).toBe(false);
  });
});
