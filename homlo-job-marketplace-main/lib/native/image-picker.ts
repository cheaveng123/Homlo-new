/**
 * Photo picking with the expo-image-picker-style API the app uses, backed by
 * react-native-image-picker. Both system pickers need no runtime permission on
 * current iOS/Android (the OS photo picker runs out of process), so the
 * permission helpers report "granted"; the camera asks the OS itself.
 *
 * Note: there is no built-in crop step (`allowsEditing` is ignored). Callers
 * that need a fixed shape crop afterwards (lib/profile-photo.ts).
 */
import { launchCamera, launchImageLibrary, type ImagePickerResponse } from "react-native-image-picker";

export type ImagePickerAsset = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
  base64?: string | null;
};

export type ImagePickerOptions = {
  mediaTypes?: ("images" | "videos")[];
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  base64?: boolean;
};

export type ImagePickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: ImagePickerAsset[] };

export type PermissionResponse = { status: "granted" | "denied"; granted: boolean; canAskAgain: boolean };

const GRANTED: PermissionResponse = { status: "granted", granted: true, canAskAgain: true };

export async function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse> {
  return GRANTED;
}

export async function requestCameraPermissionsAsync(): Promise<PermissionResponse> {
  return GRANTED;
}

type Quality = 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;

function toQuality(q: number | undefined): Quality {
  const clamped = Math.min(1, Math.max(0, q ?? 1));
  return (Math.round(clamped * 10) / 10) as Quality;
}

function toResult(res: ImagePickerResponse): ImagePickerResult {
  if (res.didCancel || res.errorCode || !res.assets?.length) {
    if (res.errorCode && res.errorCode !== "camera_unavailable") {
      throw new Error(res.errorMessage || res.errorCode);
    }
    return { canceled: true, assets: null };
  }
  const assets = res.assets
    .filter((a) => !!a.uri)
    .map((a) => ({
      uri: a.uri!,
      width: a.width ?? 0,
      height: a.height ?? 0,
      fileName: a.fileName ?? null,
      fileSize: a.fileSize,
      mimeType: a.type,
      base64: a.base64 ?? null,
    }));
  return assets.length ? { canceled: false, assets } : { canceled: true, assets: null };
}

function mediaType(options?: ImagePickerOptions): "photo" | "video" | "mixed" {
  const types = options?.mediaTypes ?? ["images"];
  if (types.includes("images") && types.includes("videos")) return "mixed";
  return types.includes("videos") ? "video" : "photo";
}

export async function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult> {
  return toResult(
    await launchImageLibrary({
      mediaType: mediaType(options),
      quality: toQuality(options?.quality),
      includeBase64: options?.base64 ?? false,
      selectionLimit: 1,
    }),
  );
}

export async function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult> {
  return toResult(
    await launchCamera({
      mediaType: mediaType(options),
      quality: toQuality(options?.quality),
      includeBase64: options?.base64 ?? false,
      saveToPhotos: false,
    }),
  );
}
