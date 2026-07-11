import { describe, expect, it } from 'vitest';
import { redactSensitiveLogFields } from './logger.js';

describe('redactSensitiveLogFields', () => {
  it('redacts phone_number and other known PII keys', () => {
    const redacted = redactSensitiveLogFields({
      phone_number: '+447700900123',
      email: 'client@example.com',
      message: 'hello',
    });
    expect(redacted.phone_number).not.toBe('+447700900123');
    expect(redacted.email).not.toBe('client@example.com');
    expect(redacted.message).toBe('hello');
  });

  it('redacts nested sensitive fields', () => {
    const redacted = redactSensitiveLogFields({
      user: { phoneNumber: '+447700900123', id: 'abc' },
    });
    const user = redacted.user as Record<string, unknown>;
    expect(user.phoneNumber).not.toBe('+447700900123');
    expect(user.id).toBe('abc');
  });
});
