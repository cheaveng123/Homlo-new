import { describe, expect, it } from "vitest";
import { HomloDirectService } from "../server/homlo-direct-service";

/**
 * Query-budget guard (perf Phase 1): the employer dashboard's applicant list
 * must cost ONE database query no matter how many jobs the employer has.
 * It used to cost one query per job (N+1 with the jobs list).
 */
function countingAdapter(rowsFor: (sql: string, params: unknown[]) => Record<string, unknown>[]) {
  const statements: { sql: string; params: unknown[] }[] = [];
  return {
    statements,
    adapter: {
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        const rows = rowsFor(sql, params);
        return { rows, rowCount: rows.length };
      },
    },
  };
}

const EMPLOYER = "11111111-1111-1111-1111-111111111111";
const JOB_COUNT = 34; // the real dashboard size noted in homlo-direct-service.ts
const jobIds = Array.from({ length: JOB_COUNT }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);

function applicantRow(jobId: string, n: number) {
  return {
    id: `${jobId.slice(0, 24)}${String(n).padStart(12, "9")}`,
    job_id: jobId,
    worker_id: "22222222-2222-2222-2222-222222222222",
    status: "applied",
    message: null,
    created_at: new Date(Date.UTC(2026, 10, 1, 0, n)),
    updated_at: new Date(Date.UTC(2026, 10, 1, 0, n)),
    viewed_at: null,
    worker_full_name: "Worker",
    worker_location: null,
    worker_bio: null,
    worker_photo_key: null,
  };
}

describe("query budget: employer applicants", () => {
  it("before: per-job reads cost one query per job", async () => {
    const { adapter, statements } = countingAdapter((_sql, params) => [applicantRow(String(params[1]), 1)]);
    const service = new HomloDirectService(adapter as never);
    await Promise.all(jobIds.map((jobId) => service.listEmployerApplicationsDirect(EMPLOYER, jobId)));
    expect(statements).toHaveLength(JOB_COUNT);
  });

  it("after: all applicants for every job cost exactly one query", async () => {
    const rows = jobIds.flatMap((jobId) => [applicantRow(jobId, 1), applicantRow(jobId, 2)]);
    const { adapter, statements } = countingAdapter(() => rows);
    const service = new HomloDirectService(adapter as never);

    const result = await service.listAllEmployerApplicationsDirect(EMPLOYER);

    expect(statements).toHaveLength(1); // budget: 1
    expect(statements[0].params).toEqual([EMPLOYER]);
    // Same ownership and soft-delete rules as homlo_list_employer_applications_detailed.
    expect(statements[0].sql).toMatch(/join jobs j on j\.id = a\.job_id and j\.deleted_at is null/);
    expect(statements[0].sql).toMatch(/join profiles p on p\.user_id = a\.worker_id and p\.deleted_at is null/);
    expect(statements[0].sql).toMatch(/where j\.employer_id = \$1::uuid/);
    // Stable order (tiebreaker on id) so grouping by job keeps newest-first.
    expect(statements[0].sql).toMatch(/order by a\.created_at desc, a\.id desc/);

    expect(result.applications).toHaveLength(JOB_COUNT * 2);
    // Same JSON shape as the per-job read: job_id present, timestamps as ISO strings.
    const first = result.applications[0];
    expect(Object.keys(first).sort()).toEqual(Object.keys(applicantRow(jobIds[0], 1)).sort());
    expect(typeof first.created_at).toBe("string");
  });
});
