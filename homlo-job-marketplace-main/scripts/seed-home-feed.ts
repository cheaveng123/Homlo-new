// =========================================================
// Prototype data generator for the Home feed (server-composed).
//
// Creates a realistic set of OPEN jobs under the employer account
// `mengcheaveng2019@gmail.com` so the live Home feed sections render
// real job cards instead of empty states:
//
//   - Featured opportunities  -> active `boosts` for a few jobs
//   - Jobs near you           -> jobs with Phnom Penh lat/lng
//   - Specialized categories  -> jobs tagged to the specialized fields
//   - Remote opportunities    -> jobs with "Remote" location_text
//   - Recommended             -> any geo-tagged open job
//
// Idempotent: re-running deletes this employer's previously seeded jobs
// (title-matched) and their boosts, then re-inserts. Other listings (the
// existing catalog) are left untouched.
//
// Run:   pnpm exec tsx scripts/seed-home-feed.ts
//
// Required environment (same as the server): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
// =========================================================

import "dotenv/config";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";
import type { SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";

const EMPLOYER_EMAIL = "mengcheaveng2019@gmail.com";
// Default market center used by the client when location is unknown:
// if the employer also verifies with these coords, Jobs Near You fills on
// the first visit (no device permission needed).
const DEFAULT_CENTER = { latitude: 11.5564, longitude: 104.9282 };

const CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: "technology", name: "Technology" },
  { slug: "sales", name: "Sales" },
  { slug: "marketing", name: "Marketing" },
  { slug: "hospitality", name: "Hospitality" },
  { slug: "construction", name: "Construction" },
  { slug: "finance", name: "Finance" },
  { slug: "accounting", name: "Accounting" },
  { slug: "education", name: "Education" },
  { slug: "customer-service", name: "Customer Service" },
  { slug: "logistics", name: "Logistics" },
  { slug: "administration", name: "Administration" },
];

type SeedJob = {
  title: string;
  categorySlug: string;
  description: string;
  payAmount: number;
  payCurrency?: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string;
  latitude?: number;
  longitude?: number;
  workersNeeded: number;
  startDate?: string;
  endDate?: string;
  bannerImage?: string;
  featured?: boolean;
};

