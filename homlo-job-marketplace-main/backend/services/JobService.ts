import type { Category, Job, JobMedia, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import type { StorageAdapter } from "../infrastructure/storage/StorageAdapter";
import {
  type CreateJob,
  PostgresJobMediaRepository,
  PostgresJobRepository,
  type UpdateJob,
} from "../repositories/JobRepository";

export type JobDetail = {
  job: Job;
  category: Category | null;
  media: (JobMedia & { url: string })[];
};

/** Owns all job-level authorization rules; database policies remain defense in depth. */
export class JobService {
  constructor(
    private readonly database: DatabaseAdapter,
    private readonly storage: StorageAdapter,
  ) {}

  async postJob(employerId: UUID, jobData: Omit<CreateJob, "employerId">): Promise<Job> {
    if (jobData.workersNeeded < 1) throw new Error("A job must request at least one worker");
    return new PostgresJobRepository(this.database).create({ ...jobData, employerId, status: "open" });
  }

  async updateJob(jobId: UUID, employerId: UUID, changes: UpdateJob): Promise<Job> {
    const job = await this.requireOwnedJob(jobId, employerId);
    const updated = await new PostgresJobRepository(this.database).update(job.id, changes);
    if (!updated) throw new Error("Job is no longer available");
    return updated;
  }

  async closeJob(jobId: UUID, employerId: UUID): Promise<Job> {
    return this.updateJob(jobId, employerId, { status: "closed" });
  }

  async getJobDetail(jobId: UUID): Promise<JobDetail | null> {
    const jobs = new PostgresJobRepository(this.database);
    const media = new PostgresJobMediaRepository(this.database);
    const job = await jobs.findById(jobId);
    if (!job) return null;

    const { rows } = await this.database.query<{ id: string; name: string; slug: string }>(
      `select id, name, slug from categories where id = $1 limit 1`,
      [job.categoryId],
    );
    const category = rows[0] ? { id: rows[0].id, name: rows[0].name, slug: rows[0].slug } : null;
    const entries = await media.listForJob(jobId);
    const resolvedMedia = await Promise.all(entries.map(async (entry) => ({ ...entry, url: await this.storage.getUrl(entry.storageKey) })));
    return { job, category, media: resolvedMedia };
  }

  private async requireOwnedJob(jobId: UUID, employerId: UUID): Promise<Job> {
    const job = await new PostgresJobRepository(this.database).findById(jobId);
    if (!job) throw new Error("Job not found");
    if (job.employerId !== employerId) throw new Error("Only the listing employer can update this job");
    return job;
  }
}
