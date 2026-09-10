import { describe, expect, it } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import { ApplicationService } from "../backend/services/ApplicationService";

const employerId = "11111111-1111-4111-8111-111111111111";
const workerId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

class InMemoryApplicationDatabase implements DatabaseAdapter {
  private readonly now = new Date("2026-08-27T00:00:00.000Z");
  private application: Record<string, unknown> | null = null;
  private readonly job: Record<string, unknown> = {
    id: jobId, employer_id: employerId, category_id: null, title: "Server", description: "Serve guests", pay_amount: 10,
    pay_currency: "USD", pay_type: "hourly", location_text: null, latitude: null, longitude: null, start_date: null, end_date: null,
    start_time: null, end_time: null, workers_needed: 1, workers_hired: 0, status: "open", created_at: this.now, updated_at: this.now, deleted_at: null,
  };

  get applicationCount(): number { return this.application ? 1 : 0; }
  get hiredCount(): number { return this.job.workers_hired as number; }
  get jobStatus(): string { return this.job.status as string; }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, parameters: readonly SqlParameter[] = []): Promise<QueryResult<Row>> {
    let rows: Record<string, unknown>[] = [];
    if (statement.startsWith("select * from jobs")) rows = [this.job];
    else if (statement.startsWith("insert into applications")) {
      if (!this.application) this.application = { id: "44444444-4444-4444-8444-444444444444", job_id: jobId, worker_id: workerId, status: "applied", message: parameters[2] ?? null, created_at: this.now, updated_at: this.now };
      else { this.application.status = "applied"; this.application.message = parameters[2] ?? null; }
      rows = [this.application];
    } else if (statement.startsWith("select * from applications where id")) rows = this.application ? [this.application] : [];
    else if (statement.startsWith("update applications set status")) { if (this.application) { this.application.status = parameters[1]; rows = [this.application]; } }
    else if (statement.startsWith("update jobs set workers_hired")) {
      if ((this.job.workers_hired as number) < (this.job.workers_needed as number)) { this.job.workers_hired = (this.job.workers_hired as number) + 1; rows = [this.job]; }
    } else if (statement.startsWith("update jobs set category_id")) { this.job.status = parameters[15]; rows = [this.job]; }
    else if (statement.startsWith("insert into notifications")) rows = [{ id: "notification", user_id: employerId, type: "new_application", title: "New application", body: null, read: false, created_at: this.now }];
    return { rows: rows as Row[], rowCount: rows.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> { return work(this); }
}

describe("ApplicationService lifecycle", () => {
  it("reuses its unique application record when a worker withdraws then reapplies", async () => {
    const database = new InMemoryApplicationDatabase();
    const service = new ApplicationService(database);

    const first = await service.apply(jobId, workerId, "First message");
    await service.transitionStatus(first.id, workerId, "withdrawn");
    const reapplied = await service.apply(jobId, workerId, "Updated message");

    expect(reapplied.id).toBe(first.id);
    expect(reapplied.status).toBe("applied");
    expect(database.applicationCount).toBe(1);
  });

  it("uses a single transactional hire path to increment capacity and fill a job", async () => {
    const database = new InMemoryApplicationDatabase();
    const service = new ApplicationService(database);
    const application = await service.apply(jobId, workerId, null);
    await service.transitionStatus(application.id, employerId, "reviewed");
    await service.transitionStatus(application.id, employerId, "interview");
    await expect(service.transitionStatus(application.id, employerId, "hired")).rejects.toThrow("Use hire");
    const hired = await service.hire(application.id, employerId);

    expect(hired.status).toBe("hired");
    expect(database.hiredCount).toBe(1);
    expect(database.jobStatus).toBe("filled");
  });
});
