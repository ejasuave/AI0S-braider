import { describe, expect, it } from 'vitest';
import { decryptAtRest, encryptAtRest } from './encryption.js';

describe('encryptAtRest', () => {
  it('round-trips plaintext and stores non-plaintext ciphertext', () => {
    const secret = 'test-secret-with-enough-entropy-for-aes';
    const plaintext = 'ya29.oauth-access-token-value';
    const ciphertext = encryptAtRest(plaintext, secret);

    expect(ciphertext).not.toContain(plaintext);
    expect(decryptAtRest(ciphertext, secret)).toBe(plaintext);
  });
});
