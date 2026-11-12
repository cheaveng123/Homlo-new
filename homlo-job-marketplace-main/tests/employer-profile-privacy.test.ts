import { describe, expect, it, vi, beforeEach } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../backend/infrastructure/database/SupabaseAdapter", () => ({
  SupabaseAdapter: class {
    query = queryMock;
  },
}));

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-not-a-real-key";

import { coarsenCoordinate, getHomloDirectService } from "../server/homlo-direct-service";

const ROW = {
  user_id: "11111111-2222-3333-4444-555555555555",
  full_name: "Test Employer",
  profile_photo_key: null,
  banner_image: null,
  verified: true,
  bio: "About text",
  location_text: "Phnom Penh",
  latitude: 11.556374,
  longitude: 104.928207,
};

describe("public employer profile privacy", () => {
  beforeEach(() => queryMock.mockReset());

  it("does not return userId and coarsens coordinates", async () => {
    queryMock.mockResolvedValue({ rows: [ROW] });
    const result = await getHomloDirectService().getEmployerProfile("Test Employer");
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("userId");
    expect(JSON.stringify(result)).not.toContain(ROW.user_id);
    expect(result?.latitude).toBe(11.56);
    expect(result?.longitude).toBe(104.93);
  });

  it("keeps null coordinates as null and returns null for no match", async () => {
    queryMock.mockResolvedValue({ rows: [{ ...ROW, latitude: null, longitude: null }] });
    const result = await getHomloDirectService().getEmployerProfile("Test Employer");
    expect(result?.latitude).toBeNull();
    expect(result?.longitude).toBeNull();
    queryMock.mockResolvedValue({ rows: [] });
    expect(await getHomloDirectService().getEmployerProfile("Nobody")).toBeNull();
  });

  it("coarsenCoordinate handles strings and bad input", () => {
    expect(coarsenCoordinate("11.556374")).toBe(11.56);
    expect(coarsenCoordinate("abc")).toBeNull();
    expect(coarsenCoordinate(undefined)).toBeNull();
  });
});
