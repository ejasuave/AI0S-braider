export interface StorageUploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageUploadResult {
  key: string;
  publicUrl: string;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
}
