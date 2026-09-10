import type { Profile, ProfileRole, User, UserIdentity, UserStatus, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export type CreateUser = { status?: UserStatus };
export type CreateProfile = Pick<Profile, "role" | "fullName"> & Partial<Pick<Profile, "phone" | "profilePhotoKey" | "bio" | "locationText" | "latitude" | "longitude">>;
export type UpdateProfile = Partial<Omit<CreateProfile, "role">> & { role?: ProfileRole };

export interface UserRepository {
  findById(id: UUID, includeDeleted?: boolean): Promise<User | null>;
  create(input?: CreateUser): Promise<User>;
  softDelete(id: UUID): Promise<void>;
  updateStatus(id: UUID, status: UserStatus): Promise<User | null>;
}

export interface UserIdentityRepository {
  findByProvider(provider: string, providerUserId: string): Promise<UserIdentity | null>;
  linkIdentity(userId: UUID, provider: string, providerUserId: string): Promise<UserIdentity>;
  unlinkIdentity(id: UUID): Promise<void>;
}

export interface ProfileRepository {
  findByUserId(userId: UUID, includeDeleted?: boolean): Promise<Profile | null>;
  create(userId: UUID, input: CreateProfile): Promise<Profile>;
  update(userId: UUID, input: UpdateProfile): Promise<Profile | null>;
  softDelete(userId: UUID): Promise<void>;
}

export class PostgresUserRepository extends Repository<User> implements UserRepository {
  readonly modelName = "users";
  constructor(database: DatabaseAdapter) { super(database); }

  async findById(id: UUID, includeDeleted = false): Promise<User | null> {
    const filter = includeDeleted ? "" : " and deleted_at is null";
    const { rows } = await this.database.query<UserRow>(`select id, status, created_at, updated_at, deleted_at from users where id = $1${filter} limit 1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(input: CreateUser = {}): Promise<User> {
    const { rows } = await this.database.query<UserRow>(`insert into users (status) values ($1) returning id, status, created_at, updated_at, deleted_at`, [input.status ?? "active"]);
    return toUser(requiredRow(rows, "create user"));
  }

  async softDelete(id: UUID): Promise<void> {
    await this.database.query(`update users set deleted_at = now() where id = $1 and deleted_at is null`, [id]);
  }

  async updateStatus(id: UUID, status: UserStatus): Promise<User | null> {
    const { rows } = await this.database.query<UserRow>(`update users set status = $2 where id = $1 and deleted_at is null returning id, status, created_at, updated_at, deleted_at`, [id, status]);
    return rows[0] ? toUser(rows[0]) : null;
  }
}

export class PostgresUserIdentityRepository extends Repository<UserIdentity> implements UserIdentityRepository {
  readonly modelName = "user_identities";
  constructor(database: DatabaseAdapter) { super(database); }

  async findByProvider(provider: string, providerUserId: string): Promise<UserIdentity | null> {
    const { rows } = await this.database.query<UserIdentityRow>(`select id, user_id, provider, provider_user_id, created_at, deleted_at from user_identities where provider = $1 and provider_user_id = $2 and deleted_at is null limit 1`, [provider, providerUserId]);
    return rows[0] ? toIdentity(rows[0]) : null;
  }

  async linkIdentity(userId: UUID, provider: string, providerUserId: string): Promise<UserIdentity> {
    const { rows } = await this.database.query<UserIdentityRow>(`insert into user_identities (user_id, provider, provider_user_id) values ($1, $2, $3) returning id, user_id, provider, provider_user_id, created_at, deleted_at`, [userId, provider, providerUserId]);
    return toIdentity(requiredRow(rows, "link identity"));
  }

  async unlinkIdentity(id: UUID): Promise<void> {
    await this.database.query(`update user_identities set deleted_at = now() where id = $1 and deleted_at is null`, [id]);
  }
}

export class PostgresProfileRepository extends Repository<Profile> implements ProfileRepository {
  readonly modelName = "profiles";
  constructor(database: DatabaseAdapter) { super(database); }

  async findByUserId(userId: UUID, includeDeleted = false): Promise<Profile | null> {
    const filter = includeDeleted ? "" : " and deleted_at is null";
    const { rows } = await this.database.query<ProfileRow>(`select * from profiles where user_id = $1${filter} limit 1`, [userId]);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async create(userId: UUID, input: CreateProfile): Promise<Profile> {
    const { rows } = await this.database.query<ProfileRow>(`insert into profiles (user_id, role, full_name, phone, profile_photo_key, bio, location_text, latitude, longitude) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`, [userId, input.role, input.fullName, input.phone ?? null, input.profilePhotoKey ?? null, input.bio ?? null, input.locationText ?? null, input.latitude ?? null, input.longitude ?? null]);
    return toProfile(requiredRow(rows, "create profile"));
  }

  async update(userId: UUID, input: UpdateProfile): Promise<Profile | null> {
    const existing = await this.findByUserId(userId);
    if (!existing) return null;
    const next = { ...existing, ...input };
    const { rows } = await this.database.query<ProfileRow>(`update profiles set role = $2, full_name = $3, phone = $4, profile_photo_key = $5, bio = $6, location_text = $7, latitude = $8, longitude = $9 where user_id = $1 and deleted_at is null returning *`, [userId, next.role, next.fullName, next.phone, next.profilePhotoKey, next.bio, next.locationText, next.latitude, next.longitude]);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async softDelete(userId: UUID): Promise<void> {
    await this.database.query(`update profiles set deleted_at = now() where user_id = $1 and deleted_at is null`, [userId]);
  }
}

type UserRow = { id: string; status: UserStatus; created_at: Date; updated_at: Date; deleted_at: Date | null };
type UserIdentityRow = { id: string; user_id: string; provider: string; provider_user_id: string; created_at: Date; deleted_at: Date | null };
type ProfileRow = { user_id: string; role: ProfileRole; full_name: string; phone: string | null; profile_photo_key: string | null; bio: string | null; location_text: string | null; latitude: number | null; longitude: number | null; created_at: Date; updated_at: Date; deleted_at: Date | null };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toUser = (row: UserRow): User => ({ id: row.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
const toIdentity = (row: UserIdentityRow): UserIdentity => ({ id: row.id, userId: row.user_id, provider: row.provider, providerUserId: row.provider_user_id, createdAt: row.created_at, deletedAt: row.deleted_at });
const toProfile = (row: ProfileRow): Profile => ({ userId: row.user_id, role: row.role, fullName: row.full_name, phone: row.phone, profilePhotoKey: row.profile_photo_key, bio: row.bio, locationText: row.location_text, latitude: row.latitude, longitude: row.longitude, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
