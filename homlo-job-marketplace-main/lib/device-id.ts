import { getLocalValue, setLocalValue } from "@/lib/local-persistence";

/**
 * A random id for this install, sent as X-Homlo-Device-Id. The server only
 * stores a keyed hash of it, to stop banned users from re-registering on the
 * same device. It is not an advertising id and is reset by reinstalling.
 */
const KEY = "homlo.deviceId.v1";
let cached: string | null = null;

function randomId() {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await getLocalValue(KEY);
    if (stored && /^[a-f0-9]{32}$/.test(stored)) return (cached = stored);
  } catch {
    // fall through to a fresh id
  }
  cached = randomId();
  void setLocalValue(KEY, cached).catch(() => undefined);
  return cached;
}
