/** File picking with the expo-document-picker-style API the app uses. */
import { errorCodes, isErrorWithCode, keepLocalCopy, pick } from "@react-native-documents/picker";

export type DocumentPickerAsset = { uri: string; name: string; size?: number; mimeType?: string };

export type DocumentPickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: DocumentPickerAsset[] };

export async function getDocumentAsync(options?: {
  type?: string | string[];
  multiple?: boolean;
  copyToCacheDirectory?: boolean;
}): Promise<DocumentPickerResult> {
  try {
    const types = options?.type ? (Array.isArray(options.type) ? options.type : [options.type]) : undefined;
    const files = await pick({ type: types, allowMultiSelection: options?.multiple ?? false });
    let assets: DocumentPickerAsset[] = files.map((f) => ({
      uri: f.uri,
      name: f.name ?? "document",
      size: f.size ?? undefined,
      mimeType: f.type ?? undefined,
    }));
    if (options?.copyToCacheDirectory !== false) {
      const copies = await keepLocalCopy({
        files: files.map((f) => ({ uri: f.uri, fileName: f.name ?? "document" })) as never,
        destination: "cachesDirectory",
      });
      assets = assets.map((a, i) => {
        const copy = copies[i];
        return copy && copy.status === "success" ? { ...a, uri: copy.localUri } : a;
      });
    }
    return { canceled: false, assets };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return { canceled: true, assets: null };
    }
    throw error;
  }
}
