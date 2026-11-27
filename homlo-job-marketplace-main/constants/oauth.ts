// Named import only: a namespace import (`import * as ReactNative`) enumerates
// every lazy getter on react-native's index, including deprecated ones that no
// longer resolve, and can crash before the app mounts.
import { Linking, NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { DEEP_LINK_SCHEME } from "@/constants/deep-link";
import type { TurboModule } from "react-native";
import {
  devServerAuthorityFromBundleUrl,
  isMetroAuthority,
  parseDevServerAuthority,
  toApiAuthority,
} from "@/lib/api-base-url";


const env = {
  portal: process.env.PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.PUBLIC_APP_ID ?? "",
  ownerId: process.env.PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: DEEP_LINK_SCHEME,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

type SourceCodeTurboModule = Omit<TurboModule, "getConstants"> & { getConstants(): { scriptURL: string } };

// RN 0.86's New Architecture (bridgeless) no longer exposes the legacy
// `NativeModules.SourceCode` (it resolves to null), but the same `SourceCode`
// TurboModule stays registered and is reachable through the public
// `TurboModuleRegistry`. `devServerAuthorityFromBundleUrl` ignores non-http(s)
// bundle URLs, so release builds fall through to the explicit base URL.
function devServerAuthorityFromSourceCode(): string | null {
  try {
    const scriptURL = TurboModuleRegistry.get<SourceCodeTurboModule>("SourceCode")?.getConstants?.().scriptURL;
    return devServerAuthorityFromBundleUrl(scriptURL ?? null);
  } catch {
    return null;
  }
}

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  const isNative = Platform.OS !== "web";

  // If API_BASE_URL is set, use it. The one exception is a native dev build
  // configured to point at the Metro bundler (e.g. PUBLIC_API_BASE_URL was
  // exported as :8081): the bundler would answer API calls with HTML, so fall
  // through and derive the API host instead.
  if (API_BASE_URL) {
    if (__DEV__ && isNative && isMetroAuthority(parseDevServerAuthority(API_BASE_URL))) {
      console.warn(
        `[getApiBaseUrl] PUBLIC_API_BASE_URL (${API_BASE_URL}) points at the Metro dev server; ` +
          "using the API port :3000 instead. Unset it in the Metro shell to silence this warning.",
      );
    } else {
      return API_BASE_URL.replace(/\/$/, "");
    }
  }

  // On web, derive from current hostname by replacing the Metro dev port with the API port
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    // Local dev on any Metro port (8081, 8082, …) -> API server on :3000
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port) {
      return `${protocol}//${hostname}:3000`;
    }
    // Pattern: 80xx-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^80\d{2}-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
    // Already an API-style preview host (3000-…/api-…): keep it as-is
    if (/^(3000|api)-/.test(hostname)) {
      return `${protocol}//${hostname}`;
    }
    // Production origin without an explicit API host: keep the host so requests
    // never collapse into same-origin relative URLs that silently 404.
    return `${protocol}//${hostname}`;
  }

  // On native dev builds, derive the API host from the Metro dev server the JS
  // bundle was loaded from (the `SourceCode` TurboModule, read above) and swap
  // its port for the API port.
  if (isNative) {
    const devServerAuthority =
      devServerAuthorityFromSourceCode() ??
      devServerAuthorityFromBundleUrl(NativeModules.SourceCode?.scriptURL);
    if (devServerAuthority) {
      return `http://${toApiAuthority(devServerAuthority)}`;
    }
  }

  console.warn("[getApiBaseUrl] No API base URL is configured. Set PUBLIC_API_BASE_URL for production builds.");
  // Fallback to localhost API server for native development so fetch() has an
  // absolute URL to call (relative URLs do not work on React Native).
  // On iOS Simulator, "localhost" refers to the host Mac.
  // On Android Emulator, "10.0.2.2" refers to the host machine.
  if (isNative) return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return `${env.deepLinkScheme}://oauth/callback`;
  }
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    // 可考虑抛出错误或返回错误状态，让调用方处理
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
    // 可考虑抛出错误让调用方处理
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
