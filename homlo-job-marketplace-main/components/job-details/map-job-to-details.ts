import type { Job } from "@/components/job-store";
import { localImageUris } from "@/lib/local-image-uris";

import type { JobDetails } from "./types";

// Maps the app's real `Job` model (curated store entries + normalized live
// published records) into the `JobDetails` shape the redesigned screens
// consume. Keeps SAMPLE_JOB-style hardcoding out of the screens.

const FULL_TIME_TAGS = new Set(["Full-time", "Contract"]);
const PART_TIME_TAGS = new Set(["Part-time", "Weekend", "Temporary"]);

function scheduleTypeFor(tag: string | undefined): string {
  const normalised = tag?.trim() ?? "";
  if (FULL_TIME_TAGS.has(normalised)) return "Full-time";
  if (PART_TIME_TAGS.has(normalised)) return "Part-time";
  // Live records carry a Part-time/Full-time tag already; curated rows with
  // non-employment tags (Internship, etc.) read fine on their own.
  return normalised || "Full-time";
}

function employmentTypeFor(tag: string | undefined, category: string): string {
  return tag?.trim() || category || "Job";
}

function salaryParts(pay: string): { salary: string; salaryPeriod: string; salaryUnit: string } {
  const match = pay.match(/\/\s*(hour|day|month)/);
  if (!match || match.index === undefined) {
    return { salary: pay.trim() || "...", salaryPeriod: "Per month", salaryUnit: "/mo" };
  }
  const period = match[1];
  const salary = pay.slice(0, match.index).trim();
  if (period === "hour") return { salary, salaryPeriod: "Per hour", salaryUnit: "/hr" };
  if (period === "day") return { salary, salaryPeriod: "Per day", salaryUnit: "/day" };
  return { salary, salaryPeriod: "Per month", salaryUnit: "/mo" };
}

export function mapJobToDetails(job: Job): JobDetails {
  const locationArea = (job.location.split(",")[0] ?? "").trim();
  const salary = salaryParts(job.pay);
  return {
    id: job.id,
    title: job.title,
    employmentType: employmentTypeFor(job.tag, job.category),
    scheduleType: scheduleTypeFor(job.tag),
    companyName: job.company,
    location: locationArea,
    salary: salary.salary,
    salaryPeriod: salary.salaryPeriod,
    salaryUnit: salary.salaryUnit,
    schedule: job.schedule || "Flexible",
    spotsLabel: "2-5",
    spotsRemaining: undefined,
    description: job.description,
    requirements: [
      `Availability for the ${job.schedule.toLowerCase()} schedule.`,
      "A friendly, reliable approach to working with people.",
      "A willingness to learn and contribute as part of a team.",
    ],
    employerVerified: true,
    employerSubtitle: `${job.category} · ${locationArea}`,
    coverImageUrl: localImageUris[job.id] || job.image || null,
    companyLogoUrl: null,
    employerAvatarUrl: null,
  };
}