import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Optional career details owned and maintained by a signed-in job seeker. */
export const jobSeekerProfiles = mysqlTable(
  "jobSeekerProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    headline: varchar("headline", { length: 160 }),
    location: varchar("location", { length: 160 }),
    bio: text("bio"),
    skills: text("skills"),
    availability: varchar("availability", { length: 120 }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("job_seeker_profiles_user_unique").on(table.userId)],
);

export type JobSeekerProfile = typeof jobSeekerProfiles.$inferSelect;
export type InsertJobSeekerProfile = typeof jobSeekerProfiles.$inferInsert;

/**
 * A submitted candidate application. Job metadata remains in the marketplace catalog;
 * this record persists the user-owned submission and prevents duplicate applications.
 */
export const applications = mysqlTable(
  "applications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    jobId: varchar("jobId", { length: 120 }).notNull(),
    availability: varchar("availability", { length: 80 }).notNull(),
    note: text("note"),
    status: mysqlEnum("status", ["submitted", "under_review", "interview", "accepted", "rejected"]).default("submitted").notNull(),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("applications_user_job_unique").on(table.userId, table.jobId)],
);

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;
