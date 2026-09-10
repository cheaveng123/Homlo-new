import { z } from "zod";

export type ParsedSearchIntent = {
  keywords: string[];
  location: string | null;
  employmentType: string | null;
  arrangement: string | null;
  experience: string | null;
  category: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  posted: string | null;
};

const STOP_WORDS = new Set([
  "i", "need", "a", "an", "the", "job", "jobs", "in", "for", "with", "near",
  "looking", "look", "find", "me", "please", "want", "to", "and", "or", "but",
  "is", "are", "am", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "can", "this", "that", "these", "those", "my", "your", "our", "their", "his", "her",
  "from", "at", "by", "on", "as", "if", "so", "than", "then", "when", "where", "why",
  "how", "what", "which", "who", "whom", "whose", "there", "here", "any", "some",
  "all", "each", "every", "no", "not", "only", "just", "also", "even", "still",
  "best", "good", "great", "top", "new", "latest", "recent"
]);

const CAMBODIA_LOCATIONS = [
  "cambodia", "phnom penh", "phnom pen", "siem reap", "sihanoukville",
  "battambang", "kampot", "kandal", "takeo", "kampong cham", "kampong speu",
  "kampong thom", "kampong chhnang", "prey veng", "svay rieng", "pursat",
  "banteay meanchey", "kratie", "mondulkiri", "ratanakiri", "stung treng",
  "oddar meanchey", "kep", "pailin"
];

const LOCATION_ALIASES: Record<string, string> = {
  "phnom pen": "phnom penh",
  "pp": "phnom penh",
  "siem reap": "siem reap",
  "sr": "siem reap",
  "sihanouk": "sihanoukville",
  "battambang": "battambang",
  "kampot": "kampot",
};

const EMPLOYMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  "part-time": ["part time", "part-time", "parttime", "half time", "half-time"],
  "full-time": ["full time", "full-time", "fulltime", "permanent"],
  "contract": ["contract", "freelance", "freelancer"],
  "temporary": ["temporary", "temp", "short term", "short-term"],
  "internship": ["internship", "intern", "trainee", "apprentice"],
  "weekend": ["weekend", "saturday", "sunday", "weekends"],
};

const ARRANGEMENT_KEYWORDS: Record<string, string[]> = {
  "remote": ["remote", "work from home", "wfh", "home based", "home-based", "online", "virtual"],
  "on-site": ["on site", "on-site", "onsite", "office", "in person", "in-person"],
  "hybrid": ["hybrid", "mixed", "flexible"],
};

