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
    ],
  },
]);
