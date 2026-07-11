import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** Ch.3.3 — encrypt OAuth tokens at rest for future calendar sync (Ch.8). */
export function encryptAtRest(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptAtRest(ciphertext: string, secret: string): string {
  const buffer = Buffer.from(ciphertext, 'base64url');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
