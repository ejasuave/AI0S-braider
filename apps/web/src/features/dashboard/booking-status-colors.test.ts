import { describe, expect, it } from 'vitest';
import { statusDotClass } from './booking-status-colors';

describe('statusDotClass', () => {
  it('maps held bookings to warning color', () => {
    expect(statusDotClass('held')).toBe('bg-warning');
  });

  it('maps confirmed bookings to primary color', () => {
    expect(statusDotClass('confirmed')).toBe('bg-primary');
  });

  it('maps completed and cancelled states distinctly', () => {
    expect(statusDotClass('completed')).toBe('bg-success');
    expect(statusDotClass('cancelled')).toBe('bg-ink-muted');
    expect(statusDotClass('no_show')).toBe('bg-ink-muted');
  });
});
