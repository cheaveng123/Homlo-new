export const ONBOARDING_COMPLETE_KEY = "homlo.onboarding.complete.v2";
export const ONBOARDING_PREFERENCES_KEY = "homlo.onboarding.preferences";

export type OnboardingPreferences = {
  workTypes: string[];
  location: string;
  availability: string[];
  experience: string;
};

/** What onboarding saved: the preferences plus the chosen time of day. */
export type SavedOnboardingAnswers = OnboardingPreferences & { time: string | null };

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

/**
 * Parses the JSON onboarding stored under ONBOARDING_PREFERENCES_KEY.
 * Returns null for missing or malformed data; never throws.
 */
export function parseOnboardingAnswers(raw: string | null | undefined): SavedOnboardingAnswers | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data || typeof data !== "object") return null;
    return {
      workTypes: stringList(data.workTypes),
      location: typeof data.location === "string" ? data.location.trim() : "",
      availability: stringList(data.availability),
      experience: typeof data.experience === "string" ? data.experience : "",
      time: typeof data.time === "string" ? data.time : null,
    };
  } catch {
    return null;
  }
}

/**
 * Onboarding stores "lat, lng" when the person shared their device location.
 * Returns the numbers for that case, or null for a typed place name.
 */
export function parseCoordinateLocation(location: string): { latitude: number; longitude: number } | null {
  const match = location.trim().match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export const defaultOnboardingPreferences: OnboardingPreferences = {
  workTypes: [],
  location: "Phnom Penh",
  availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  experience: "No Experience",
};
