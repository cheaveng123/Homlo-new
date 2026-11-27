// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      // Untracked design-delivery reference copies that the app never imports
      "JobDashboardScreen.js",
      "AuthScreen.tsx",
      "AnimatedPlaceholder.tsx",
      "01_AnimatedSearchPlaceholder.tsx",
      "tmp_bar.tsx",
      "tmp_fix.tsx",
      "components/AnimatedPlaceholder.tsx",
      "components/search/AnimatedSearchPlaceholder.tsx",
      "reference/**",
      // Scratch / export folders that are not part of the app
      ".expo/**",
      "files-*/**",
      "mnt/**",
      "legacy/**",
      "temp-export/**",
      "temp-export-try/**",
      "homlo-applications-rn/**",
      // Root-level design drafts that nothing in the app imports
      "01_exploreShared.tsx",
      "01_profileTheme.ts",
      "02_JobsMapHero.tsx",
      "03_AppIcon.tsx",
      "03_ExploreScreen.tsx",
      "04_ProfileUI.tsx",
      "05_ProfileScreen.tsx",
      "06_ProfileSection.tsx",
      "07_jobsTheme.ts",
      "08_jobsData.ts",
      "09_JobsUI.tsx",
      "10_RecommendedScreen.tsx",
      "11_WaysToWorkScreen.tsx",
      "12_JobsMap.tsx",
      "13_NearYouScreen.tsx",
      "14_CategoryScreen.tsx",
      "AnimatedSearchBar.tsx",
      "FinderButton.tsx",
      "HomeHeaderBackground.tsx",
      "HomeScreen.tsx",
      "PhotoPlaceholder.tsx",
      "QuickSearchRow.tsx",
      "RecommendHeroV4.tsx",
      "SearchDetailScreen.tsx",
      "boost.tsx",
      "edit.tsx",
      "jobs.tsx",
    ],
  },
  {
    // The base Repository has a protected constructor; each subclass's
    // one-line constructor is what makes it public, so it isn't "useless".
    files: ["backend/repositories/**/*.ts"],
    rules: { "@typescript-eslint/no-useless-constructor": "off" },
  },
]);
