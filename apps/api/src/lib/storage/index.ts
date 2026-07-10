import type { StorageProvider } from './storage-provider.js';
import { createLocalStorageProvider } from './local-storage-provider.js';

let storageProvider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = createLocalStorageProvider();
  }
  return storageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}

export type { StorageProvider, StorageUploadInput, StorageUploadResult } from './storage-provider.js';
