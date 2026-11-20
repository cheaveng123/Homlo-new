/**
 * PERF: decides whether a finished write request can have changed what the
 * shared public read caches (public job list, search, ranked feed) hold.
 *
 * Previously EVERY successful POST cleared all of them — sending a chat
 * message, marking a notification read, uploading a photo, accepting terms —
 * so the next Home/Explore/Search visit for every user paid for a cold
 * database read (1–3s). Now only writes that can touch a listing clear them.
 *
 * Unknown paths still invalidate (fail safe): a new job-affecting endpoint
 * keeps working even if nobody adds it here.
 */

/** tRPC procedures that never change a public job listing. */
const NO_PUBLIC_IMPACT: readonly RegExp[] = [
  /^(homlo\.)?messaging\./,
  /^(homlo\.)?notifications\./,
  /^homlo\.profile\.uploadPhoto$/,
  /^homlo\.employer\.uploadImage$/,
  /^homlo\.applications\.markViewed$/,
  /^homlo\.reportJob$/,
  /^homlo\.account\.(setAge|setAdultStatus)$/,
  // Trust & safety (consent, verification, settings). Admin moderation can
  // hide listings, so it still invalidates.
  /^trust\.(?!admin\.)/,
];

const TRPC_PREFIX = "/api/trpc/";

/** Paths with no job-listing side effects outside tRPC. */
const NON_TRPC_NO_IMPACT: readonly string[] = [
  "/api/events",
  "/events",
  "/api/supabase-auth",
  "/api/applications/precheck",
  "/api/trust",
];

export function shouldInvalidatePublicCaches(path: string): boolean {
  if (path.startsWith(TRPC_PREFIX)) {
    const procedures = decodeURIComponent(path.slice(TRPC_PREFIX.length))
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (procedures.length === 0) return true;
    // A batch invalidates if any of its procedures can affect listings.
    return procedures.some((name) => !NO_PUBLIC_IMPACT.some((rule) => rule.test(name)));
  }
  return !NON_TRPC_NO_IMPACT.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
