/** Shared contract between the client upload helpers, the tRPC procedure and the server service layer. */

/** Public Supabase Storage bucket that holds every profile photo. */
export const PROFILE_PHOTOS_BUCKET = "profile-photos";

/**
 * Maximum acceptable profile-photo payload in bytes. Photos are normalized to
 * a ≤1080px JPEG before upload; this cap leaves comfortable headroom for any
 * picker/normalizer variance while still rejecting accidental oversized blobs.
 */
export const PROFILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Result of the `homlo.profile.uploadPhoto` procedure. */
export type ProfilePhotoUploadResult = {
  /** Storage object key inside the `profile-photos` bucket, e.g. `<user_id>/avatar-<ts>.jpg`. */
  key: string;
};