import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/lib/mock/employerMockData";
import type { Employer, JobListing, GetJobsByEmployerOptions } from "@/types/employer";

function simulateNetwork<T>(value: T, delayMs = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

/**
 * Deterministic stand-in profile for employers that only exist in the live
 * backend feed (no curated mock profile yet). Kept minimal so it never
 * fabricates specific stats, but renders as a real employer page.
 */
function fallbackEmployer(employerId: string, name: string): Employer {
  return {
    id: employerId,
    name: (name || "Homlo employer").trim(),
    verified: false,
    category: "Business",
    location: "Phnom Penh",
    bannerUrl: undefined,
    avatarUrl: undefined,
    bio: "This employer joined Homlo to connect with local job seekers.",
    industry: "Business",
    responseTime: "Within a day",
    stats: { activeJobs: 0, rating: 0, yearsOnHomlo: 0 },
    jobsPreview: [],
    reviews: { average: 0, count: 0, items: [] },
  };
}

export async function getEmployerById(
  employerId: string,
  fallbackName?: string
): Promise<Employer | null> {
  const matched = MOCK_EMPLOYERS[employerId];
  if (matched) return simulateNetwork(matched);
  if (fallbackName) return simulateNetwork(fallbackEmployer(employerId, fallbackName));
  return simulateNetwork(null);
}

export async function getJobsByEmployer(
  employerId: string,
  options: GetJobsByEmployerOptions = {}
): Promise<JobListing[]> {
  const { type = "all", sort = "newest", status = "live" } = options;

  let jobs = MOCK_JOBS.filter((job) => job.employerId === employerId && job.status === status);
  if (type !== "all") jobs = jobs.filter((job) => job.type === type);

  const sorted = [...jobs];
  if (sort === "price_high_low") sorted.sort((a, b) => b.price - a.price);
  else if (sort === "price_low_high") sorted.sort((a, b) => a.price - b.price);
  else sorted.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  return simulateNetwork(sorted);
}