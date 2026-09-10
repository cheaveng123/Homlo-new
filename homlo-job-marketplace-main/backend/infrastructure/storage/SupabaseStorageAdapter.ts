import type { StorageAdapter } from "./StorageAdapter";
import { SupabaseAdapter } from "../database/SupabaseAdapter";

export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(
    private readonly supabase: SupabaseAdapter,
    private readonly bucket: string,
  ) {}

  getUrl(key: string): Promise<string> {
    return this.supabase.getStorageUrl(this.bucket, key);
  }

  upload(key: string, file: Uint8Array, contentType: string): Promise<void> {
    return this.supabase.uploadStorage(this.bucket, key, file, contentType);
  }

  delete(key: string): Promise<void> {
    return this.supabase.deleteStorage(this.bucket, key);
  }
}
