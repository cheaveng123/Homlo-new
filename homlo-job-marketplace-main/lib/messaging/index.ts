/**
 * Provider factory and global MessagingService singleton.
 *
 * Set MESSAGING_PROVIDER env var to switch providers (e.g. "supabase",
 * "stream", "sendbird"). Defaults to "supabase".
 */
import type { MessagingService } from "./service";
import { MessagingProvider } from "./provider";

const MESSAGING_PROVIDER = process.env.PUBLIC_MESSAGING_PROVIDER ?? "supabase";

let instance: MessagingService | null = null;

export async function getMessagingService(): Promise<MessagingService> {
  if (instance) {
    return instance;
  }
  console.log("[messaging:factory] creating new MessagingService instance, provider=", MESSAGING_PROVIDER);

  let provider: MessagingProvider;

  switch (MESSAGING_PROVIDER) {
    case "supabase":
    default: {
      console.log("[messaging:factory] importing SupabaseMessagingProvider");
      const { SupabaseMessagingProvider } = await import("./supabase-provider");
      provider = SupabaseMessagingProvider;
      console.log("[messaging:factory] SupabaseMessagingProvider loaded, type=", typeof provider);
      break;
    }
  }

  console.log("[messaging:factory] importing MessagingService class");
  const { MessagingService } = await import("./service");
  instance = new MessagingService(provider);
  console.log("[messaging:factory] MessagingService instance created");
  return instance;
}
