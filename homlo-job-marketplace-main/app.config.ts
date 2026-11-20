// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "com.app.homlojobmarketplace";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "Homlo Jobs",
  appSlug: "homlo-job-marketplace",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "/manus-storage/homlo-jobs-icon_492089dd.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "Allow Homlo Jobs to use your location to show your position, nearby jobs, and driving routes.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    package: env.androidPackage,
    permissions: [
      "POST_NOTIFICATIONS",
      "INTERNET",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    [
      "expo-build-properties",
      {
        ios: {
          enableSceneSupport: true,
        },
      },
    ],
    "expo-router",
    "@maplibre/maplibre-react-native",
    "./plugins/with-react-native-config",
    "expo-font",
    "expo-asset",
    "expo-image",
    [
      "expo-secure-store",
      // Face ID is never used; keep the (never shown) purpose string honest.
      { faceIDPermission: "Homlo Jobs doesn't use Face ID, so it never asks for this access." },
    ],
    "expo-status-bar",
    "expo-web-browser",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow Homlo Jobs to use your location to show your position, nearby jobs, and driving routes.",
        // App Store 5.1.1: every purpose string must be specific. Background
        // location is never used.
        locationAlwaysPermission:
          "Homlo Jobs only uses your location while you're using the app, to show nearby jobs and driving routes. It never tracks you in the background.",
        motionPermission: "Homlo Jobs doesn't use motion or fitness data, so it never asks for this access.",
        locationAlwaysAndWhenInUsePermission:
          "Homlo Jobs only uses your location while you're using the app, to show nearby jobs and driving routes. It never tracks you in the background.",
      },
    ],
    [
      "expo-audio",
      {
        // Nothing in the app records audio; keep the (never shown) string honest.
        microphonePermission:
          "Homlo Jobs doesn't record audio, so it never asks for microphone access.",
      },
    ],
    [
      "expo-video",
      {
        // App Store 2.5.4: no background-audio mode — the only video is a muted,
        // in-app loop, so background playback is not needed.
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Homlo Jobs opens your photos only when you choose a picture for your profile, banner or a job listing.",
        cameraPermission:
          "Homlo Jobs uses your camera only when you choose to take a photo for your profile or a job listing.",
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