const JOB_LIST: SeedJob[] = [
  {
    title: "Mobile App Developer (Flutter)",
    categorySlug: "technology",
    description:
      "Build and ship features for our food-delivery superapp using Flutter and Supabase. You will own screens end to end, work with our API contracts, and ship to both stores weekly. Remote-friendly, 2+ years Flutter preferred.",
    payAmount: 9.5,
    payType: "hourly",
    locationText: "Remote — anywhere in Cambodia",
    workersNeeded: 2,
    startDate: today(7),
    endDate: today(90),
    bannerImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=75",
    featured: true,
  },
  {
    title: "Restaurant Host / Front Desk",
    categorySlug: "hospitality",
    description:
      "Welcome guests, manage the waitlist, and handle reservations for our riverside bistro in Daun Penh. Fluent Khmer and conversational English required. Evenings and weekends shift available.",
    payAmount: 3.2,
    payType: "hourly",
    locationText: "Daun Penh, Phnom Penh",
    latitude: 11.5666,
    longitude: 104.9253,
    workersNeeded: 3,
    startDate: today(2),
    endDate: today(45),
    bannerImage: "https://picsum.photos/id/425/1600/900",
    featured: true,
  },
  {
    title: "Coffee Barista (Part-time)",
    categorySlug: "hospitality",
    description:
      "Join a specialty coffee shop in BKK1. You will brew espresso drinks, keep the bar clean, and chat with regulars. Training provided — no prior experience required. Part-time, 4 shifts a week.",
    payAmount: 2.5,
    payType: "hourly",
    locationText: "Boeung Keng Kang, Phnom Penh",
    latitude: 11.5488,
    longitude: 104.9212,
    workersNeeded: 2,
    startDate: today(1),
    endDate: today(60),
    bannerImage: "https://picsum.photos/id/429/1000/1000",
  },
  {
    title: "Construction Site Supervisor",
    categorySlug: "construction",
    description:
      "Supervise a mid-rise residential build in Toul Kork. You will coordinate site workers, check safety compliance, and report daily progress. 3+ years construction experience required.",
    payAmount: 18.0,
    payType: "daily",
    locationText: "Toul Kork, Phnom Penh",
    latitude: 11.5714,
    longitude: 104.9097,
    workersNeeded: 1,
    startDate: today(1),
    endDate: today(120),
    bannerImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=75",
    featured: true,
  },
  {
    title: "Cashier (Weekend)",
    categorySlug: "customer-service",
    description:
      "Handle sales and customer payments at a 7-Eleven-style convenience store in Chamkar Mon. Weekend shifts only, training included. Student-friendly.",
    payAmount: 2.2,
    payType: "hourly",
    locationText: "Chamkar Mon, Phnom Penh",
    latitude: 11.5544,
    longitude: 104.9331,
    workersNeeded: 4,
    startDate: today(1),
    endDate: today(40),
    bannerImage: "https://picsum.photos/id/229/1600/680",
  },
  {
    title: "Sales Associate — Digital Agency",
    categorySlug: "sales",
    description:
      "Present our web-design and social packages to local SMEs in Phnom Penh. Commission on top of base, weekly bonuses for closes. Strong Khmer + English, no prior sales needed.",
    payAmount: 300.0,
    payType: "fixed",
    locationText: "Sen Sok, Phnom Penh",
    latitude: 11.5962,
    longitude: 104.8595,
    workersNeeded: 3,
    startDate: today(2),
    endDate: today(60),
    bannerImage: "https://picsum.photos/id/180/2000/1125",
    featured: true,
  },
  {
    title: "Social Media Content Creator",
    categorySlug: "marketing",
    description:
      "Film and edit short-form content (Reels/TikTok) for a fashion label. You will plan two content days per week and deliver 6 posts. Portfolio of reels required.",
    payAmount: 250.0,
    payType: "fixed",
    locationText: "Daun Penh, Phnom Penh",
    latitude: 11.5625,
    longitude: 104.9168,
    workersNeeded: 1,
    startDate: today(3),
    endDate: today(45),
  },
  {
    title: "Junior Accountant",
    categorySlug: "accounting",
    description:
      "Support monthly bookkeeping, invoicing, and payroll for a trading company in Mean Chey. Fresh graduates welcome — Xero or QuickBooks exposure is a plus.",
    payAmount: 420.0,
    payType: "fixed",
    locationText: "Mean Chey, Phnom Penh",
    latitude: 11.4909,
    longitude: 104.9587,
    workersNeeded: 2,
    startDate: today(1),
    endDate: today(90),
  },
  {
    title: "Finance Operations Analyst",
    categorySlug: "finance",
    description:
      "Reconcile daily payouts, track merchant balances, and build simple SQL reports for our fintech. 1–2 years in finance operations, Excel must be second nature.",
    payAmount: 8.0,
    payType: "hourly",
    locationText: "Toul Kork, Phnom Penh",
    latitude: 11.5686,
    longitude: 104.9154,
    workersNeeded: 1,
    startDate: today(2),
    endDate: today(60),
  },
  {
    title: "English Tutor (After-school)",
    categorySlug: "education",
    description:
      "Teach conversational English to grades 4–6 at a learning center in Russey Keo. Afternoon classes Mon–Fri, 3 hours/day. CELTA or teaching experience preferred but not required.",
    payAmount: 5.0,
    payType: "hourly",
    locationText: "Russey Keo, Phnom Penh",
    latitude: 11.6113,
    longitude: 104.9164,
    workersNeeded: 2,
    startDate: today(3),
    endDate: today(60),
    bannerImage: "https://picsum.photos/id/1011/900/1350",
  },
  {
    title: "Remote Customer Support Agent",
    categorySlug: "customer-service",
    description:
      "Handle inbound chat and email for our e-commerce customers from home. Khmer and English required. Shifts 8am–4pm / 4pm–12am, fully remote with a laptop stipend.",
    payAmount: 2.9,
    payType: "hourly",
    locationText: "Remote — anywhere in Cambodia",
    workersNeeded: 5,
    startDate: today(1),
    endDate: today(90),
    bannerImage: "https://picsum.photos/id/1015/900/1350",
  },
  {
    title: "Graphic Designer (Freelance)",
    categorySlug: "marketing",
    description:
      "Design menus, posters, and social creatives for a restaurant group. Deliver monthly, 2–3 releases. Adobe CC, strong typography. Fully remote — submit portfolio to apply.",
    payAmount: 350.0,
    payType: "fixed",
    locationText: "Remote — anywhere in Cambodia",
    workersNeeded: 1,
    startDate: today(2),
    endDate: today(30),
  },
  {
    title: "Warehouse Pick-Pack Staff",
    categorySlug: "logistics",
    description:
      "Pick, pack, and label online orders in our Boeung Tumpun warehouse. Early morning shift with OT available on festival weekends.",
    payAmount: 2.1,
    payType: "hourly",
    locationText: "Boeung Tumpun, Mean Chey, Phnom Penh",
    latitude: 11.5121,
    longitude: 104.9498,
    workersNeeded: 6,
    startDate: today(1),
    endDate: today(30),
    bannerImage: "https://picsum.photos/id/1060/2400/900",
  },
  {
    title: "Receptionist / Admin Assistant",
    categorySlug: "administration",
    description:
      "Front-desk support for a law office in Daun Penh: answer calls, manage diaries, take minutes. Professional Khmer writing and basic Excel required.",
    payAmount: 380.0,
    payType: "fixed",
    locationText: "Daun Penh, Phnom Penh",
    latitude: 11.5631,
    longitude: 104.9219,
    workersNeeded: 1,
    startDate: today(2),
    endDate: today(90),
  },
  {
    title: "Remote Sales Development Rep",
    categorySlug: "sales",
    description:
      "Prospect and qualify inbound leads for our SaaS CRM product. 100% remote, Khmer + English, monthly commission. No prior SaaS experience required — hustle counts.",
    payAmount: 320.0,
    payType: "fixed",
    locationText: "Remote — anywhere in Cambodia",
    workersNeeded: 4,
    startDate: today(3),
    endDate: today(60),
  },
  {
    title: "Junior Web Developer (Internship)",
    categorySlug: "technology",
    description:
      "Hands-on web internship with our product team in Toul Kork: React, TypeScript, API endpoints. 3-month program, stipend + letter of recommendation, potential full-time hire.",
    payAmount: 150.0,
    payType: "fixed",
    locationText: "Toul Kork, Phnom Penh",
    latitude: 11.5723,
    longitude: 104.9061,
    workersNeeded: 2,
    startDate: today(1),
    endDate: today(90),
    bannerImage: "https://picsum.photos/id/0/1600/900",
  },
  {
    title: "Hotel Housekeeping (Day Shift)",
    categorySlug: "hospitality",
    description:
      "Room cleaning and turnaround for a 4-star hotel in Daun Penh. Daily uniform, meal provided. No experience needed; morning shift 8am–4pm.",
    payAmount: 2.4,
    payType: "hourly",
    locationText: "Daun Penh, Phnom Penh",
    latitude: 11.5601,
    longitude: 104.9302,
    workersNeeded: 4,
    startDate: today(1),
    endDate: today(60),
  },
  {
    title: "Electrician Apprentice",
    categorySlug: "construction",
    description:
      "Learn electrical installation on commercial fit-outs in Chamkar Mon. Pair with a licensed electrician, assist with cabling, boards, and safety tests.",
    payAmount: 12.0,
    payType: "daily",
    locationText: "Chamkar Mon, Phnom Penh",
    latitude: 11.5515,
    longitude: 104.9298,
    workersNeeded: 2,
    startDate: today(2),
    endDate: today(40),
  },
];

