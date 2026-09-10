export const ONBOARDING_COMPLETE_KEY = "homlo.onboarding.complete.v2";
export const ONBOARDING_PREFERENCES_KEY = "homlo.onboarding.preferences";

export type OnboardingPreferences = {
  workTypes: string[];
  location: string;
  availability: string[];
  experience: string;
};

export const defaultOnboardingPreferences: OnboardingPreferences = {
  workTypes: [],
  location: "Phnom Penh",
  availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  experience: "No Experience",
};
