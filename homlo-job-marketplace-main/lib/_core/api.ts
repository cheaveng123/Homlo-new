import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

export type HomloSessionUser = {
  id: string;
  status: "active" | "suspended" | "banned";
  profileComplete: boolean;
  role: "worker" | "employer" | "both" | null;
  fullName: string | null;
  email: string | null;
};

export type HomloAuthResponse = {
  user: HomloSessionUser;
  session: Auth.AuthSession | null;
};

function getHeaders(options: RequestInit): Promise<Record<string, string>> {
  return (async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Homlo-Client": Platform.OS === "web" ? "web" : "native",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (Platform.OS !== "web") {
      const token = await Auth.getSessionToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  })();
}

function previewText(text: string, max = 120): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}` : endpoint;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: await getHeaders(options),
      credentials: "include",
      signal: options.signal ?? controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const raw = await response.text();

    if (!isJson) {
      const preview = previewText(raw);
      throw new Error(
        `Expected JSON from ${url} but got ${contentType || "non-JSON"} (${response.status}): ${preview || "empty response"}`,
      );
    }

    if (!raw) {
      throw new Error(`Empty response from ${url} (${response.status})`);
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (cause) {
      const preview = previewText(raw);
      throw new Error(
        `Invalid JSON from ${url} (${response.status}): ${preview}`,
      );
    }

    if (!response.ok) {
      const errObj = (data ?? {}) as { error?: string; message?: string };
      throw new Error(errObj.error ?? errObj.message ?? `Request failed: ${response.status}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeOAuthCode(code: string, state: string): Promise<{ sessionToken: string; user: any }> {
  const params = new URLSearchParams({ code, state });
  const result = await apiCall<{ app_session_id: string; user: any }>(`/api/oauth/mobile?${params.toString()}`);
  return { sessionToken: result.app_session_id, user: result.user };
}

export async function logout(): Promise<void> {
  await apiCall<void>("/api/supabase-auth/logout", { method: "POST" });
}

export async function signUpWithEmailPassword(input: { email: string; password: string; fullName?: string }): Promise<HomloAuthResponse | { confirmationRequired: true; message: string }> {
  return apiCall("/api/supabase-auth/sign-up", { method: "POST", body: JSON.stringify(input) });
}

export async function signInWithEmailPassword(input: { email: string; password: string }): Promise<HomloAuthResponse> {
  return apiCall("/api/supabase-auth/sign-in", { method: "POST", body: JSON.stringify(input) });
}

export async function refreshSupabaseSession(refreshToken?: string): Promise<HomloAuthResponse> {
  return apiCall("/api/supabase-auth/refresh", {
    method: "POST",
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
}

export async function getSupabaseMe(): Promise<HomloSessionUser | null> {
  try {
    const result = await apiCall<{ user: HomloSessionUser }>("/api/supabase-auth/me");
    return result.user;
  } catch {
    return null;
  }
}
