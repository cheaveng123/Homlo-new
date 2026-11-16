/**
 * Central profile-photo helpers.
 *
 * Storage contract (single source of truth):
 *   * `profiles.profile_photo_key` stores ONLY a Supabase Storage object
 *     path inside the public `profile-photos` bucket, e.g.
 *         <user_id>/avatar-<timestamp>.<ext>
 *   * never a device-local reference (ph://, file://, content://, blob:) or a
 *     data: URI — those cannot be resolved on a viewer's device.
 *
 * Every avatar in Homlo (profile, inbox, message thread, employer applicant
 * cards) MUST render through `getProfilePhotoUrl()`. Never feed a raw key from
 * the database directly into an <Image> source.
 */
import { Image } from "react-native";

import {
  PROFILE_PHOTOS_BUCKET,
  type ProfilePhotoUploadResult,
} from "./profile-photo-shared";

export { PROFILE_PHOTOS_BUCKET };

const LOCAL_PICKER_PREFIX = /^(ph|file|content|ipod-library|assets-library|blob):/i;
const DATA_URI_PREFIX = /^data:/i;
const HTTP_PREFIX = /^https?:\/\//i;
const JPEG_MIME = "image/jpeg";

/** True when a value is a device-local picker URI that must be uploaded, never persisted as-is. */
export function isLocalPickerUri(value: string | null | undefined): value is string {
  return typeof value === "string" && LOCAL_PICKER_PREFIX.test(value.trim());
}

/** True when a value is a base64 data: URI (legacy web flow). */
export function isDataUri(value: string | null | undefined): value is string {
  return typeof value === "string" && DATA_URI_PREFIX.test(value.trim());
}

/** True when a value is an already-valid https URL (legacy data). */
export function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && HTTP_PREFIX.test(value.trim());
}

/**
 * Resolve a stored `profile_photo_key` into a renderable public URL.
 *
 *   * null/empty inputs → null (default avatar)
 *   * device-local URIs and data: URIs → null (must be re-uploaded)
 *   * legacy absolute https URLs → returned unchanged
 *   * anything else → treated as a Storage object key resolved against the
 *     public `profile-photos` bucket.
 */
