import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applications, type InsertApplication, type InsertJobSeekerProfile, InsertUser, jobSeekerProfiles, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === undefined) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getApplicationForUser(userId: number, jobId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)))
    .limit(1);
  return result[0];
}

export async function getJobSeekerProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function saveJobSeekerProfile(userId: number, input: Omit<InsertJobSeekerProfile, "id" | "userId" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Your profile is temporarily unavailable. Please try again.");
  const values = { userId, ...input };
  await db.insert(jobSeekerProfiles).values(values).onDuplicateKeyUpdate({ set: input });
  const profile = await getJobSeekerProfile(userId);
  if (!profile) throw new Error("Your profile could not be saved. Please try again.");
  return profile;
}

export async function listApplicationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.submittedAt));
}

export async function listApplicationsForJob(jobId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: applications.id,
      userId: applications.userId,
      jobId: applications.jobId,
      availability: applications.availability,
      note: applications.note,
      status: applications.status,
      submittedAt: applications.submittedAt,
      updatedAt: applications.updatedAt,
      applicantName: users.name,
      applicantEmail: users.email,
      headline: jobSeekerProfiles.headline,
      profileLocation: jobSeekerProfiles.location,
      bio: jobSeekerProfiles.bio,
      skills: jobSeekerProfiles.skills,
    })
    .from(applications)
    .leftJoin(users, eq(applications.userId, users.id))
    .leftJoin(jobSeekerProfiles, eq(applications.userId, jobSeekerProfiles.userId))
    .where(eq(applications.jobId, jobId))
    .orderBy(desc(applications.submittedAt));
}

export async function getApplicationForEmployer(applicationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: applications.id,
      userId: applications.userId,
      jobId: applications.jobId,
      availability: applications.availability,
      note: applications.note,
      status: applications.status,
      submittedAt: applications.submittedAt,
      updatedAt: applications.updatedAt,
      applicantName: users.name,
      applicantEmail: users.email,
      headline: jobSeekerProfiles.headline,
      profileLocation: jobSeekerProfiles.location,
      bio: jobSeekerProfiles.bio,
      skills: jobSeekerProfiles.skills,
    })
    .from(applications)
    .leftJoin(users, eq(applications.userId, users.id))
    .leftJoin(jobSeekerProfiles, eq(applications.userId, jobSeekerProfiles.userId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  return result[0];
}

export async function updateApplicationStatus(applicationId: number, status: "submitted" | "under_review" | "interview" | "accepted" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Applications are temporarily unavailable. Please try again.");
  await db.update(applications).set({ status }).where(eq(applications.id, applicationId));
  const updated = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!updated[0]) throw new Error("This application could not be updated. Please try again.");
  return updated[0];
}

export async function submitApplication(input: Pick<InsertApplication, "userId" | "jobId" | "availability" | "note">) {
  const db = await getDb();
  if (!db) throw new Error("Applications are temporarily unavailable. Please try again.");

  const existing = await getApplicationForUser(input.userId, input.jobId);
  if (existing) return { application: existing, alreadyApplied: true } as const;

  await db.insert(applications).values({ ...input, note: input.note?.trim() || null, status: "submitted" });
  const application = await getApplicationForUser(input.userId, input.jobId);
  if (!application) throw new Error("Your application could not be saved. Please try again.");
  return { application, alreadyApplied: false } as const;
}
