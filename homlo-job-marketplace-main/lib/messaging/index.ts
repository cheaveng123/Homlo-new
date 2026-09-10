/**
 * Provider factory and global MessagingService singleton.
 *
 * Set MESSAGING_PROVIDER env var to switch providers (e.g. "supabase",
 * "stream", "sendbird"). Defaults to "supabase".
 */
import type { MessagingService } from "./service";
import { MessagingProvider } from "./provider";

const MESSAGING_PROVIDER = process.env.EXPO_PUBLIC_MESSAGING_PROVIDER ?? "supabase";

let instance: MessagingService | null = null;

export async function getMessagingService(): Promise<MessagingService> {
  if (instance) return instance;

  let provider: MessagingProvider;

  switch (MESSAGING_PROVIDER) {
    case "supabase":
    default: {
      const { SupabaseMessagingProvider } = await import("./supabase-provider");
      provider = SupabaseMessagingProvider;
      break;
    }
  }

  instance = new (await import("./service")).MessagingService(provider);
  return instance;
}
