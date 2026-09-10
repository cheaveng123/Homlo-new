import { getCategoryById } from "@/lib/category-data";

/**
 * Config-driven specialized-field sections for the home feed. Adding a new
 * field here automatically makes it a candidate for the rotating homepage
 * sections — no component changes required. The client picks a subset and the
 * server only ships fields whose categories currently have published jobs.
 */
export type SpecializedField = {
  id: string;
  title: string;
  summary: string;
  /** Category name forwarded to `/jobs` when the user taps "view more". */
  searchCategory: string;
  /** Keys into the existing category system (see lib/category-data.ts). */
  categorySlugs: string[];
  /** Only needed when a slug has no entry in opportunityCategories. */
  categoryNames?: string[];
};

export const specializedFields: SpecializedField[] = [
  {
    id: "technology",
    title: "Technology",
    summary: "Software, IT & digital roles",
    searchCategory: "Technology",
    categorySlugs: ["technology"],
  },
  {
    id: "sales-and-marketing",
    title: "Sales & Marketing",
    summary: "Customer growth, partnerships & brand",
    searchCategory: "Sales",
    categorySlugs: ["sales", "marketing"],
  },
  {
    id: "hospitality",
    title: "Hospitality",
    summary: "Guest-facing roles, events & food",
    searchCategory: "Hospitality",
    categorySlugs: ["hospitality"],
  },
  {
    id: "construction",
    title: "Construction",
    summary: "Projects & trade roles",
    searchCategory: "Construction",
    categorySlugs: ["construction"],
  },
  {
    id: "finance",
    title: "Finance",
    summary: "Banking, accounting & analysis",
    searchCategory: "Finance",
    categorySlugs: ["finance", "accounting"],
  },
  {
    id: "education",
    title: "Education",
    summary: "Teaching & training roles",
    searchCategory: "Education",
    categorySlugs: ["education"],
  },
  {
    id: "customer-service",
    title: "Customer Service",
    summary: "Support & client success",
    searchCategory: "Customer Service",
    categorySlugs: ["customer-service"],
  },
];

/** Category names (as stored on jobs / published records) a field matches. */
export function fieldCategoryNames(field: SpecializedField): string[] {
  if (field.categoryNames && field.categoryNames.length > 0) return field.categoryNames;
  const resolved = field.categorySlugs
    .map((slug) => getCategoryById(slug)?.title)
    .filter((name): name is string => Boolean(name));
  return resolved.length > 0 ? resolved : [...field.categorySlugs];
}