import type { Profile, UUID, User } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import {
  type CreateProfile,
  PostgresProfileRepository,
  PostgresUserIdentityRepository,
  PostgresUserRepository,
} from "../repositories/UserRepository";

export type ResolvedUser = { user: User; profile: Profile | null };

/** Resolves external identities into canonical Homlo users without provider coupling. */
export class UserService {
  constructor(private readonly database: DatabaseAdapter) {}

  async resolveOrCreateUser(
    authProvider: string,
    providerUserId: string,
    profileData?: CreateProfile,
  ): Promise<ResolvedUser> {
    return this.database.transaction(async (transaction) => {
      // Serialize the first-link path for a provider identity. This complements
      // the partial unique index and avoids creating an orphan user on a race.
      await transaction.query(`select pg_advisory_xact_lock(hashtext($1))`, [`${authProvider}:${providerUserId}`]);
      const users = new PostgresUserRepository(transaction);
      const identities = new PostgresUserIdentityRepository(transaction);
      const profiles = new PostgresProfileRepository(transaction);
      const identity = await identities.findByProvider(authProvider, providerUserId);

      if (identity) {
        const user = await users.findById(identity.userId);
        if (!user) throw new Error("Identity is linked to an unavailable Homlo user");
        return { user, profile: await profiles.findByUserId(user.id) };
      }

      const user = await users.create();
      await identities.linkIdentity(user.id, authProvider, providerUserId);
      const profile = profileData ? await profiles.create(user.id, profileData) : null;
      return { user, profile };
    });
  }

  async getProfile(userId: UUID): Promise<Profile | null> {
    return new PostgresProfileRepository(this.database).findByUserId(userId);
  }
}
