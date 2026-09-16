import type { Category, Job, JobMedia, JobStatus, PayType, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export type JobSearch = { status?: JobStatus; categoryId?: UUID; near?: { lat: number; lng: number; radiusKm: number }; startDateAfter?: string };
export type CreateJob = Omit<Job, "id" | "workersHired" | "status" | "createdAt" | "updatedAt" | "deletedAt" | "requirements"> & Partial<Pick<Job, "status" | "requirements">>;
export type UpdateJob = Partial<Omit<CreateJob, "employerId">>;

export interface CategoryRepository { list(): Promise<Category[]>; findBySlug(slug: string): Promise<Category | null>; }
export interface JobRepository { findById(id: UUID): Promise<Job | null>; search(filters: JobSearch): Promise<Job[]>; create(input: CreateJob): Promise<Job>; update(id: UUID, input: UpdateJob): Promise<Job | null>; softDelete(id: UUID): Promise<void>; incrementWorkersHired(jobId: UUID): Promise<Job | null>; }
export interface JobMediaRepository { listForJob(jobId: UUID): Promise<JobMedia[]>; addMedia(jobId: UUID, storageKey: string, mediaType: JobMedia["mediaType"], position: number): Promise<JobMedia>; deleteMedia(id: UUID): Promise<void>; }

export class PostgresCategoryRepository extends Repository<Category> implements CategoryRepository {
  readonly modelName = "categories";
  constructor(database: DatabaseAdapter) { super(database); }
  async list(): Promise<Category[]> { const { rows } = await this.database.query<CategoryRow>(`select id, name, slug from categories order by name asc`); return rows.map(toCategory); }
  async findBySlug(slug: string): Promise<Category | null> { const { rows } = await this.database.query<CategoryRow>(`select id, name, slug from categories where slug = $1 limit 1`, [slug]); return rows[0] ? toCategory(rows[0]) : null; }
}

export class PostgresJobRepository extends Repository<Job> implements JobRepository {
  readonly modelName = "jobs";
  constructor(database: DatabaseAdapter) { super(database); }
  async findById(id: UUID): Promise<Job | null> { const { rows } = await this.database.query<JobRow>(`select * from jobs where id = $1 and deleted_at is null limit 1`, [id]); return rows[0] ? toJob(rows[0]) : null; }
  async search(filters: JobSearch): Promise<Job[]> {
    const clauses = ["deleted_at is null"];
    const parameters: (string | number)[] = [];
    const param = (value: string | number) => { parameters.push(value); return `$${parameters.length}`; };
    if (filters.status) clauses.push(`status = ${param(filters.status)}`);
    if (filters.categoryId) clauses.push(`category_id = ${param(filters.categoryId)}`);
    if (filters.startDateAfter) clauses.push(`start_date >= ${param(filters.startDateAfter)}`);
    if (filters.near) {
      const { lat, lng, radiusKm } = filters.near;
      const latitudeDelta = radiusKm / 111;
      const longitudeDelta = radiusKm / Math.max(1, 111 * Math.cos((lat * Math.PI) / 180));
      clauses.push(`latitude between ${param(lat - latitudeDelta)} and ${param(lat + latitudeDelta)} and longitude between ${param(lng - longitudeDelta)} and ${param(lng + longitudeDelta)}`);
    }
    const { rows } = await this.database.query<JobRow>(`select * from jobs where ${clauses.join(" and ")} order by created_at desc`, parameters);
    return rows.map(toJob);
  }
  async create(input: CreateJob): Promise<Job> {
    const { rows } = await this.database.query<JobRow>(`insert into jobs (employer_id, category_id, title, description, requirements, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, start_date, end_date, start_time, end_time, workers_needed, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) returning *`, [input.employerId, input.categoryId, input.title, input.description, input.requirements ?? null, input.payAmount, input.payCurrency, input.payType, input.locationText, input.latitude, input.longitude, input.startDate, input.endDate, input.startTime, input.endTime, input.workersNeeded, input.status ?? "open"]);
    return toJob(requiredRow(rows, "create job"));
  }
  async update(id: UUID, input: UpdateJob): Promise<Job | null> {
    const existing = await this.findById(id); if (!existing) return null;
    const next = { ...existing, ...input };
    const { rows } = await this.database.query<JobRow>(`update jobs set category_id = $2, title = $3, description = $4, requirements = $5, pay_amount = $6, pay_currency = $7, pay_type = $8, location_text = $9, latitude = $10, longitude = $11, start_date = $12, end_date = $13, start_time = $14, end_time = $15, workers_needed = $16, status = $17 where id = $1 and deleted_at is null returning *`, [id, next.categoryId, next.title, next.description, next.requirements ?? null, next.payAmount, next.payCurrency, next.payType, next.locationText, next.latitude, next.longitude, next.startDate, next.endDate, next.startTime, next.endTime, next.workersNeeded, next.status]);
    return rows[0] ? toJob(rows[0]) : null;
  }
  async softDelete(id: UUID): Promise<void> { await this.database.query(`update jobs set deleted_at = now() where id = $1 and deleted_at is null`, [id]); }
  async incrementWorkersHired(jobId: UUID): Promise<Job | null> { const { rows } = await this.database.query<JobRow>(`update jobs set workers_hired = workers_hired + 1 where id = $1 and deleted_at is null and workers_hired < workers_needed returning *`, [jobId]); return rows[0] ? toJob(rows[0]) : null; }
}

export class PostgresJobMediaRepository extends Repository<JobMedia> implements JobMediaRepository {
  readonly modelName = "job_media";
  constructor(database: DatabaseAdapter) { super(database); }
  async listForJob(jobId: UUID): Promise<JobMedia[]> { const { rows } = await this.database.query<JobMediaRow>(`select id, job_id, storage_key, media_type, position, created_at from job_media where job_id = $1 order by position asc`, [jobId]); return rows.map(toMedia); }
  async addMedia(jobId: UUID, storageKey: string, mediaType: JobMedia["mediaType"], position: number): Promise<JobMedia> { const { rows } = await this.database.query<JobMediaRow>(`insert into job_media (job_id, storage_key, media_type, position) values ($1, $2, $3, $4) returning id, job_id, storage_key, media_type, position, created_at`, [jobId, storageKey, mediaType, position]); return toMedia(requiredRow(rows, "add job media")); }
  async deleteMedia(id: UUID): Promise<void> { await this.database.query(`delete from job_media where id = $1`, [id]); }
}

type CategoryRow = { id: string; name: string; slug: string };
type JobRow = { id: string; employer_id: string; category_id: string | null; title: string; description: string; requirements: string | null; pay_amount: number | string; pay_currency: string; pay_type: PayType; location_text: string | null; latitude: number | null; longitude: number | null; start_date: string | null; end_date: string | null; start_time: string | null; end_time: string | null; workers_needed: number; workers_hired: number; status: JobStatus; created_at: Date; updated_at: Date; deleted_at: Date | null };
type JobMediaRow = { id: string; job_id: string; storage_key: string; media_type: "image" | "video"; position: number; created_at: Date };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toCategory = (row: CategoryRow): Category => ({ id: row.id, name: row.name, slug: row.slug });
const toJob = (row: JobRow): Job => ({ id: row.id, employerId: row.employer_id, categoryId: row.category_id, title: row.title, description: row.description, requirements: row.requirements, payAmount: Number(row.pay_amount), payCurrency: row.pay_currency, payType: row.pay_type, locationText: row.location_text, latitude: row.latitude, longitude: row.longitude, startDate: row.start_date, endDate: row.end_date, startTime: row.start_time, endTime: row.end_time, workersNeeded: row.workers_needed, workersHired: row.workers_hired, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
const toMedia = (row: JobMediaRow): JobMedia => ({ id: row.id, jobId: row.job_id, storageKey: row.storage_key, mediaType: row.media_type, position: row.position, createdAt: row.created_at });
