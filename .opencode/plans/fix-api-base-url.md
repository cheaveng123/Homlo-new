# Fix: API requests hitting the Metro dev server (HTML instead of JSON)

## Symptom
iOS (Simulator) debug app throws `Expected JSON from <url> but got text/html` on
sign-in. The app receives the Metro/Expo HTML app shell instead of API JSON.

## Root cause (proven)
- The iOS debug bundle resolved `getApiBaseUrl()` to the Metro dev-server origin
  `http://localhost:8081`.
- Evidence:
  - `lib/trpc.ts:25` builds `"${getApiBaseUrl()}/api/trpc"`; `lib/_core/api.ts:41`
    builds `"${baseUrl}/api/..."`. The iOS Simulator unified log
    (`process == "HomloJobs"`) shows **absolute** `http://localhost:8081/api/...`
    requests for both tRPC and `/api/supabase-auth/sign-in`. A relative base
    (`""`) would have produced `file://…`, not `localhost:8081`.
  - The only branch that can emit `:8081` is `constants/oauth.ts:40`
    (`if (API_BASE_URL) return API_BASE_URL`); the web and native branches both
    rewrite `:8081` → `:3000`. Confirmed against the exact bundled copy in the
    Metro cache (`b8/cb635dc…mp`, mtime matching the failing requests).
  - Therefore `EXPO_PUBLIC_API_BASE_URL === "http://localhost:8081"` at bundle
    time. In dev, Expo inlines it via
    `@expo/metro-config/build/serializer/environmentVariableSerializerPlugin.js:86`
    (`getEnvVarDevString`), which copies **all `EXPO_PUBLIC_*` from the Metro
    process env**. The user confirmed it was exported in the shell that ran Metro.
- Metro answers unknown `/api/*` paths with its HTML shell (`200 text/html`), so
  `lib/_core/api.ts:56` throws the "Expected JSON … but got text/html" error.
  Express on `:3000` was never contacted.

## Secondary findings (independent)
- Latent: on a plain `expo run:ios` debug build (`expo-dev-client` absent),
  `Constants.expoConfig?.hostUri` is unset, so if the env var were unset the
  native branch returns `""` → relative/file URLs. The native dev path is
  unreliable either way.
- Backend, must NOT be masked: the Supabase host
  `gwzknvycbzloomxhvslo.supabase.co` is NXDOMAIN, so server `signInWithPassword`
  returns `400 {"error":"fetch failed"}` even after the base URL is fixed. Real
  sign-in cannot succeed until the Supabase URL/project is corrected.

## Decisions (confirmed with user)
1. Env var was exported as `:8081` — this is the trigger.
2. Native dev host: derive from the JS bundle URL, port → 3000.
3. In dev, ignore a Metro-origin `EXPO_PUBLIC_API_BASE_URL` (warn) and use `:3000`.

## Changes

### 1. New `lib/api-base-url.ts` (pure, unit-testable, no RN/Expo imports)
- `METRO_DEV_PORTS = new Set(["8081","8082","19000","19001"])`
- `parseDevServerAuthority(value)` → `"host:port"` (strips scheme/user/path/query).
- `devServerAuthorityFromBundleUrl(bundleUrl)` → authority only for `http(s)` URLs
  (so `file://`/`assets://` production bundles are never treated as a host).
- `toApiAuthority(authority)` → replaces trailing `:port` with `:3000`.
- `isMetroAuthority(authority)` → true when the port is a Metro dev port.

### 2. `constants/oauth.ts`
- Import `NativeModules` alongside `Platform` (named import only; keeps the
  existing anti-`importAll` comment valid).
- Rewrite `getApiBaseUrl()`:
  - If `API_BASE_URL` is set **and** (not native-dev **or** not a Metro origin):
    return it trimmed of a trailing slash (production behavior unchanged).
  - Native dev with a Metro-origin `API_BASE_URL`: `console.warn(...)` and fall
    through.
  - Web branch: unchanged.
  - Native branch: authority = `parseDevServerAuthority(Constants.expoConfig?.hostUri)`
    ?? `devServerAuthorityFromBundleUrl(NativeModules.SourceCode?.scriptURL)`;
    if present return `http://${toApiAuthority(authority)}`.
  - Otherwise keep the existing warning and return `""`.

### 3. `lib/_core/api.ts` (small, keeps real errors intact)
- In the non-JSON branch, if the response is HTML, append a hint that the request
  likely never reached the API (hit the Metro/Expo dev server) and to check the
  API base URL. JSON auth errors (`400 {"error":...}`) are unchanged.

### 4. New `tests/api-base-url.test.ts`
- Covers `parseDevServerAuthority`, `devServerAuthorityFromBundleUrl` (rejects
  `file://`), `toApiAuthority` (host, host:port, IPv6), and `isMetroAuthority`.

## Verification
- `pnpm check` (tsc), `pnpm lint`, `pnpm test`.
- Start API: `node --import tsx server/_core/index.ts` (background), then
  `curl http://localhost:3000/api/health` and a native-marked sign-in POST to
  confirm JSON (expected `400 {"error":"fetch failed"}` until Supabase is fixed).
- Full simulator re-test requires restarting Metro **without**
  `EXPO_PUBLIC_API_BASE_URL` and reloading the app; then confirm requests hit
  `:3000` (optional, time permitting).

## Disclosure to report at the end
- Earlier investigation killed the user's `pnpm dev:server` processes
  (PIDs 1703/1705/1711) via `pkill`, and left `/tmp/server.log`,
  `/tmp/server2.log`, `/tmp/server2.pid`.
- Supabase project host is NXDOMAIN → still requires manual config; not masked.
- No auth architecture, navigation, session persistence, cookies, or Supabase
  integration behavior is changed.

## Scope guards
- Single source of truth: only `getApiBaseUrl()` (used by `lib/_core/api.ts:40`
  and `lib/trpc.ts:25`) changes; no other callers exist.
- Production behavior unchanged when `EXPO_PUBLIC_API_BASE_URL` is a real,
  non-Metro base URL.
