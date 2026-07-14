import { describe, expect, it } from 'vitest';
import { googleEventBoundaryToIso } from './google-client.js';

describe('googleEventBoundaryToIso', () => {
  it('parses dateTime boundaries', () => {
    expect(googleEventBoundaryToIso({ dateTime: '2026-07-15T09:00:00Z' }, false)).toBe(
      '2026-07-15T09:00:00.000Z',
    );
  });

  it('parses all-day date boundaries', () => {
    expect(googleEventBoundaryToIso({ date: '2026-07-15' }, false)).toBe(
      '2026-07-15T00:00:00.000Z',
    );
    expect(googleEventBoundaryToIso({ date: '2026-07-15' }, true)).toBe('2026-07-15T23:59:59.000Z');
  });
});
