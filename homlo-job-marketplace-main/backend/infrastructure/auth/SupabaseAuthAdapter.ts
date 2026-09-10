import type { AuthAdapter, ExternalIdentity, VerifiedExternalUser } from "./AuthAdapter";
import { SupabaseAdapter } from "../database/SupabaseAdapter";

export class SupabaseAuthAdapter implements AuthAdapter {
  constructor(private readonly supabase: SupabaseAdapter) {}

  async verifyToken(token: string): Promise<VerifiedExternalUser | null> {
    const user = await this.supabase.verifySupabaseToken(token);
    if (!user) return null;
    return {
      provider: "supabase",
      providerUserId: user.id,
      email: user.email ?? null,
      fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null,
    };
  }

  async getExternalUserId(token: string): Promise<ExternalIdentity | null> {
    const verified = await this.verifyToken(token);
    return verified ? { provider: verified.provider, providerUserId: verified.providerUserId } : null;
  }
}
