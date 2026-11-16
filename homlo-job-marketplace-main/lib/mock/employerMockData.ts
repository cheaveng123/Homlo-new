import type { Employer, JobListing } from "@/types/employer";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const MOCK_EMPLOYERS: Record<string, Employer> = {
  "emp-1": {
    id: "emp-1",
    name: "Meng Cheaveng",
    verified: true,
    category: "Technology",
    location: "Toul Kork",
    bannerUrl: undefined,
    avatarUrl: undefined,
    bio:
      "A product-led technology team based in Toul Kork, building web and " +
      "mobile tools for local businesses. We regularly hire interns and " +
      "junior developers and offer mentorship, flexible schedules, and a " +
      "clear path to full-time roles.",
    industry: "Technology",
    responseTime: "Within a day",
    stats: { activeJobs: 6, rating: 4.8, yearsOnHomlo: 2 },
    jobsPreview: [
      { id: "job-1", title: "Junior Web Developer (Internship)", type: "full_time", meta: "Full-time · $150/mo" },
      { id: "job-2", title: "UI/UX Design Assistant", type: "part_time", meta: "Part-time · $200/mo" },
    ],
    reviews: {
      average: 4.8,
      count: 12,
      items: [
        { id: "rev-1", name: "Sokha R.", rating: 5, text: "Great mentorship during my internship, clear expectations from day one." },
        { id: "rev-2", name: "Dara P.", rating: 4, text: "Paid on time, friendly team. Schedule shifted a bit but they communicated well." },
      ],
    },
  },
  "emp-2": {
    id: "emp-2",
    name: "The Pantry Café",
    verified: false,
    category: "Hospitality",
    location: "Boeung Keng Kang",
    bannerUrl: undefined,
    avatarUrl: undefined,
    bio:
      "A neighbourhood café in Boeung Keng Kang known for relaxed service and " +
      "a warm, regular team. We hire for part-time and weekend shifts and look " +
      "for friendly people who enjoy working with customers.",
    industry: "Hospitality",
    responseTime: "Within a day",
    stats: { activeJobs: 2, rating: 4.6, yearsOnHomlo: 1 },
    jobsPreview: [
      { id: "job-7", title: "Weekend Café Assistant", type: "part_time", meta: "Part-time · $140/mo" },
      { id: "job-8", title: "Barista (Evening Shift)", type: "weekends", meta: "Weekend · $12/hr" },
    ],
    reviews: {
      average: 4.6,
      count: 8,
      items: [
        { id: "rev-3", name: "Vannak S.", rating: 5, text: "Friendly team and clear schedules. Great first job experience." },
        { id: "rev-4", name: "Linna C.", rating: 4, text: "Good tips and a supportive manager. Shifts are consistent." },
      ],
    },
  },
  "emp-3": {
    id: "emp-3",
    name: "Maison Local",
    verified: true,
    category: "Retail",
    location: "Daun Penh",
    bannerUrl: undefined,
    avatarUrl: undefined,
    bio:
      "A design-led retail store in Daun Penh bringing local products to a " +
      "wider audience. We hire part-time assistants for the afternoon and " +
      "weekend rush and value people who are attentive to customers.",
    industry: "Retail",
    responseTime: "Within a day",
    stats: { activeJobs: 2, rating: 4.7, yearsOnHomlo: 2 },
    jobsPreview: [
      { id: "job-9", title: "Retail Assistant (Afternoon)", type: "part_time", meta: "Part-time · $160/mo" },
      { id: "job-10", title: "Weekend Cashier", type: "weekends", meta: "Weekend · $18/day" },
    ],
    reviews: {
      average: 4.7,
      count: 9,
      items: [
        { id: "rev-5", name: "Rithy K.", rating: 5, text: "Respectful managers and an easy-going store routine." },
        { id: "rev-6", name: "Sreyneang P.", rating: 4, text: "Quiet shifts with clear tasks. Good for students." },
      ],
    },
  },
};

/**
 * Demo lookup: maps curated job-store company names to mock employers so the
 * "About the employer" card on Job Detail navigates for these listings. Jobs
 * from the live backend feed are not listed here until the feed exposes the
 * real employer id.
 */
export const COMPANY_TO_EMPLOYER_ID: Record<string, string> = {
  "Kiri Labs": "emp-1",
  "Nimble Pay": "emp-1",
  "Cloud Desk": "emp-1",
  "The Pantry Café": "emp-2",
  "Common Grounds": "emp-2",
  "Maison Local": "emp-3",
  "Green Market": "emp-3",
  "Luma Home": "emp-3",
};

/**
 * Returns a stable employer id for any company name. Known companies resolve
 * to a curated mock employer; unknown ones (e.g. companies from the live
 * backend feed) get a derived id that the employer repository can resolve to
 * a synthesized profile.
 */
export function employerIdForCompany(company: string): string {
  const mapped = COMPANY_TO_EMPLOYER_ID[company];
  if (mapped) return mapped;
  const slug = (company || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `emp-${slug}` : "emp-unknown";
}

export const MOCK_JOBS: JobListing[] = [
  { id: "job-1", employerId: "emp-1", title: "Junior Web Developer (Internship)", type: "full_time", status: "live", location: "Toul Kork", postedAt: daysAgoIso(3), price: 150, priceUnit: "mo", spotsRemaining: 4 },
  { id: "job-2", employerId: "emp-1", title: "UI/UX Design Assistant", type: "part_time", status: "live", location: "Toul Kork", postedAt: daysAgoIso(7), price: 200, priceUnit: "mo", spotsRemaining: 2 },
  { id: "job-3", employerId: "emp-1", title: "Customer Support (Weekends)", type: "weekends", status: "live", location: "Remote", postedAt: daysAgoIso(14), price: 8, priceUnit: "hr", spotsRemaining: 3 },
  { id: "job-4", employerId: "emp-1", title: "Junior QA Tester", type: "full_time", status: "live", location: "Toul Kork", postedAt: daysAgoIso(21), price: 180, priceUnit: "mo", spotsRemaining: 1 },
  { id: "job-5", employerId: "emp-1", title: "Remote Content Writer", type: "remote", status: "live", location: "Remote", postedAt: daysAgoIso(1), price: 10, priceUnit: "hr", spotsRemaining: 2 },
  { id: "job-6", employerId: "emp-1", title: "Weekend Social Media Assistant", type: "weekends", status: "live", location: "Toul Kork", postedAt: daysAgoIso(30), price: 6, priceUnit: "hr", spotsRemaining: 5 },
  { id: "job-7", employerId: "emp-2", title: "Weekend Café Assistant", type: "part_time", status: "live", location: "Boeung Keng Kang", postedAt: daysAgoIso(2), price: 140, priceUnit: "mo", spotsRemaining: 2 },
  { id: "job-8", employerId: "emp-2", title: "Barista (Evening Shift)", type: "weekends", status: "live", location: "Boeung Keng Kang", postedAt: daysAgoIso(5), price: 12, priceUnit: "hr", spotsRemaining: 1 },
  { id: "job-9", employerId: "emp-3", title: "Retail Assistant (Afternoon)", type: "part_time", status: "live", location: "Daun Penh", postedAt: daysAgoIso(4), price: 160, priceUnit: "mo", spotsRemaining: 3 },
  { id: "job-10", employerId: "emp-3", title: "Weekend Cashier", type: "weekends", status: "live", location: "Daun Penh", postedAt: daysAgoIso(9), price: 18, priceUnit: "hr", spotsRemaining: 2 },
];