const EXPERIENCE_KEYWORDS: Record<string, string[]> = {
  "no experience": ["no experience", "no prior experience", "without experience", "zero experience", "fresh graduate", "fresh grad", "entry level", "entry-level", "beginner", "student", "students", "new grad", "new graduate"],
  "entry level": ["entry level", "entry-level", "junior", "fresh graduate", "fresh grad", "new grad"],
  "1–2 years": ["1 year", "1-2 year", "1–2 year", "one year", "two year", "2 year"],
  "2–3 years": ["2 year", "2-3 year", "2–3 year", "two year", "three year", "3 year", "mid level", "mid-level"],
  "internship": ["internship", "intern", "trainee"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "hospitality": ["restaurant", "hotel", "cafe", "coffee shop", "bar", "waiter", "waitress", "server", "bartender", "chef", "cook", "kitchen", "hospitality", "front desk", "guest relations", "housekeeping"],
  "retail": ["retail", "shop", "store", "sales", "cashier", "cashier", "sales associate", "sales assistant"],
  "technology": ["software", "developer", "engineer", "programmer", "coding", "frontend", "backend", "fullstack", "full stack", "mobile", "web", "app", "tech", "it", "data", "analyst", "qa", "tester", "devops"],
  "marketing": ["marketing", "social media", "content", "seo", "sem", "growth", "brand", "advertising", "digital marketing"],
  "sales": ["sales", "account executive", "business development", "b2b", "b2c", "sales representative"],
  "customer service": ["customer service", "customer support", "call center", "help desk", "support agent", "client services"],
  "administration": ["admin", "administrator", "office", "receptionist", "secretary", "assistant", "coordinator"],
  "finance": ["accounting", "finance", "accountant", "bookkeeper", "financial analyst", "auditor"],
  "education": ["teacher", "teaching", "tutor", "instructor", "education", "academy", "school"],
  "logistics": ["delivery", "driver", "logistics", "warehouse", "supply chain", "transport", "courier"],
  "construction": ["construction", "engineering", "site engineer", "civil engineer", "architect", "builder"],
  "healthcare": ["nurse", "doctor", "medical", "healthcare", "pharmacy", "clinic", "hospital"],
};

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocation(query: string): { location: string | null; remaining: string } {
  const normalized = normalizeQuery(query);
  let location: string | null = null;
  let remaining = normalized;

  for (const loc of CAMBODIA_LOCATIONS) {
    const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`);
    if (regex.test(normalized)) {
      location = LOCATION_ALIASES[loc] ?? loc;
      remaining = remaining.replace(regex, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  return { location, remaining };
}

function extractEmploymentType(query: string): { employmentType: string | null; remaining: string } {
  const normalized = query.toLowerCase();
  let employmentType: string | null = null;
  let remaining = normalized;

  for (const [type, keywords] of Object.entries(EMPLOYMENT_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(normalized)) {
        employmentType = type;
        remaining = remaining.replace(regex, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }
    if (employmentType) break;
  }

  return { employmentType, remaining };
}

function extractArrangement(query: string): { arrangement: string | null; remaining: string } {
  const normalized = query.toLowerCase();
  let arrangement: string | null = null;
  let remaining = normalized;

  for (const [type, keywords] of Object.entries(ARRANGEMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(normalized)) {
        arrangement = type;
        remaining = remaining.replace(regex, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }
    if (arrangement) break;
  }

  return { arrangement, remaining };
}

function extractExperience(query: string): { experience: string | null; remaining: string } {
  const normalized = query.toLowerCase();
  let experience: string | null = null;
  let remaining = normalized;

  for (const [type, keywords] of Object.entries(EXPERIENCE_KEYWORDS)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(normalized)) {
        experience = type;
        remaining = remaining.replace(regex, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }
    if (experience) break;
  }

  return { experience, remaining };
}

function extractCategory(query: string): { category: string | null; remaining: string } {
  const normalized = query.toLowerCase();
  let category: string | null = null;
  let remaining = normalized;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(normalized)) {
        category = cat;
        remaining = remaining.replace(regex, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }
    if (category) break;
  }

  return { category, remaining };
}

function extractSalaryRange(query: string): { salaryMin: number | null; salaryMax: number | null; remaining: string } {
  const normalized = query;
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let remaining = normalized;

  const rangeMatch = normalized.match(/(\$?\d[\d,]*)\s*[-–—]\s*(\$?\d[\d,]*)/);
  if (rangeMatch) {
    salaryMin = parseInt(rangeMatch[1].replace(/[$,]/g, ""), 10);
    salaryMax = parseInt(rangeMatch[2].replace(/[$,]/g, ""), 10);
    remaining = remaining.replace(rangeMatch[0], " ").replace(/\s+/g, " ").trim();
    return { salaryMin, salaryMax, remaining };
  }

  const minMatch = normalized.match(/(?:at least|minimum|min|above|over)\s*\$?(\d[\d,]*)/i);
  if (minMatch) {
    salaryMin = parseInt(minMatch[1].replace(/[$,]/g, ""), 10);
    remaining = remaining.replace(minMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  const maxMatch = normalized.match(/(?:at most|maximum|max|under|below)\s*\$?(\d[\d,]*)/i);
  if (maxMatch) {
    salaryMax = parseInt(maxMatch[1].replace(/[$,]/g, ""), 10);
    remaining = remaining.replace(maxMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  return { salaryMin, salaryMax, remaining };
}

function extractKeywords(query: string): string[] {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ").filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return words;
}

export function parseSearchQuery(rawQuery: string): ParsedSearchIntent {
  let remaining = rawQuery;

  const { location, remaining: r1 } = extractLocation(remaining);
  remaining = r1;

  const { employmentType, remaining: r2 } = extractEmploymentType(remaining);
  remaining = r2;

  const { arrangement, remaining: r3 } = extractArrangement(remaining);
  remaining = r3;

  const { experience, remaining: r4 } = extractExperience(remaining);
  remaining = r4;

  const { category, remaining: r5 } = extractCategory(remaining);
  remaining = r5;

  const { salaryMin, salaryMax, remaining: r6 } = extractSalaryRange(remaining);
  remaining = r6;

  const keywords = extractKeywords(remaining);

  return {
    keywords,
    location,
    employmentType,
    arrangement,
    experience,
    category,
    salaryMin,
    salaryMax,
    posted: null,
  };
}

export const searchInputSchema = z.object({
  query: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  employmentType: z.string().max(50).optional(),
  arrangement: z.string().max(50).optional(),
  experience: z.string().max(50).optional(),
  location: z.string().max(160).optional(),
  salaryMin: z.number().finite().nonnegative().optional(),
  salaryMax: z.number().finite().nonnegative().optional(),
  posted: z.string().max(50).optional(),
  sort: z.enum(["recommended", "newest", "salary_high_to_low", "closest"]).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  radiusKm: z.number().finite().positive().max(200).optional(),
  // Bounding box "minLat,minLng,maxLat,maxLng" of a user-drawn polygon area.
  bbox: z.string().max(120).optional(),
  limit: z.number().int().positive().max(50).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export function buildSearchParams(input: SearchInput, parsedIntent: ParsedSearchIntent): {
  p_query: string;
  p_category: string;
  p_location: string;
  p_employment_type: string;
  p_arrangement: string;
  p_experience: string;
  p_salary_min: number | null;
  p_salary_max: number | null;
  p_posted: string;
  p_latitude: number | null;
  p_longitude: number | null;
  p_radius_km: number | null;
  p_sort: string;
  p_bbox: string;
  p_limit: number;
  p_offset: number;
} {
  const explicitQuery = input.query?.trim() ?? "";
  const inferredQuery = parsedIntent.keywords.join(" ");
  const combinedQuery = [explicitQuery, inferredQuery].filter(Boolean).join(" ");

  return {
    p_query: combinedQuery,
    p_category: input.category ?? parsedIntent.category ?? "",
    p_location: input.location ?? parsedIntent.location ?? "",
    p_employment_type: input.employmentType ?? parsedIntent.employmentType ?? "",
    p_arrangement: input.arrangement ?? parsedIntent.arrangement ?? "",
    p_experience: input.experience ?? parsedIntent.experience ?? "",
    p_salary_min: input.salaryMin ?? parsedIntent.salaryMin,
    p_salary_max: input.salaryMax ?? parsedIntent.salaryMax,
    p_posted: input.posted ?? "",
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_radius_km: input.radiusKm ?? null,
    p_sort: input.sort ?? "recommended",
    p_bbox: input.bbox ?? "",
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  };
}