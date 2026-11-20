import { describe, expect, it } from "vitest";

import { parseCoordinateLocation, parseOnboardingAnswers } from "../lib/onboarding";

describe("parseOnboardingAnswers", () => {
  it("reads what onboarding saves", () => {
    const raw = JSON.stringify({
      workTypes: ["Part-time", "Weekend"],
      location: " Phnom Penh ",
      availability: ["Mon", "Sat"],
      experience: "Some Experience",
      time: "Evening",
    });
    expect(parseOnboardingAnswers(raw)).toEqual({
      workTypes: ["Part-time", "Weekend"],
      location: "Phnom Penh",
      availability: ["Mon", "Sat"],
      experience: "Some Experience",
      time: "Evening",
    });
  });

  it("returns null for missing or broken data instead of throwing", () => {
    expect(parseOnboardingAnswers(null)).toBeNull();
    expect(parseOnboardingAnswers("")).toBeNull();
    expect(parseOnboardingAnswers("{not json")).toBeNull();
    expect(parseOnboardingAnswers("null")).toBeNull();
  });

  it("drops values of the wrong type", () => {
    const raw = JSON.stringify({ workTypes: ["Remote", 4, "", null], location: 12, availability: "Mon", experience: true });
    expect(parseOnboardingAnswers(raw)).toEqual({ workTypes: ["Remote"], location: "", availability: [], experience: "", time: null });
  });
});

describe("parseCoordinateLocation", () => {
  it("recognises the 'lat, lng' onboarding saves for a shared device location", () => {
    expect(parseCoordinateLocation("11.5564, 104.9282")).toEqual({ latitude: 11.5564, longitude: 104.9282 });
    expect(parseCoordinateLocation("-33.8688,151.2093")).toEqual({ latitude: -33.8688, longitude: 151.2093 });
  });

  it("treats place names and out-of-range numbers as text", () => {
    expect(parseCoordinateLocation("Phnom Penh")).toBeNull();
    expect(parseCoordinateLocation("Street 51, 12")).toBeNull();
    expect(parseCoordinateLocation("95.1, 10")).toBeNull();
    expect(parseCoordinateLocation("10, 190")).toBeNull();
  });
});
