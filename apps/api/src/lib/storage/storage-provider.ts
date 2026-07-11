export interface StorageUploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageUploadResult {
  key: string;
  publicUrl: string;
}

export interface PresignedUploadInput {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  uploadToken: string;
  publicUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  createPresignedUploadUrl(input: PresignedUploadInput): Promise<PresignedUploadResult>;
}
