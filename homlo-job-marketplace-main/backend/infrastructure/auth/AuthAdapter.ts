export type ExternalIdentity = {
  provider: "supabase";
  providerUserId: string;
};

export type VerifiedExternalUser = ExternalIdentity & {
  email: string | null;
  fullName: string | null;
};

export interface AuthAdapter {
  verifyToken(token: string): Promise<VerifiedExternalUser | null>;
  getExternalUserId(token: string): Promise<ExternalIdentity | null>;
}
