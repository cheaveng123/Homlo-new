// components/design-tokens.ts
// Canonical design tokens (small-components-only). Preserves existing fonts/assets.
// Created as part of batch 1 job card redesign; legacy theme files remain untouched.

import { Platform, type ShadowStyleIOS, type ViewStyle } from "react-native";

import { fonts } from "@/lib/typography";
import { fontFamily } from "@/theme/tokens";

const BRAND = "#08675F";
const BRAND_NEAR = "#0F6E56";

// Build teal ramp around #08675F (deep teal from design.md)
export const brand = {
  50: "#F2F7F6",
  100: "#E6F0EC",
  200: "#CFE5DE",
  300: "#B9D9D1",
  400: "#8FC4B2",
  500: BRAND_NEAR, // near existing primary
  600: BRAND, // canonical brand
  700: "#065549",
  800: "#053F3A",
  900: "#032A22",
  DEFAULT: BRAND,
  surface: "#F1F8F2",
  surfaceSoft: "#EAF6EC",
  border: "#D5EBDC",
  textOnPrimary: "#FFFFFF",
} as const;

// Semantic neutrals (aligned with existing UI values, consolidated)
export const neutrals = {
  white: "#FFFFFF",
  page: "#FFFFFF",
  surface: "#FFFFFF",
  ink: "#17201A",
  textPrimary: "#17201A",
  textSecondary: "#66736A",
  textTertiary: "#83918A",
  muted: "#66736A",
  sub: "#66736A",
  border: "#E8ECEA",
  borderStrong: "#E2E8E5",
  line: "#ECEEEC",
  chipBg: "#EAF6EC",
  overlayLight: "rgba(255,255,255,0.92)",
} as const;

export const semantic = {
  card: {
    bg: neutrals.surface,
    border: neutrals.border,
    borderSelected: brand[500],
    bgSelected: brand.surface,
    borderEmphasized: brand[300],
    borderLeft: brand[500],
  },
  text: {
    primary: neutrals.textPrimary,
    secondary: neutrals.textSecondary,
    tertiary: neutrals.textTertiary,
    brand: brand[600],
    onPrimary: brand.textOnPrimary,
  },
  accent: {
    primary: brand[600],
    primarySoft: brand.surfaceSoft,
    primaryTint: brand.surface,
  },
  icon: {
    default: neutrals.textTertiary,
    brand: brand[600],
    onPrimary: brand.textOnPrimary,
  },
  surface: {
    page: neutrals.page,
    card: neutrals.surface,
  },
  status: {
    /** The heart reads red once a job is saved, matching the category listing. */
    saved: "#EF4444",
    /** Unsaved heart stays neutral so only the saved state carries colour. */
    unsaved: neutrals.textTertiary,
  },
  overlay: {
    /** Scrim for controls that sit on top of a job photo. */
    onMedia: "rgba(8, 103, 95, 0.55)",
    onMediaCard: neutrals.overlayLight,
    /** Bottom fade from photo into the card body. */
    mediaFade: ["rgba(255,255,255,0)", "rgba(255,255,255,0.85)"] as const,
  },
} as const;

export const radius = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 10,
  4: 12,
  5: 14,
  6: 16,
  7: 20,
  8: 24,
  9: 28,
  10: 32,
} as const;

export const type = {
  // Card titles (keep existing families, harmonize scale)
  cardTitle: {
    fontFamily: fonts.heading.semibold,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  cardTitleSm: {
    fontFamily: fonts.heading.semibold,
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  cardTitleXs: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    lineHeight: 17,
  },
  // Body/meta
  bodySm: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  bodyXs: {
    fontFamily: fonts.body.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  labelSm: {
    fontFamily: fonts.body.medium,
    fontSize: 11.5,
    lineHeight: 15,
  },
  labelXs: {
    fontFamily: fonts.body.semibold,
    fontSize: 10.5,
    lineHeight: 14,
  },
  // Salary/accents
  salaryLg: {
    fontFamily: fonts.heading.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  salaryMd: {
    fontFamily: fonts.heading.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  salarySm: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  // Company
  company: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  companySm: {
    fontFamily: fonts.body.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
} as const;

// Beautiful Shadows (neutral, layered) translated to RN StyleSheet
export const shadows = {
  sm: Platform.select<ViewStyle & ShadowStyleIOS>({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {},
  })!,
  md: Platform.select<ViewStyle & ShadowStyleIOS>({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  lg: Platform.select<ViewStyle & ShadowStyleIOS>({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.16,
      shadowRadius: 48,
    },
    android: { elevation: 10 },
    default: {},
  })!,
} as const;
