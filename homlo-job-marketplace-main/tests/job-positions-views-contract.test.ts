import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatPositionsLabel } from "../lib/positions";

const migration = readFileSync(
  resolve(process.cwd(), "backend/database/migrations/052_fix_job_positions_and_views.sql"),
  "utf8",
);
const mapJobToDetails = readFileSync(
  resolve(process.cwd(), "components/job-details/map-job-to-details.ts"),
  "utf8",
);
const popularJobs = readFileSync(resolve(process.cwd(), "app/jobs/popular.tsx"), "utf8");
const jobDetail = readFileSync(resolve(process.cwd(), "app/job/[id].tsx"), "utf8");
const copyNew = readFileSync(resolve(process.cwd(), "src/new/theme/copyNew.ts"), "utf8");
const jobPartsNew = readFileSync(resolve(process.cwd(), "src/new/components/JobPartsNew.tsx"), "utf8");
const jobDetailNew = readFileSync(resolve(process.cwd(), "src/new/screens/JobDetailScreenNew.tsx"), "utf8");
const positionsLeft = readFileSync(resolve(process.cwd(), "components/jobs/PositionsLeft.tsx"), "utf8");
const positionsProgress = readFileSync(
  resolve(process.cwd(), "components/job-details/PositionsProgress.tsx"),
  "utf8",
);
const jobDetailsScreen = readFileSync(
  resolve(process.cwd(), "components/job-details/job-details-screen.tsx"),
  "utf8",
);
const employerDashboard = readFileSync(
  resolve(process.cwd(), "screens/EmployerDashboardNewAdapter.tsx"),
  "utf8",
);

function employerListSource(): string {
  return migration.slice(
    migration.indexOf("create or replace function public.homlo_list_employer_jobs_with_boosts"),
    migration.indexOf("revoke all on function public.homlo_list_employer_jobs_with_boosts"),
  );
}

describe("job positions and views contract", () => {
  it("derives workers_hired exactly from hired applications on every job write", () => {
    expect(migration).toContain("select count(*)::int into v_hired_count");
    expect(migration).toContain("where job_id = new.id and status = 'hired'");
    expect(migration).toContain("new.workers_hired := v_hired_count");
  });

  it("reopens filled jobs when hired applications fall below capacity", () => {
    expect(migration).toContain("elsif new.status = 'filled'");
    expect(migration).toContain("new.workers_hired < new.workers_needed");
    expect(migration).toContain("new.status := 'open'");
  });

  it("keeps workers_hired in sync for application inserts, status changes, moves, and deletes", () => {
    expect(migration).toContain("after update of status, job_id on public.applications");
    expect(migration).toContain("after insert or delete on public.applications");
    expect(migration).toContain("update jobs set workers_hired = workers_hired where id = old.job_id");
    expect(migration).toContain("update jobs set workers_hired = workers_hired where id = v_job_id");
  });

  it("counts employer views from the anonymous detail-view ledger", () => {
    const source = employerListSource();
    expect(migration).toContain("create table if not exists public.job_events_anon");
    expect(source).toContain("count(distinct e.session_id)::bigint");
    expect(source).toContain("from job_events_anon e");
    expect(source).toContain("e.event_type = 'view'");
    expect(source).not.toContain("from job_events e");
  });

  it("keeps feed positions clamped at zero", () => {
    expect(migration).toContain("greatest(j.workers_needed - j.workers_hired, 0) as positions_left");
  });

  it("maps positions as accepted/total instead of a hardcoded or remaining label", () => {
    expect(mapJobToDetails).not.toContain('spotsLabel: "2-5"');
    expect(mapJobToDetails).toContain("formatPositionsLabel(positionsFilled, job.positionsTotal)");
    expect(mapJobToDetails).not.toContain("spotsLabel: positionsAvailable == null");
  });

  it("formats accepted positions over total positions without 'left'", () => {
    expect(formatPositionsLabel(1, 3)).toBe("1/3 positions");
    expect(formatPositionsLabel(0, 1)).toBe("0/1 position");
    expect(formatPositionsLabel(4, 3)).toBe("3/3 positions");
    expect(formatPositionsLabel(0, 0)).toBe("Positions");
    expect(formatPositionsLabel(null, 2)).toBe("0/2 positions");
  });

  it("shows accepted/total position labels on every candidate and employer surface", () => {
    expect(copyNew).toContain("positions: (filled: number, total: number)");
    expect(copyNew).toContain("position${total === 1 ? '' : 's'}");
    expect(jobPartsNew).toContain("copy.positions(accepted, total)");
    expect(jobPartsNew).toContain("const ratio = total > 0 ? Math.max(0, Math.min(1, accepted / total)) : 0");
    expect(jobDetailNew).toContain("value={`${positionsAccepted}/${job.positionsTotal}`}");
    expect(positionsLeft).toContain("accessibilityLabel={`${accepted} of ${all} positions filled`}");
    expect(positionsLeft).toContain("formatPositionsLabel(accepted, all)");
    expect(positionsProgress).toContain("formatPositionsLabel(accepted, positionsTotal)");
    expect(jobDetailsScreen).toContain('label: "Positions"');
    expect(employerDashboard).toContain("positionsLeftLabel: formatPositionsLabel(filled, total)");
  });

  it("removes visible positions-left wording from position surfaces", () => {
    const positionSurfaces = [
      copyNew,
      jobPartsNew,
      jobDetailNew,
      positionsLeft,
      positionsProgress,
      jobDetailsScreen,
      employerDashboard,
    ].join("\n");
    expect(positionSurfaces).not.toMatch(/\b(?:positions?|spots?)\s+left\b/i);
  });

  it("does not invent a position when popular or detail data is missing", () => {
    // The Popular page now uses the shared listing cards, which show no
    // position count at all, so it must not invent one either.
    expect(popularJobs).not.toContain("positionsAvailable ?? j.positionsTotal ?? 1");
    expect(popularJobs).not.toMatch(/positions(Available|Total|Left)/);
    expect(jobDetail).toContain("computePositionsLeft(d.positionsTotal, d.positionsFilled)");
  });
});
