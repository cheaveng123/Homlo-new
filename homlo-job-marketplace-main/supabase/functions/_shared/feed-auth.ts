export type FeedAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function authorizeFeedRequest(
  configuredSecret: string,
  providedSecret: string | null,
): FeedAuthResult {
  if (!configuredSecret) {
    return { ok: false, status: 503, error: "Public feed is not configured" };
  }
  if (!providedSecret || !timingSafeEqual(providedSecret, configuredSecret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
