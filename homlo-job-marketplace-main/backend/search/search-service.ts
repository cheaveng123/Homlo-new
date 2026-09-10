import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { parseSearchQuery, buildSearchParams, searchInputSchema, type SearchInput } from "./query-parser";

export type SearchJobRecord = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number;
  created_at: string;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image: string | null;
  relevance_score: number;
};

export class SearchService {
  constructor(private readonly database: DatabaseAdapter) {}

  async search(input: SearchInput): Promise<{ jobs: SearchJobRecord[]; total: number }> {
    const validatedInput = searchInputSchema.parse(input);
    const rawQuery = validatedInput.query ?? "";
    const parsedIntent = parseSearchQuery(rawQuery);
    const params = buildSearchParams(validatedInput, parsedIntent);

    const { rows } = await this.database.query<SearchJobRecord>(
      `select * from homlo_search_public_jobs(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        params.p_query,
        params.p_category,
        params.p_location,
        params.p_employment_type,
        params.p_arrangement,
        params.p_experience,
        params.p_salary_min,
        params.p_salary_max,
        params.p_posted,
        params.p_latitude,
        params.p_longitude,
        params.p_radius_km,
        params.p_sort,
        params.p_limit,
        params.p_offset,
        params.p_bbox,
      ]
    );

    return {
      jobs: rows,
      total: rows.length,
    };
  }
}