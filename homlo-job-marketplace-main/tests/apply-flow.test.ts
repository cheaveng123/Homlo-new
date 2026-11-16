import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyActionState, isActiveApplication } from "../lib/application-eligibility";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("worker apply eligibility", () => {
  it("blocks reapplication while an application is active", () => {
    for (const status of ["applied", "reviewed", "interview", "hired"]) {
      expect(isActiveApplication({ status }), status).toBe(true);
    }
  });

  it("allows applications that were withdrawn or declined to be retried", () => {
    expect(isActiveApplication({ status: "withdrawn" })).toBe(false);
    expect(isActiveApplication({ status: "declined" })).toBe(false);
    expect(isActiveApplication(null)).toBe(false);
  });

  it("treats an unknown backend status as active so duplicates fail closed", () => {
    expect(isActiveApplication({ status: "submitted" })).toBe(true);
  });

  it("prioritizes the filled-job label over the application label", () => {
    expect(applyActionState({ status: "applied" }, true)).toEqual({ disabled: true, label: "Job filled" });
    expect(applyActionState({ status: "applied" }, false)).toEqual({ disabled: true, label: "Applied" });
    expect(applyActionState({ status: "withdrawn" }, false)).toEqual({ disabled: false });
  });
});

describe("apply flow contract", () => {
  const applyRoute = project("app/job/[id]/apply.tsx");
  const jobDetail = project("app/job/[id].tsx");

  it("checks the worker's existing application before rendering the apply form", () => {
    expect(applyRoute).toContain("trpc.homlo.applications.byJob.useQuery");
    expect(applyRoute).toContain("isActiveApplication(existingApplication)");
  });

  it("replaces the success screen with the real applications list", () => {
    expect(applyRoute).toContain('pathname: "/inbox"');
    expect(applyRoute).toContain('tab: "applications"');
    expect(applyRoute).not.toContain('router.push("/applications"');
    expect(applyRoute).not.toContain('router.replace("/applications"');
  });

  it("disables the job-detail Apply action for an active application", () => {
    expect(jobDetail).toContain("trpc.homlo.applications.byJob.useQuery");
    expect(jobDetail.replace(/\s+/g, " ")).toContain("applyActionState( applicationQuery.data?.application ?? null, filled, )");
    expect(jobDetail).toContain("applyDisabled={apply.disabled}");
    expect(jobDetail).toContain("applyLabel={apply.label}");
  });
});
