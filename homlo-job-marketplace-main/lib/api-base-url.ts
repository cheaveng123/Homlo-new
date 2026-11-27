// Pure URL helpers for resolving the API base URL in development.
// Kept free of React Native / Expo imports so they can be unit-tested directly.

// Metro/Expo bundler dev-server ports. An API base that points at one of these
// would send API requests to the bundler, which answers with its HTML app shell
// instead of JSON.
export const METRO_DEV_PORTS = new Set(["8081", "8082", "19000", "19001"]);

/** Reduce a dev-server URL or hostUri (e.g. "http://192.168.1.42:8081/index.bundle") to "host:port". */
export function parseDevServerAuthority(value?: string | null): string | null {
  if (!value) return null;
  const authority = value
    .trim()
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "")
    .replace(/^@/, "")
    .split("/")[0]
    .split("?")[0];
  return authority || null;
}

/**
 * Derive the dev-server authority from a JS bundle URL. Only `http(s)` bundle
 * URLs identify a reachable dev server; `file://` / `assets://` bundles (e.g.
 * production or release builds) must not be mistaken for a host.
 */
export function devServerAuthorityFromBundleUrl(bundleUrl?: string | null): string | null {
  if (!bundleUrl || !/^https?:\/\//i.test(bundleUrl.trim())) return null;
  return parseDevServerAuthority(bundleUrl);
}

/** Rewrite a dev-server authority to the API server port (3000). */
export function toApiAuthority(authority: string): string {
  return `${authority.replace(/:\d+$/, "")}:3000`;
}

/** True when an authority's port is a known Metro/Expo dev-server port. */
export function isMetroAuthority(authority?: string | null): boolean {
  const match = authority?.match(/:(\d+)$/);
  return match ? METRO_DEV_PORTS.has(match[1]) : false;
}
