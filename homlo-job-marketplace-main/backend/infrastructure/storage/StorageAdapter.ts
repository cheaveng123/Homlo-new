/** Storage keys are opaque until this boundary turns them into a display URL. */
export interface StorageAdapter {
  getUrl(key: string): Promise<string>;
  upload(key: string, file: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}
