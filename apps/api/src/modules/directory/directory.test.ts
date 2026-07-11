import { describe, expect, it } from 'vitest';
import { directorySearchQuerySchema } from '@project-braids/shared-types/api';

describe('directorySearchQuerySchema', () => {
  it('applies defaults and caps limit', () => {
    const parsed = directorySearchQuerySchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it('parses search filters', () => {
    const parsed = directorySearchQuerySchema.parse({
      q: 'knotless',
      location: 'Peckham',
      style: 'box braids',
      limit: '10',
      offset: '5',
    });
    expect(parsed.q).toBe('knotless');
    expect(parsed.location).toBe('Peckham');
    expect(parsed.style).toBe('box braids');
    expect(parsed.limit).toBe(10);
    expect(parsed.offset).toBe(5);
  });

  it('rejects excessive page size', () => {
    expect(() => directorySearchQuerySchema.parse({ limit: 100 })).toThrow();
  });
});