function today(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function listParam(values: string[]): SqlParameter {
  return values as unknown as SqlParameter;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!url || !serviceRoleKey || !databaseUrl) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL are required (check .env)");
    process.exit(1);
  }

  const adapter = new SupabaseAdapter({ url, serviceRoleKey, databaseUrl });

  try {
    // 1. Resolve the employer account by email (auth.users) and ensure a profile row.
    const employer = await resolveEmployer(adapter);
    console.log(`\nEmployer: ${EMPLOYER_EMAIL} -> user ${employer.userId}, profile ${employer.profileRole ?? "(none)"}`);

    // 2. Upsert the categories the seeded jobs reference.
    const categoryIds = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const row = await adapter.query<{ id: string }>(
        `insert into categories (name, slug) values ($1, $2)
         on conflict (slug) do update set name = excluded.name
         returning id`,
        [cat.name, cat.slug],
      );
      categoryIds.set(cat.slug, row.rows[0].id);
      console.log(`  category ${cat.name} (${cat.slug}) -> ${row.rows[0].id}`);
    }

    // 3. Remove this employer's previously seeded jobs (boosts cascade).
    const seededTitles = JOB_LIST.map((j) => j.title.toLowerCase());
    const deleted = await adapter.query<{ count: string }>(
      `with del as (
         delete from jobs
         where employer_id = $1 and lower(title) = any($2::text[])
         returning id
       )
       select count(*)::text as count from del`,
      [employer.userId, listParam(seededTitles)],
    );
    console.log(`\nCleaned previous seed rows: ${deleted.rows[0]?.count ?? 0}`);

    // 4. Insert jobs in one transaction and collect ids keyed by title.
    const jobIds = new Map<string, string>();
    await adapter.transaction(async (tx) => {
      for (const job of JOB_LIST) {
        const categoryId = categoryIds.get(job.categorySlug);
        if (!categoryId) throw new Error(`Missing category id for ${job.categorySlug}`);
        const inserted = await tx.query<{ id: string }>(
          `insert into jobs (
             employer_id, category_id, title, description,
             pay_amount, pay_currency, pay_type,
             location_text, latitude, longitude,
             start_date, end_date, workers_needed, status
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open')
           returning id`,
          [
            employer.userId,
            categoryId,
            job.title,
            job.description,
            job.payAmount,
            job.payCurrency ?? "USD",
            job.payType,
            job.locationText,
            job.latitude ?? null,
            job.longitude ?? null,
            job.startDate ?? null,
            job.endDate ?? null,
            job.workersNeeded,
          ],
        );
        jobIds.set(job.title, inserted.rows[0].id);

        if (job.bannerImage) {
          await tx.query(`update jobs set banner_image = $1 where id = $2`, [job.bannerImage, inserted.rows[0].id]);
        }
      }
    });
    console.log(`\nInserted ${jobIds.size} prototype jobs under employer ${employer.userId}.`);

    // 5. Boost the featured subset (active, in-window).
    const featured = JOB_LIST.filter((j) => j.featured);
    if (featured.length > 0) {
      const boosted = await adapter.query<{ count: string }>(
        `with ins as (
           insert into boosts (job_id, employer_id, package, start_at, expires_at, status)
           select id, $1, 'standard', now() - interval '1 day', now() + interval '21 days', 'active'
           from jobs
           where employer_id = $1 and lower(title) = any($2::text[])
           returning id
         )
         select count(*)::text as count from ins`,
        [employer.userId, listParam(featured.map((j) => j.title.toLowerCase()))],
      );
      console.log(`  boosted (Featured opportunities): ${boosted.rows[0]?.count ?? 0} jobs`);
      console.log(`    ${featured.map((j) => j.title).join(" · ")}`);
    }

    // 6. Verification against the live read paths.
    console.log("\n--- Post-seed verification ---");

    const center = DEFAULT_CENTER;
    const nearCount = await adapter.query<{ count: string }>(
      `select count(*)::text as count from jobs
       where deleted_at is null and status = 'open'
         and latitude is not null and longitude is not null
         and (6371 * acos(
           cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
           sin(radians($1)) * sin(radians(latitude))
         )) <= 50`,
      [center.latitude, center.longitude],
    );
    console.log(`Jobs within 50 km of ${center.latitude}, ${center.longitude} (Jobs Near You): ${nearCount.rows[0]?.count ?? 0}`);

    const remoteCount = await adapter.query<{ count: string }>(
      `select count(*)::text as count from jobs where deleted_at is null and status = 'open' and location_text ilike '%remote%'`,
    );
    console.log(`Remote jobs: ${remoteCount.rows[0]?.count ?? 0}`);

    const activeBoosts = await adapter.query<{ count: string }>(
      `select count(*)::text as count from boosts
       where status = 'active' and start_at <= now() and expires_at > now()`,
    );
    console.log(`Active boosts (global): ${activeBoosts.rows[0]?.count ?? 0}`);

    const byCategory = await adapter.query<{ category: string; count: string }>(
      `select coalesce(c.name, 'Other') as category, count(*)::text as count
       from jobs j left join categories c on c.id = j.category_id
       where j.deleted_at is null and j.status = 'open'
       group by 1 order by 2 desc`,
    );
    console.log(`Category spread:\n${byCategory.rows.map((r) => `  ${r.category}: ${r.count}`).join("\n")}`);

    console.log("\nSeed complete. Restart the dev server, then open the Home tab.");
  } finally {
    await adapter.close();
  }
}

