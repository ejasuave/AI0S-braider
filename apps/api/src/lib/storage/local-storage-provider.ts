import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  PresignedUploadInput,
  PresignedUploadResult,
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from './storage-provider.js';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const DEFAULT_EXPIRES_SECONDS = 900;

function getUploadSecret(): string {
  return process.env.STORAGE_UPLOAD_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev-upload-secret';
}

function signUploadToken(payload: { key: string; contentType: string; expiresAt: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getUploadSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyUploadToken(token: string): {
  key: string;
  contentType: string;
  expiresAt: number;
} {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    throw new Error('Invalid upload token');
  }

  const expected = createHmac('sha256', getUploadSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid upload token signature');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    key: string;
    contentType: string;
    expiresAt: number;
  };

  if (Date.now() > payload.expiresAt) {
    throw new Error('Upload token expired');
  }

  return payload;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const filePath = path.join(UPLOAD_ROOT, input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);

    return {
      key: input.key,
      publicUrl: `/uploads/${input.key.replace(/\\/g, '/')}`,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_ROOT, key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async createPresignedUploadUrl(input: PresignedUploadInput): Promise<PresignedUploadResult> {
    const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS;
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const uploadToken = signUploadToken({
      key: input.key,
      contentType: input.contentType,
      expiresAt,
    });

    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
    return {
      uploadUrl: `${apiBase}/api/v1/storage/presigned-upload`,
      uploadToken,
      publicUrl: `/uploads/${input.key.replace(/\\/g, '/')}`,
      storageKey: input.key,
      expiresInSeconds,
    };
  }
}

export function createLocalStorageProvider(): StorageProvider {
  return new LocalStorageProvider();
}

export function createPortfolioStorageKey(businessId: string, extension: string): string {
  const suffix = randomBytes(8).toString('hex');
  return `portfolio/${businessId}/${suffix}.${extension}`;
}

export function createProfilePhotoStorageKey(stylistId: string, extension: string): string {
  const suffix = randomBytes(8).toString('hex');
  return `profile-photos/${stylistId}/${suffix}.${extension}`;
}
