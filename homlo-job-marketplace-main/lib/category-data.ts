export type OpportunityCategory = {
  id: string;
  title: string;
  count: number;
  summary: string;
  accent: "mint" | "sand" | "ink" | "sky";
};

export const opportunityCategories: OpportunityCategory[] = [
  { id: "technology", title: "Technology", count: 124, summary: "Software · IT · Data · AI", accent: "ink" },
  { id: "sales", title: "Sales", count: 86, summary: "Business development", accent: "mint" },
  { id: "marketing", title: "Marketing", count: 72, summary: "Brand · Growth · Content", accent: "sand" },
  { id: "hospitality", title: "Hospitality", count: 65, summary: "Hotels · Food · Events", accent: "mint" },
  { id: "finance", title: "Finance", count: 54, summary: "Banking · Analysis", accent: "sky" },
  { id: "accounting", title: "Accounting", count: 46, summary: "Books · Tax · Payroll", accent: "sand" },
  { id: "design", title: "Design", count: 39, summary: "Product · Visual · UX", accent: "ink" },
  { id: "customer-service", title: "Customer Service", count: 91, summary: "Support · Success", accent: "sky" },
  { id: "education", title: "Education", count: 33, summary: "Teaching · Training", accent: "mint" },
  { id: "healthcare", title: "Healthcare", count: 28, summary: "Care · Wellness", accent: "sky" },
  { id: "engineering", title: "Engineering", count: 48, summary: "Civil · Mechanical", accent: "ink" },
  { id: "construction", title: "Construction", count: 37, summary: "Projects · Trade", accent: "sand" },
  { id: "logistics", title: "Logistics", count: 58, summary: "Supply · Delivery", accent: "mint" },
  { id: "administration", title: "Administration", count: 61, summary: "Office · Operations", accent: "sky" },
  { id: "retail", title: "Retail", count: 77, summary: "Stores · Merchandising", accent: "sand" },
  { id: "operations", title: "Operations", count: 69, summary: "Planning · Process", accent: "mint" },
];

export const popularCategoryIds = ["sales", "marketing", "hospitality", "design", "finance"];
export const careerCategoryIds = ["customer-service", "education", "healthcare", "engineering", "construction", "logistics", "administration", "retail", "operations"];

export function getOpportunityCategory(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return opportunityCategories.find((category) => category.id === normalized || category.title.toLowerCase() === normalized);
}

export function getCategoryById(id: string) {
  return opportunityCategories.find((category) => category.id === id);
}
