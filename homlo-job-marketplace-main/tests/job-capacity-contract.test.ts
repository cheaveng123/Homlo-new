import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { computePositionsLeft } from "../lib/positions";

const migration = readFileSync(
  resolve(process.cwd(), "backend/database/migrations/046_job_capacity_and_visibility.sql"),
  "utf8",
);
const gateway = readFileSync(
  resolve(process.cwd(), "supabase/functions/homlo-service-gateway/index.ts"),
  "utf8",
);
const recommendationFeed = readFileSync(
  resolve(process.cwd(), "backend/ranking/recommendation-feed.ts"),
  "utf8",
);
const homeFeed = readFileSync(
  resolve(process.cwd(), "server/home-feed.ts"),
  "utf8",
);

function publicFeedSource(): string {
  return migration.slice(
    migration.indexOf("create or replace function public.homlo_list_public_published_jobs"),
    migration.indexOf("create or replace function public.homlo_search_public_jobs"),
  );
}

function searchSource(): string {
  return migration.slice(
    migration.indexOf("create or replace function public.homlo_search_public_jobs"),
    migration.indexOf("create or replace view feed_eligible_jobs"),
  );
}

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

  it("keeps recommendation candidates open, unexpired, and below capacity", () => {
    const candidates = migration.slice(
      migration.indexOf("create or replace function public.homlo_eligible_candidates"),
    );
    expect(candidates).toContain("j.deleted_at is null");
    expect(candidates).toContain("j.status = 'open'");
    expect(candidates).toContain("j.workers_needed = 0 or j.workers_hired < j.workers_needed");
    expect(candidates).toContain(
      "j.end_date is null or j.end_date >= (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date",
    );
  });

  it("keeps batched recommendation and featured home-feed display reads public-only", () => {
    for (const source of [recommendationFeed, homeFeed]) {
      expect(source).toContain("j.deleted_at is null");
      expect(source).toContain("j.status = 'open'");
      expect(source).toContain("(j.workers_needed = 0 or j.workers_hired < j.workers_needed)");
      expect(source).toContain("(j.end_date is null or j.end_date >= current_date)");
    }
  });

  it("adds the expiry sweep without making read correctness depend on cron", () => {
    expect(migration).toContain("create or replace function public.homlo_expire_past_jobs()");
    expect(migration).toContain("'homlo_expire_past_jobs'");
    expect(migration).toContain("'*/15 * * * *'");
    expect(migration).toContain("expiry still enforced by read queries and writes");
  });

  // ---------------------------------------------------------------------------
  // Publicly-visible predicate: status = 'open' AND not expired AND not deleted.
  // A null or missing expiry must NOT hide the job (end_date is null branch).
  // expiry-day boundary: end_date >= current_date means same-day is visible.
  // ---------------------------------------------------------------------------

  it("public reads exclude closed and cancelled jobs — only 'open' is live", () => {
    // The job status enum includes closed / cancelled, but public reads select
    // only status = 'open', so closed / cancelled / draft / filled / expired
    // jobs can never be returned by a public query.
    expect(publicFeedSource()).toContain("j.status = 'open'");
    // The search function is plpgsql, so the literal is doubly single-quoted.
    expect(searchSource()).toContain("j.status = ''open''");
    for (const source of [publicFeedSource(), searchSource()]) {
      expect(source).not.toContain("'closed'");
      expect(source).not.toContain("'cancelled'");
    }
  });

  it("null or missing expiry does not hide a job", () => {
    for (const source of [publicFeedSource(), searchSource()]) {
      expect(source).toContain("j.end_date is null");
    }
  });

  it("expiry-day boundary: end_date == current_date is still visible", () => {
    for (const source of [publicFeedSource(), searchSource()]) {
      expect(source).toContain("j.end_date >= current_date");
    }
  });

  it("employer-owned jobs query does not filter status — a closed job stays accessible to its employer", () => {
    expect(gateway).toContain('action === "employer.jobs"');
    expect(gateway).toContain('homlo_list_employer_jobs_with_boosts');
    // Only the employer id is passed — no status parameter, so a closed /
    // cancelled / expired job the employer owns is still returned to them.
    const call = gateway.slice(
      gateway.indexOf('action === "employer.jobs"'),
      gateway.indexOf("if (action === \"employer.save-job\""),
    );
    expect(call).toContain("{ p_employer_id: account.id }");
    expect(call).not.toContain("p_status");
    expect(call).not.toContain("status = 'open'");
  });

  it("computes positions left from needed minus hired with safe bounds", () => {
    expect(computePositionsLeft(5, 2)).toBe(3);
    expect(computePositionsLeft("5", "5")).toBe(0);
    expect(computePositionsLeft(5, 7)).toBe(0);
    expect(computePositionsLeft(3, -2)).toBe(3);
    expect(computePositionsLeft(undefined, 2)).toBe(0);
    expect(computePositionsLeft("not-a-number", 2)).toBe(0);
    expect(computePositionsLeft(0, 0)).toBe(0);
    expect(computePositionsLeft(0, 3)).toBe(0);
    expect(computePositionsLeft(null as unknown as number, 0)).toBe(0);
  });
});
