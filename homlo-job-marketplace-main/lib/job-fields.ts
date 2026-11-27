
// The official Homlo field taxonomy: the 19 professional fields, in the order
// they are published, each with the cutout illustration that represents it.
//
// This is deliberately NOT `lib/category-data.ts`. That file's 16 titles are an
// exact-match join key: `016_job_search.sql` filters jobs with
// `c.name = trim(p_category)`, and `server/home-feed.ts` matches the DB's
// `categories.name` against titles resolved out of it via
// `getCategoryById(slug)?.title`. Renaming those titles to the official field
// names silently empties the home feed's specialised sections and breaks
// category-filtered search, with no type error to warn you. So `category-data`
// stays frozen as a back-compat layer, and this module sits on top of it as the
// canonical taxonomy for icons and labels. Resolving through the alias lists
// below means records still carry their old titles and still get the right art.
//
// Consequence worth knowing: because the registry is frozen, the category text
// a job shows (e.g. the home card's tag pill) still reads the legacy title
// ("Technology"), not the official field name ("IT & Technology"). Teaching the
// UI the new titles needs a `categories.name` migration, not a code change.

import { JOB_FIELD_SVGS, type JobFieldId } from "./job-field-svgs";

export type { JobFieldId } from "./job-field-svgs";

export type JobField = {
  id: JobFieldId;
  /** The official field name, e.g. "IT & Technology". */
  title: string;
  /**
   * The field's illustration as inline SVG markup. The SVG files live in
   * `/svg` and are compiled into `job-field-svgs.ts`; they all use a square
   * 96×96 viewBox, so render sites size them with a single square dimension.
   */
  svg: string;
  /**
   * Every spelling a job's `category` string is known to arrive in: the legacy
   * `category-data` title, the seed/DB slug, the `query-parser` keyword, and
   * the free-text an employer types into their own industry. Both sides of a
   * comparison are run through `normaliseFieldKey`, so these are written the
   * way a human reads them and the normaliser handles the formatting.
   */
  aliases: string[];
};

