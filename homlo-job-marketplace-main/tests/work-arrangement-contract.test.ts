import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isMapableJobLocation,
  isWorkArrangement,
  mapCoordinateForJob,
  normalizeWorkArrangement,
  WORK_ARRANGEMENTS,
  WORK_ARRANGEMENT_NOT_SPECIFIED,
  workArrangementLabel,
} from "@/backend/domain/work-arrangement";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = project("backend/database/migrations/041_job_work_arrangement.sql");
const gateway = project("supabase/functions/homlo-service-gateway/index.ts");
const routers = project("server/routers.ts");
const homeFeed = project("server/home-feed.ts");
const directService = project("server/homlo-direct-service.ts");
const searchService = project("backend/search/search-service.ts");
const recommendationFeed = project("backend/ranking/recommendation-feed.ts");

const migrationDir = resolve(process.cwd(), "backend/database/migrations");
const migrationFiles = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();

const saveJobSignatures = migrationFiles.map((name) => {
  const sql = readFileSync(resolve(migrationDir, name), "utf8");
  return {
    name,
    count: (sql.match(/create or replace function public\.homlo_save_job\(/g) ?? []).length,
  };
});

describe("jobs.work_arrangement schema", () => {
  it("adds the column as nullable text with no default and no backfill", () => {
    const addColumn = migration.match(/alter table public\.jobs\s+add column if not exists work_arrangement[^;]*;/)?.[0] ?? "";
    expect(addColumn).toBe("alter table public.jobs\n  add column if not exists work_arrangement text;");
    expect(addColumn).not.toMatch(/default|not null/i);
    expect(migration).not.toMatch(/update\s+jobs\s+set[\s\S]{0,200}work_arrangement\s*=/i);
  });

  it("constrains stored values to the canonical enum while leaving null legal", () => {
    expect(migration).toContain("jobs_work_arrangement_values_check");
    expect(migration).toContain("check (work_arrangement is null or work_arrangement in ('On-site', 'Hybrid', 'Remote'))");
  });

  it("enforces null coordinates for remote jobs at the table level", () => {
    expect(migration).toContain("jobs_remote_has_no_coordinates_check");
    expect(migration).toContain("work_arrangement is distinct from 'Remote'");
    expect(migration).toContain("or (latitude is null and longitude is null)");
  });

  it("adds both check constraints idempotently", () => {
    for (const name of ["jobs_work_arrangement_values_check", "jobs_remote_has_no_coordinates_check"]) {
      const at = migration.indexOf(`'${name}'`);
      expect(at).toBeGreaterThan(-1);
      const guarded = migration.slice(Math.max(0, at - 300), at + 300);
      expect(guarded).toContain("if not exists (");
      expect(guarded).toContain("pg_constraint");
    }
  });
});

describe("homlo_save_job work arrangement parameter", () => {
  it("keeps a single defaulted overload and never introduces another signature", () => {
    const declared = saveJobSignatures.filter((entry) => entry.count > 0);
    expect(declared.length).toBeGreaterThan(0);
    for (const entry of declared) {
      expect(entry.count).toBe(1);
    }
    expect(migration).toContain("p_auto_close_enabled boolean default true,\n  p_work_arrangement text default null");
    expect(migration).toContain("raise exception 'Job work arrangement is invalid'");
  });

  it("normalizes blank input to null and persists the canonical value on insert", () => {
    expect(migration).toContain("v_work_arrangement := nullif(trim(coalesce(p_work_arrangement, '')), '')");
    expect(migration).toContain("requirements, auto_close_enabled, work_arrangement)");
    expect(migration).toContain("coalesce(p_auto_close_enabled, true), v_work_arrangement)");
  });

  it("keeps a previously stored arrangement when the caller omits it", () => {
    expect(migration).toContain("work_arrangement = coalesce(v_work_arrangement, work_arrangement),");
  });

  it("forces null coordinates for remote jobs on both insert and update", () => {
    expect(migration).toContain("case when v_work_arrangement = 'Remote' then null else p_latitude end");
    expect(migration).toContain("case when v_work_arrangement = 'Remote' then null else p_longitude end");
    expect(migration).toContain("latitude = case when coalesce(v_work_arrangement, work_arrangement) = 'Remote' then null else p_latitude end");
    expect(migration).toContain("longitude = case when coalesce(v_work_arrangement, work_arrangement) = 'Remote' then null else p_longitude end");
  });

  it("never derives an arrangement from the location text", () => {
    expect(migration).not.toMatch(/work_arrangement\s*=\s*case[\s\S]{0,200}location/i);
    expect(migration).not.toMatch(/work_arrangement\s*=\s*nullif\(\s*trim\(coalesce\(p_location_text/i);
  });
});

describe("work arrangement read models", () => {
  it("returns the column from the published list, search and employer reads", () => {
    expect(migration).toContain("  workers_hired integer,\n  work_arrangement text\n)");
    expect(migration).toContain("  relevance_score numeric,\n  work_arrangement text\n)");
    expect(migration).toContain("  views_count bigint,\n  work_arrangement text\n)");
    expect((migration.match(/j\.work_arrangement/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("drops each reshaped function so the new OUT row shape applies cleanly", () => {
    for (const signature of [
      "drop function if exists public.homlo_list_public_published_jobs();",
      "drop function if exists public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text);",
      "drop function if exists public.homlo_list_employer_jobs_with_boosts(uuid);",
    ]) {
      expect(migration).toContain(signature);
    }
  });

  it("keeps the arrangement search filter canonical instead of inferred from text", () => {
    expect(migration).toContain("v_where_clauses := v_where_clauses || format('j.work_arrangement = %L', v_arrangement_canonical);");
    expect(migration).not.toContain("j.location_text ilike ''%remote%''");
    expect(migration).not.toContain("j.title ilike ''%hybrid%''");
  });

  it("re-applies the service-role grant for the reshaped functions", () => {
    expect(migration).toContain("grant execute on function public.homlo_list_public_published_jobs() to service_role");
    expect(migration).toContain("grant execute on function public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text) to service_role");
    expect(migration).toContain("grant execute on function public.homlo_list_employer_jobs_with_boosts(uuid) to service_role");
    expect(migration).toContain(
      "grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text, boolean, text) to service_role",
    );
  });

  it("carries the column through every server read model", () => {
    expect(directService).toContain("work_arrangement: WorkArrangement | null;");
    expect(searchService).toContain("work_arrangement: WorkArrangement | null;");
    expect(homeFeed).toContain("work_arrangement: WorkArrangement | null;");
    expect(homeFeed).toContain("j.work_arrangement,");
    expect(recommendationFeed).toContain("j.work_arrangement,");
    expect(recommendationFeed).toContain("workArrangement: row.work_arrangement ?? null,");
  });

  it("drives the home remote section from the canonical column", () => {
    expect(homeFeed).toContain('return job.work_arrangement === "Remote";');
    expect(homeFeed).not.toContain('String(job.location_text ?? "").toLowerCase().includes("remote")');
  });
});

describe("work arrangement request path", () => {
  it("validates the enum in the trpc save input", () => {
    expect(routers).toContain('workArrangement: z.enum(["On-site", "Hybrid", "Remote"]).nullable().optional()');
  });

  it("forwards the payload as the defaulted rpc parameter", () => {
    expect(gateway).toContain("p_work_arrangement: normalizeWorkArrangement(payload.workArrangement)");
    expect(gateway).toContain('const WORK_ARRANGEMENTS: readonly string[] = ["On-site", "Hybrid", "Remote"];');
  });
});

describe("work arrangement domain rules", () => {
  it("exposes exactly the canonical values", () => {
    expect(WORK_ARRANGEMENTS).toEqual(["On-site", "Hybrid", "Remote"]);
    expect(isWorkArrangement("On-site")).toBe(true);
    expect(isWorkArrangement("Hybrid")).toBe(true);
    expect(isWorkArrangement("Remote")).toBe(true);
  });

  it("never infers a value from free text", () => {
    for (const value of ["remote", "onsite", "On Site", "Any", "Not specified", "", null, undefined, 3]) {
      expect(isWorkArrangement(value)).toBe(false);
      expect(normalizeWorkArrangement(value)).toBeNull();
    }
  });

  it("labels a legacy null as not specified", () => {
    expect(workArrangementLabel(null)).toBe(WORK_ARRANGEMENT_NOT_SPECIFIED);
    expect(workArrangementLabel(undefined)).toBe(WORK_ARRANGEMENT_NOT_SPECIFIED);
    expect(workArrangementLabel("Hybrid")).toBe("Hybrid");
  });

  it("only maps on-site jobs with a real finite paired coordinate", () => {
    const onSite = { workArrangement: "On-site" as const, latitude: 11.5621, longitude: 104.916 };
    expect(mapCoordinateForJob(onSite)).toEqual({ latitude: 11.5621, longitude: 104.916 });
    expect(isMapableJobLocation(onSite)).toBe(true);
  });

  it("never maps a remote or hybrid job, even with coordinates present", () => {
    for (const workArrangement of ["Remote", "Hybrid", null] as const) {
      expect(isMapableJobLocation({ workArrangement, latitude: 11.5621, longitude: 104.916 })).toBe(false);
    }
  });

  it("never maps an on-site job with a missing or unusable coordinate pair", () => {
    const unusable: Array<{ latitude: number | null; longitude: number | null }> = [
      { latitude: null, longitude: 104.916 },
      { latitude: 11.5621, longitude: null },
      { latitude: null, longitude: null },
      { latitude: Number.NaN, longitude: 104.916 },
      { latitude: 11.5621, longitude: Number.POSITIVE_INFINITY },
      { latitude: 91, longitude: 104.916 },
      { latitude: 11.5621, longitude: 181 },
    ];
    for (const coordinates of unusable) {
      expect(mapCoordinateForJob({ workArrangement: "On-site", ...coordinates })).toBeNull();
    }
  });
});