type ResolvedEmployer = { userId: string; profileRole: string | null };

async function resolveEmployer(adapter: SupabaseAdapter): Promise<ResolvedEmployer> {
  const email = EMPLOYER_EMAIL.trim().toLowerCase();
  let fullName: string | null = null;

  // auth.users.id (Supabase UUID) -> user_identities.provider_user_id ->
  // users.id (the Homlo identity) -> profiles.user_id (jobs.employer_id FK).
  let row = await adapter.query<{ user_id: string }>(
    `select ui.user_id
     from user_identities ui
     join auth.users u on u.id::text = ui.provider_user_id
     where ui.provider = 'supabase'
       and ui.deleted_at is null
       and lower(u.email) = $1
     limit 1`,
    [email],
  );

  if (!row.rows[0]) {
    const found = await adapter.query<{ auth_id: string; full_name: string | null }>(
      `select u.id as auth_id, nullif(u.raw_user_meta_data->>'full_name', '') as full_name
       from auth.users u where lower(u.email) = $1 limit 1`,
      [email],
    );
    const authId = found.rows[0]?.auth_id;
    if (!authId) {
      console.error(`No Supabase auth user found for ${EMPLOYER_EMAIL}. Create the account in the app first.`);
      process.exit(1);
    }
    fullName = found.rows[0].full_name ?? null;

    console.warn(`  No users/user_identities/profiles rows yet for ${EMPLOYER_EMAIL}; creating the Homlo identity chain.`);
    const chain = await adapter.query<{ user_id: string }>(
      `with u as (
         insert into users (status) values ('active') returning id
       ), ident as (
         insert into user_identities (user_id, provider, provider_user_id)
         select u.id, 'supabase', $1 from u
         returning user_id
       ), prof as (
         insert into profiles (user_id, role, full_name)
         select u.id, 'both', $2 from u
         returning user_id
       )
       select user_id from ident`,
      [authId, fullName ?? "Homlo Employer"],
    );
    row = chain;
  }

  const userId = row.rows[0].user_id;

  const profile = await adapter.query<{ role: string }>(
    `select role from profiles where user_id = $1 and deleted_at is null limit 1`,
    [userId],
  );
  let role: string | null = profile.rows[0]?.role ?? null;
  if (!role || role !== "both") {
    role = "both";
    await adapter.query(
      `insert into profiles (user_id, role, full_name) values ($1, 'both', $2)
       on conflict (user_id) do update set role = 'both'`,
      [userId, fullName ?? "Homlo Employer"],
    );
    console.warn(`  Created/migrated profile for ${EMPLOYER_EMAIL} to role 'both'.`);
  }

  return { userId, profileRole: role };
}

main();