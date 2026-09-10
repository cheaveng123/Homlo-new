import { describe, expect, it } from "vitest";

import { jobs } from "../components/job-store";
import { filterGuidedJobs, filterJobs } from "../lib/job-utils";

describe("filterJobs", () => {
  it("filters roles by a search term across title, company, and category", () => {
    expect(filterJobs(jobs, "pantry", "All").map((job) => job.id)).toEqual(["restaurant-server"]);
    expect(filterJobs(jobs, "retail", "All").map((job) => job.id)).toEqual(["retail-assistant", "weekend-cashier", "retail-sales-advisor"]);
  });

  it("applies flexible-work tag and industry filters", () => {
    expect(filterJobs(jobs, "", "Weekend").map((job) => job.id)).toEqual(["event-staff", "weekend-cashier", "guest-relations-officer"]);
    expect(filterJobs(jobs, "", "Technology").map((job) => job.id)).toEqual(["junior-software-developer", "frontend-engineer", "data-analyst", "qa-tester"]);
  });

  it("returns fully labelled role data for the detailed results experience", () => {
    const result = filterJobs(jobs, "developer", "All");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "junior-software-developer",
      pay: "$600 – $900 / month",
      arrangement: "Hybrid",
      experience: "Entry level",
      location: "Chamkarmon, Phnom Penh",
    });
  });

  it("ranks jobs by how many guided criteria match, best matches first", () => {
    const tech = filterGuidedJobs(jobs, { salary: "$500 – $800+", salaryMinimum: 500, salaryMaximum: 800, workType: "Hybrid", field: "Technology", city: "Phnom Penh" });
    const techIds = tech.map((job) => job.id);
    // The job satisfying all four criteria ranks first; partial matches follow.
    expect(techIds[0]).toBe("junior-software-developer");
    expect(techIds).toContain("frontend-engineer");
    expect(techIds).toContain("account-executive");
    // Jobs matching none of the criteria are excluded.
    expect(techIds).not.toContain("remote-customer-success");
    expect(techIds).not.toContain("social-media-specialist");
    expect(techIds).not.toContain("customer-support-rep");

    const remote = filterGuidedJobs(jobs, { salary: "$300 – $500+", salaryMinimum: 300, salaryMaximum: 500, workType: "Remote", field: "Any field", city: "Anywhere" });
    const remoteIds = remote.map((job) => job.id);
    // The three roles that match salary AND Remote rank first, in fixture order.
    expect(remoteIds.slice(0, 3)).toEqual(["remote-customer-success", "social-media-specialist", "customer-support-rep"]);
  });
});

describe("malformed record safety", () => {
  it("filters partial records without throwing", () => {
    const malformed = [{ id: "partial-1", title: "Kitchen Assistant", company: null, location: undefined, pay: null, tag: "Part-time", category: "Hospitality" }];
    expect(() => filterJobs(malformed, "kitchen", "Part-time")).not.toThrow();
    expect(filterJobs(malformed, "kitchen", "Part-time")).toHaveLength(1);
  });

  it("keeps guided filtering safe with missing fields", () => {
    const malformed = [{ id: "partial-2", title: null, company: undefined, location: undefined, pay: null, tag: "Part-time", category: "Hospitality" }];
    expect(() => filterGuidedJobs(malformed, { salary: "Any", workType: "Any work type", field: "Any field", city: "Anywhere" })).not.toThrow();
  });
});
