import type { Job } from "@/components/job-store";
import { resolveJobImage } from "@/lib/job-banner";

/**
 * Canonical display record for a live published job. Covers the homlo public
 * feed, search results and the server-composed home feed, whose payloads all
 * use the same snake_case shape.
 */
export type JobRecord = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  workers_needed: number | string;
  created_at: string;
  category: string;
  employer_name: string | null;
  banner_image?: string | null;
};

export function formatMoney(amount: number | string, currency: string, type: JobRecord["pay_type"]) {
  const numeric = Number(amount);
  const formatted = Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(amount);
  const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
  const suffix = type === "hourly" ? " / hour" : type === "daily" ? " / day" : "";
  return `${symbol}${formatted}${suffix}`;
}

export function formatPostedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Posted recently";
  const ageHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  if (ageHours < 1) return "Posted just now";
  if (ageHours < 24) return `Posted ${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  return ageDays === 1 ? "Posted yesterday" : `Posted ${ageDays} days ago`;
}

/**
 * Maps a server job record to the client `Job` model. Remote is inferred the
 * same way the rest of the app already does it: the arrangement keywords are
 * stored in `location_text`, never derived from the description.
 */
export function normalizePublishedJob(record: JobRecord): Job {
  const location = record.location_text?.trim() || "Location to be confirmed";
  const remote = location.toLowerCase().includes("remote");
  return {
    id: record.id,
    title: record.title,
    company: record.employer_name?.trim() || "Homlo employer",
    location,
    schedule: record.pay_type === "hourly" ? "Flexible hours" : "Schedule set by employer",
    pay: formatMoney(record.pay_amount, record.pay_currency, record.pay_type),
    tag: "Open role",
    category: record.category || "Other",
    image: resolveJobImage(record.banner_image),
    description: record.description,
    arrangement: remote ? "Remote" : "On-site",
    experience: "Experience not specified",
    posted: formatPostedAt(record.created_at),
    status: "New",
  };
}