import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from './storage-provider.js';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

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
}

export function createLocalStorageProvider(): StorageProvider {
  return new LocalStorageProvider();
}
