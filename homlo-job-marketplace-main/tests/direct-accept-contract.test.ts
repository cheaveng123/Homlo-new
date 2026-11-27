import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("direct accept contract (applied → hired)", () => {
  const migration = project("backend/database/migrations/039_direct_accept_from_applied.sql");

  it("recreates homlo_change_application_status and re-applies RLS", () => {
    expect(migration).toContain("create or replace function public.homlo_change_application_status");
    expect(migration).toContain("revoke all on function public.homlo_change_application_status(uuid, uuid, text) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.homlo_change_application_status(uuid, uuid, text) to service_role");
  });

  it("lets the listing employer hire applicants directly from applied/reviewed/interview", () => {
    expect(migration).toContain("v_job.employer_id <> p_actor_id");
    expect(migration).toContain("v_application.status not in ('applied', 'reviewed', 'interview')");
    expect(migration).toContain("'Only candidates who have applied can be accepted'");
  });

  it("keeps the capacity guard gated on auto-close so the trigger still owns notifications", () => {
    expect(migration).toContain("coalesce(v_job.auto_close_enabled, true) and v_job.workers_hired >= v_job.workers_needed");
    expect(migration).not.toContain("workers_hired = workers_hired + 1, status = case");
    expect(migration).not.toContain("insert into notifications");
  });
});