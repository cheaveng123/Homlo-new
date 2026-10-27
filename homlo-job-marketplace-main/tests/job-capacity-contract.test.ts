import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "backend/database/migrations/046_job_capacity_and_visibility.sql"),
  "utf8",
);

describe("job capacity and visibility contract", () => {
  it("repairs workers_hired and status drift before installing invariants", () => {
    expect(migration).toContain("workers_hired mismatches before repair");
    expect(migration).toContain("set workers_hired = counts.hired_count");
    expect(migration).toContain("set status = 'expired'");
    expect(migration).toContain("and workers_hired >= workers_needed");
    expect(migration).toContain("and workers_hired < workers_needed");
  });

  it("closes a job at zero positions regardless of auto_close_enabled", () => {
    expect(migration).toContain("create or replace function public.enforce_job_capacity_status()");
    expect(migration).toContain("new.workers_hired >= new.workers_needed then");
    expect(migration).toContain("new.status := 'filled';");
    expect(migration).toContain("create trigger trg_jobs_capacity_status");
  });

  it("sends filled notifications only when automatic close notifications are enabled", () => {
    expect(migration).toContain("if coalesce(v_job.auto_close_enabled, true) then");
    expect(migration).not.toContain("if not coalesce(v_job.auto_close_enabled, true) then\n    return;");
  });

  it("accepts applicants directly from applied, reviewed, or interview", () => {
    expect(migration).toContain("v_application.status not in ('applied', 'reviewed', 'interview')");
    expect(migration).toContain("Only candidates who have applied can be accepted");
    expect(migration).not.toContain("v_application.status <> 'interview'");
  });

  it("reopens only filled, non-expired jobs when a hire is reverted", () => {
    expect(migration).toContain("if old.status = 'hired' and new.status <> 'hired' then");
    expect(migration).toContain("when status = 'filled'");
    expect(migration).toContain("and end_date < current_date then 'expired'");
    expect(migration).toContain("when status = 'filled' then 'open'");
  });

  it("filters expired and full jobs in public reads", () => {
    const publicFeed = migration.slice(
      migration.indexOf("create or replace function public.homlo_list_public_published_jobs"),
      migration.indexOf("create or replace function public.homlo_search_public_jobs"),
    );
    expect(publicFeed).toContain("j.status = 'open'");
    expect(publicFeed).toContain("j.workers_needed = 0 or j.workers_hired < j.workers_needed");
    expect(publicFeed).toContain("j.end_date is null or j.end_date >= current_date");
    expect(publicFeed).toContain("j.workers_hired");
  });

  it("returns workers_hired from search and filters search results", () => {
    const search = migration.slice(
      migration.indexOf("create or replace function public.homlo_search_public_jobs"),
      migration.indexOf("create or replace view feed_eligible_jobs"),
    );
    expect(search).toContain("workers_hired integer");
    expect(search).toContain("j.workers_hired");
    expect(search).toContain("j.workers_needed = 0 or j.workers_hired < j.workers_needed");
    expect(search).toContain("j.end_date is null or j.end_date >= current_date");
  });

  it("filters feed candidates and exposes the read-time position gap", () => {
    expect(migration).toContain("create or replace view feed_eligible_jobs");
    expect(migration).toContain("greatest(j.workers_needed - j.workers_hired, 0) as positions_left");
    expect(migration).toContain("j.workers_needed = 0 or j.workers_hired < j.workers_needed");
    expect(migration).toContain("j.end_date is null or j.end_date >= current_date");
  });

  it("adds the expiry sweep without making read correctness depend on cron", () => {
    expect(migration).toContain("create or replace function public.homlo_expire_past_jobs()");
    expect(migration).toContain("'homlo_expire_past_jobs'");
    expect(migration).toContain("'*/15 * * * *'");
    expect(migration).toContain("expiry still enforced by read queries and writes");
  });
});
