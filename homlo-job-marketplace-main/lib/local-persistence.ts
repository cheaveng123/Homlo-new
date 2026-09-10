import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export function getLocalValueSync(key: string): string | null {
  if (Platform.OS !== "web") return null;
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function getLocalValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

export async function setLocalValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    } catch {
      // Keep the UI flow available if browser storage is restricted.
    }
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeLocalValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    } catch {
      // Keep the UI flow available if browser storage is restricted.
    }
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function multiSetLocalValue(entries: [string, string][]): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined") entries.forEach(([key, value]) => window.localStorage.setItem(key, value));
    } catch {
      // Keep the UI flow available if browser storage is restricted.
    }
    return;
  }
  await AsyncStorage.multiSet(entries);
}