export function getProfilePhotoUrl(key: string | null | undefined): string | null {
  if (typeof key !== "string") return null;
  const value = key.trim();
  if (!value) return null;
  if (LOCAL_PICKER_PREFIX.test(value) || DATA_URI_PREFIX.test(value)) return null;
  if (HTTP_PREFIX.test(value)) return value;
  if (
    value.startsWith("/") ||
    value.startsWith("\\") ||
    value.includes("..") ||
    value.includes(" ") ||
    value.includes("%")
  ) {
    return null;
  }
  if (value.length > 1024) return null;
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/${value}`;
}

/**
 * Convert a local picker URI (file://, ph://, Android content, data:) into an
 * uploadable base64 data URL. On web the bytes are pulled via fetch; on native
 * the image is decoded (HEIC/HEIF, Live Photo, iCloud-downloaded assets) and
 * normalized to a JPEG data URL so only actual bytes reach the backend.
 */
export async function localImageToDataUrl(uri: string, assetBase64?: string | null): Promise<string> {
  if (isDataUri(uri)) return uri;
  if (isWebRuntime()) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(READ_ERROR_MESSAGE);
    }
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(READ_ERROR_MESSAGE));
      reader.readAsDataURL(blob);
    });
  }
  return nativeImageToJpegDataUrl(uri, assetBase64, { maxWidth: 1080, compress: 0.82 });
}

/** An asset resolved from `expo-image-picker` (has a local URI and optional base64). */
export type PickerImageAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

export type PickerImageOptions = {
  /** Maximum width the native normalizer downsizes to (0 disables resizing). */
  maxWidth?: number;
  /** JPEG quality for the normalized output (0.0-1.0). */
  compress?: number;
  /**
   * Optional width:height crop applied before the resize, centred on the image.
   * Omit it to keep the source aspect ratio (the default, and what every
   * existing caller wants). Supplied by surfaces whose preview is a fixed-ratio
   * crop — the job banner, which is displayed at the home job card's exact
   * carousel ratio — so the stored bytes and the rendered card agree.
   */
  aspect?: { width: number; height: number };
};

/**
 * Resolve a freshly-picked image asset into a JPEG data URL containing the
 * actual photo bytes. Handles:
 *   * web pickers: the browser resolves the blob/file before returning
 *   * native pickers: HEIC/HEIF, JPEG, PNG, Live Photo, and iCloud-downloaded
 *     photos are decoded by the device and re-encoded as a resized JPEG
 *   * `ph://` assets: falls back to the picker-provided base64 bytes
 */
export async function pickerImageToJpegDataUrl(
  asset: PickerImageAsset,
  options?: PickerImageOptions,
): Promise<string> {
  const uri = asset.uri?.trim();
  if (!uri) throw new Error(READ_ERROR_MESSAGE);
  if (isDataUri(uri)) return uri;
  if (isWebRuntime()) return localImageToDataUrl(uri);
  return nativeImageToJpegDataUrl(uri, asset.base64, {
    maxWidth: options?.maxWidth ?? 1080,
    compress: options?.compress ?? 0.82,
    aspect: options?.aspect,
  });
}

function isWebRuntime(): boolean {
  return typeof document !== "undefined" && typeof window !== "undefined";
}

async function nativeImageToJpegDataUrl(
  uri: string,
  assetBase64: string | null | undefined,
  options: { maxWidth: number; compress: number; aspect?: { width: number; height: number } },
): Promise<string> {
  if (/^ph:/i.test(uri) && typeof assetBase64 === "string" && assetBase64.length > 0) {
    return `data:${JPEG_MIME};base64,${assetBase64}`;
  }
  const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");
  const actions: Parameters<typeof manipulateAsync>[1] = [];
  if (options.aspect) {
    // `crop` takes an absolute origin, so the centred rectangle has to be
    // measured against the source dimensions before it can be applied.
    const { width, height } = await Image.getSize(uri);
    actions.push({ crop: centredCrop(width, height, options.aspect) });
  }
  if (options.maxWidth > 0) {
    actions.push({ resize: { width: options.maxWidth } });
  }
  const result = await manipulateAsync(uri, actions, {
    compress: options.compress,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error(READ_ERROR_MESSAGE);
  return `data:${JPEG_MIME};base64,${result.base64}`;
}

const READ_ERROR_MESSAGE = "We could not read that image. Please try another one.";

/**
 * Largest centred rectangle of the requested `width:height` ratio that fits
 * inside a `sourceWidth` x `sourceHeight` image. Never upscales, so a source
 * already narrower than the target keeps its own dimensions.
 */
function centredCrop(
  sourceWidth: number,
  sourceHeight: number,
  target: { width: number; height: number },
): { originX: number; originY: number; width: number; height: number } {
  const targetRatio = target.width / target.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const width =
    sourceRatio > targetRatio
      ? Math.round(sourceHeight * targetRatio)
      : sourceWidth;
  const height =
    sourceRatio > targetRatio
      ? sourceHeight
      : Math.round(sourceWidth / targetRatio);
  return {
    originX: Math.round((sourceWidth - width) / 2),
    originY: Math.round((sourceHeight - height) / 2),
    width,
    height,
  };
}

/**
 * Upload the selected image BYTES to the public `profile-photos` bucket and
 * return the resulting Storage object key. The caller persists that key in
 * `profiles.profile_photo_key` on the regular profile save — never the local
 * picker URI.
 */
export async function uploadProfilePhotoBytes(dataUrl: string): Promise<ProfilePhotoUploadResult> {
  const { trpcDirect } = await import("@/lib/trpc");
  return trpcDirect.homlo.profile.uploadPhoto.mutate({ photo: dataUrl });
}