export const JOB_FIELDS: JobField[] = [
  {
    id: "sales-business",
    title: "Sales & Business",
    svg: JOB_FIELD_SVGS["sales-business"],
    aliases: [
      "Sales",
      "Business",
      "Business Development",
      "Sales Executive",
      "Account Executive",
      "Business Sales",
      "Commerce",
    ],
  },
  {
    id: "marketing-media",
    title: "Marketing & Media",
    svg: JOB_FIELD_SVGS["marketing-media"],
    aliases: [
      "Marketing",
      "Media",
      "Digital Marketing",
      "Content Creator",
      "Social Media",
      "Brand",
      "Branding",
      "Communications",
      "Advertising",
      "PR",
    ],
  },
  {
    id: "finance-accounting",
    title: "Finance & Accounting",
    svg: JOB_FIELD_SVGS["finance-accounting"],
    aliases: [
      "Finance",
      "Accounting",
      "Bookkeeping",
      "Banking",
      "Audit",
      "Payroll",
      "Tax",
    ],
  },
  {
    id: "it-technology",
    title: "IT & Technology",
    svg: JOB_FIELD_SVGS["it-technology"],
    aliases: [
      "Technology",
      "IT",
      "Information Technology",
      "Software",
      "Developer",
      "Programming",
      "Web Development",
      "Data",
      "Data Analysis",
      "IT Support",
      "QA",
      "Computer",
    ],
  },
  {
    id: "customer-service",
    title: "Customer Service",
    svg: JOB_FIELD_SVGS["customer-service"],
    aliases: [
      "Customer Service",
      "Customer Support",
      "Customer Success",
      "Support",
      "Help Desk",
      "Service",
    ],
  },
  {
    id: "hospitality-food",
    title: "Hospitality & Food",
    svg: JOB_FIELD_SVGS["hospitality-food"],
    aliases: [
      "Hospitality",
      "Hospitality & Service",
      "Food",
      "Food & Beverage",
      "Restaurant",
      "Hotel",
      "Catering",
      "Barista",
      "Chef",
      "Kitchen",
      "Events",
      "Travel",
      "Tourism",
    ],
  },
  {
    id: "retail-ecommerce",
    title: "Retail & E-commerce",
    svg: JOB_FIELD_SVGS["retail-ecommerce"],
    aliases: [
      "Retail",
      "E-commerce",
      "Store",
      "Merchandising",
      "Shop",
      "Retail Sales",
    ],
  },
  {
    id: "logistics-delivery",
    title: "Logistics & Delivery",
    svg: JOB_FIELD_SVGS["logistics-delivery"],
    aliases: [
      "Logistics",
      "Delivery",
      "Delivery Rider",
      "Warehouse Packer",
      "Warehouse",
      "Supply Chain",
      "Transport",
      "Fleet",
      "Courier",
      "Shipping",
      "Distribution",
    ],
  },
  {
    id: "administration",
    title: "Administration",
    svg: JOB_FIELD_SVGS["administration"],
    // "Operations" is a real category in the seed data but has no counterpart
    // in the official 19, so it folds into Administration rather than
    // rendering as an unmapped job.
    aliases: [
      "Administration",
      "Administrative",
      "Admin",
      "Admin & Office",
      "Office",
      "Office Administrator",
      "Executive Assistant",
      "Receptionist",
      "Clerical",
      "Operations",
    ],
  },
  {
    id: "human-resources",
    title: "Human Resources",
    svg: JOB_FIELD_SVGS["human-resources"],
    aliases: [
      "Human Resources",
      "Human Resource",
      "HR",
      "Recruitment",
      "Recruiting",
      "Talent",
      "Staffing",
      "Personnel",
      "People",
    ],
  },
  {
    id: "education-training",
    title: "Education & Training",
    svg: JOB_FIELD_SVGS["education-training"],
    aliases: [
      "Education",
      "Training",
      "Teaching",
      "Teacher",
      "School",
      "Academy",
      "Tutor",
      "Learning",
      "Instructor",
    ],
  },
  {
    id: "engineering-construction",
    title: "Engineering & Construction",
    svg: JOB_FIELD_SVGS["engineering-construction"],
    aliases: [
      "Engineering",
      "Construction",
      "Civil",
      "Mechanical",
      "Engineer",
      "Site Engineer",
      "Builder",
      "Contractor",
      "Architecture",
    ],
  },
  {
    id: "design-creative",
    title: "Design & Creative",
    svg: JOB_FIELD_SVGS["design-creative"],
    aliases: ["Design", "Creative", "Graphics", "Graphic Design", "UI", "UX", "Product Design", "Illustration", "Art"],
  },
  { id: "healthcare", title: "Healthcare", svg: JOB_FIELD_SVGS["healthcare"], aliases: ["Healthcare", "Health", "Medical", "Nurse", "Care", "Wellness", "Doctor", "Clinic"] },
  {
    id: "manufacturing",
    title: "Manufacturing",
    svg: JOB_FIELD_SVGS["manufacturing"],
    aliases: ["Manufacturing", "Production", "Factory", "Assembly"],
  },
  {
    id: "beauty-personal-care",
    title: "Beauty & Personal Care",
    svg: JOB_FIELD_SVGS["beauty-personal-care"],
    aliases: ["Beauty", "Personal Care", "Salon", "Hairdresser", "Hair", "Makeup", "Nail", "Spa", "Massage"],
  },
  {
    id: "cleaning-housekeeping",
    title: "Cleaning & Housekeeping",
    svg: JOB_FIELD_SVGS["cleaning-housekeeping"],
    aliases: ["Cleaning", "Housekeeping", "Cleaner", "Janitorial", "Sanitation", "Domestic", "Maid"],
  },
  { id: "security", title: "Security", svg: JOB_FIELD_SVGS["security"], aliases: ["Security", "Security Guard", "Guard", "Guarding", "Safety", "CCTV", "Loss Prevention"] },
  { id: "agriculture", title: "Agriculture", svg: JOB_FIELD_SVGS["agriculture"], aliases: ["Agriculture", "Farming", "Farm", "Agro", "Crops", "Fishery", "Forestry"] },
];

/**
 * Folds the formatting differences between the ways a category is written down
 * into one comparable form: case, `&` vs `and`, slugs vs prose, and the trailing
 * " jobs" that `CategoryListingScreen` appends to its page titles.
 */
export function normaliseFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+jobs$/, "")
    .trim();
}

// Built once at module load rather than scanned per call: this resolver runs
// inside list item renderers.
const FIELD_BY_ALIAS: ReadonlyMap<string, JobField> = (() => {
  const byAlias = new Map<string, JobField>();
  for (const field of JOB_FIELDS) {
    // The official title always resolves to its own field, so the list needs no
    // separate title alias.
    for (const alias of [field.title, ...field.aliases]) {
      byAlias.set(normaliseFieldKey(alias), field);
    }
  }
  return byAlias;
})();

/**
 * Maps whatever a job's `category` happens to be onto one of the 19 official
 * fields. Returns `undefined` when nothing matches — including the `"Job"` and
 * `"Other"` sentinels the data layers fall back to, which are deliberately not
 * aliased so they still draw the neutral glyph.
 */
export function resolveJobField(value: string | null | undefined): JobField | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return FIELD_BY_ALIAS.get(normaliseFieldKey(trimmed));
}

/**
 * The field's inline SVG artwork, or `null` when the category is unmapped. The
 * shape every caller actually wants at a render site.
 */
export function resolveJobFieldSvg(value: string | null | undefined): string | null {
  return resolveJobField(value)?.svg ?? null;
}
