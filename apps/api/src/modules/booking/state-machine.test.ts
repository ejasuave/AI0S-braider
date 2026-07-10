import { describe, expect, it } from 'vitest';
import { assertBookingTransition, isTerminalBookingStatus } from './state-machine.js';
import { ApiError } from '../../lib/errors.js';

describe('booking state machine', () => {
  it('allows held to confirmed and cancelled', () => {
    expect(() => assertBookingTransition('held', 'confirmed')).not.toThrow();
    expect(() => assertBookingTransition('held', 'cancelled')).not.toThrow();
  });

  it('allows confirmed to completed, cancelled, and no_show', () => {
    expect(() => assertBookingTransition('confirmed', 'completed')).not.toThrow();
    expect(() => assertBookingTransition('confirmed', 'cancelled')).not.toThrow();
    expect(() => assertBookingTransition('confirmed', 'no_show')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertBookingTransition('held', 'completed')).toThrow(ApiError);
    expect(() => assertBookingTransition('completed', 'confirmed')).toThrow(ApiError);
    expect(() => assertBookingTransition('cancelled', 'held')).toThrow(ApiError);
  });

  it('identifies terminal states', () => {
    expect(isTerminalBookingStatus('completed')).toBe(true);
    expect(isTerminalBookingStatus('held')).toBe(false);
  });
});
