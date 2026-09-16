/** Shared contract between the client upload helpers, the tRPC procedure and the server service layer. */

/** Public Supabase Storage bucket that holds employer job images. */
export const JOB_IMAGES_BUCKET = "job-images";

/**
 * Maximum acceptable job-image payload in bytes. Images are normalized to a
 * ≤1080px JPEG before upload; this cap leaves comfortable headroom for any
 * picker/normalizer variance while still rejecting accidental oversized blobs.
 */
export const JOB_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Result of the `homlo.employer.uploadImage` procedure. */
export type JobImageUploadResult = {
  /**
   * Public, renderable URL of the stored image. The caller persists it in
   * `jobs.banner_image` on the regular job save; job cards render
   * `banner_image` directly, so a self-contained URL is required.
   */
  url: string;
};