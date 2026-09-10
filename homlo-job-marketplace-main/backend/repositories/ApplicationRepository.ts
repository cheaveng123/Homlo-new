import type { Application, ApplicationStatus, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export interface ApplicationRepository {
  findById(id: UUID): Promise<Application | null>;
  findByJobAndWorker(jobId: UUID, workerId: UUID): Promise<Application | null>;
  upsertApplication(jobId: UUID, workerId: UUID, message: string | null): Promise<Application>;
  updateStatus(applicationId: UUID, status: ApplicationStatus): Promise<Application | null>;
  listForJob(jobId: UUID): Promise<Application[]>;
  listForWorker(workerId: UUID): Promise<Application[]>;
}

export class PostgresApplicationRepository extends Repository<Application> implements ApplicationRepository {
  readonly modelName = "applications";
  constructor(database: DatabaseAdapter) { super(database); }
  async findById(id: UUID): Promise<Application | null> { const { rows } = await this.database.query<ApplicationRow>(`select * from applications where id = $1 limit 1`, [id]); return rows[0] ? toApplication(rows[0]) : null; }
  async findByJobAndWorker(jobId: UUID, workerId: UUID): Promise<Application | null> { const { rows } = await this.database.query<ApplicationRow>(`select * from applications where job_id = $1 and worker_id = $2 limit 1`, [jobId, workerId]); return rows[0] ? toApplication(rows[0]) : null; }
  async upsertApplication(jobId: UUID, workerId: UUID, message: string | null): Promise<Application> { const { rows } = await this.database.query<ApplicationRow>(`insert into applications (job_id, worker_id, message) values ($1, $2, $3) on conflict (job_id, worker_id) do update set status = 'applied', message = excluded.message returning *`, [jobId, workerId, message]); return toApplication(requiredRow(rows, "upsert application")); }
  async updateStatus(applicationId: UUID, status: ApplicationStatus): Promise<Application | null> { const { rows } = await this.database.query<ApplicationRow>(`update applications set status = $2 where id = $1 returning *`, [applicationId, status]); return rows[0] ? toApplication(rows[0]) : null; }
  async listForJob(jobId: UUID): Promise<Application[]> { const { rows } = await this.database.query<ApplicationRow>(`select * from applications where job_id = $1 order by created_at desc`, [jobId]); return rows.map(toApplication); }
  async listForWorker(workerId: UUID): Promise<Application[]> { const { rows } = await this.database.query<ApplicationRow>(`select * from applications where worker_id = $1 order by created_at desc`, [workerId]); return rows.map(toApplication); }
}

type ApplicationRow = { id: string; job_id: string; worker_id: string; status: ApplicationStatus; message: string | null; created_at: Date; updated_at: Date };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toApplication = (row: ApplicationRow): Application => ({ id: row.id, jobId: row.job_id, workerId: row.worker_id, status: row.status, message: row.message, createdAt: row.created_at, updatedAt: row.updated_at });
