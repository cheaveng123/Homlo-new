import * as SecureStore from "@/lib/native/secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

const REFRESH_TOKEN_KEY = "homlo_supabase_refresh_token";

const secureStoreReadWarnings = new Set<string>();

function warnSecureStoreReadOnce(key: string, error: unknown): void {
  if (secureStoreReadWarnings.has(key)) return;
  secureStoreReadWarnings.add(key);
  console.warn(`[Auth] Secure store read for "${key}" failed once; continuing as guest.`, error);
}

export type User = {
  id: string | number;
  openId?: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn?: Date;
  status?: "active" | "suspended" | "banned";
  profileComplete?: boolean;
  role?: "worker" | "employer" | "both" | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number | null;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    return token;
  } catch (error) {
    warnSecureStoreReadOnce(SESSION_TOKEN_KEY, error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch (error) {
    console.error("[Auth] Failed to store the secure session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear the secure session token:", error);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    warnSecureStoreReadOnce(REFRESH_TOKEN_KEY, error);
    return null;
  }
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([
    SecureStore.setItemAsync(SESSION_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
  ]);
}

export async function clearAuthSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([SecureStore.deleteItemAsync(SESSION_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      // Use localStorage for web
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      // Use SecureStore for native
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      return null;
    }
    return JSON.parse(info) as User;
  } catch (error) {
    console.error("[Auth] Failed to read user information:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("[Auth] Failed to store user information:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}
