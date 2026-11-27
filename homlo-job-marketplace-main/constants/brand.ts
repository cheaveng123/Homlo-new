export const BRAND_COLORS = {
  cyan: "#0891B2",
  darkTeal: "#062B35",
  orange: "#FFB020",
  lightCyan: "#67E8F9",
} as const;

export const BRAND_PATHS = {
  appIcon: "./assets/branding/png/app-icon-1024.png",
  androidForeground: "./assets/branding/png/mark-symbol-only-white.png",
  androidMonochrome: "./assets/branding/png/mark-symbol-only-white.png",
  splashMark: "./assets/branding/png/mark-white.png",
  androidSplashMark: "./assets/branding/png/mark-symbol-only-white.png",
  logoOnBlue: "./assets/branding/png/logo-on-blue.png",
  logoOnDark: "./assets/branding/png/logo-on-dark.png",
  logoPrimary: "./assets/branding/png/logo-primary.png",
} as const;

export const BRAND_IMAGES = {
  logoOnBlue: () => require("../assets/branding/png/logo-on-blue.png"),
  logoOnDark: () => require("../assets/branding/png/logo-on-dark.png"),
} as const;
