import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMediaUrl } from './media-url';

describe('resolveMediaUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for empty values', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl('')).toBeNull();
  });

  it('passes through absolute URLs', () => {
    expect(resolveMediaUrl('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
  });

  it('prefixes relative paths with the API base', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example');
    expect(resolveMediaUrl('/uploads/a.jpg')).toBe('https://api.example/uploads/a.jpg');
    expect(resolveMediaUrl('uploads/a.jpg')).toBe('https://api.example/uploads/a.jpg');
  });
});
