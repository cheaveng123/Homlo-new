// Typography tokens for the whole job-detail family (job detail, apply, location,
// requirements, distance map, employer card).
//
// BOTH FAMILIES ARE NOW THE HOME PAGE'S. Plus Jakarta Sans carries headings and
// titles; Inter carries body copy, captions and meta. That is the same pairing
// the home job card uses, so a card and the detail page it opens read as one
// object rather than as two apps.
//
// This file used to run Space Grotesk for headings and Manrope for body. Both
// are still loaded globally (lib/typography.ts -> app/_layout useFonts) and are
// still used elsewhere, but not here: they were the reason the detail screens
// looked heavier and more technical than the feed that links into them.
//
// The tokens are referenced from the home theme rather than written as string
// literals, so these screens cannot drift away from home again. Only family and
// weight are borrowed; sizes stay page-appropriate.

import { colors as homeColors, fontFamily as homeFont } from "@/components/home/theme";

export const fonts = {
  /** Section headings and anything acting as a heading. */
  headingSemiBold: homeFont.bold, // PlusJakartaSans_700Bold
  headingMedium: homeFont.semibold, // PlusJakartaSans_600SemiBold
  /** Body copy, form labels, captions, buttons - the Inter half of the pair. */
  bodyRegular: homeFont.interRegular, // Inter_400Regular
  bodyMedium: homeFont.interMedium, // Inter_500Medium
  bodySemiBold: homeFont.interSemiBold, // Inter_600SemiBold
};

export const type = {
  // Job container title. Bold in the home card's typeface and ink, per request.
  h1: {
    fontFamily: homeFont.bold, // PlusJakartaSans_700Bold
    fontSize: 20,
    lineHeight: 26,
    color: homeColors.ink, // #12303C
  },
  // Section headings ("Job description", "Requirements", ...). Home's section
  // titles are the heaviest type on the feed, so this is Plus Jakarta Bold
  // rather than the 600 it used to be.
  h2: {
    fontFamily: homeFont.bold, // PlusJakartaSans_700Bold
    fontSize: 17,
    lineHeight: 24,
    color: homeColors.textPrimary,
  },
  // Pay is the number the page is scanned for, so it gets home's heaviest weight.
  price: {
    fontFamily: homeFont.extraBold, // PlusJakartaSans_800ExtraBold
    fontSize: 18,
    lineHeight: 25,
    color: homeColors.textPrimary,
  },
  // Stat strip values sit directly under the title, so they follow the home
  // card's meta typography rather than the body family.
  statValue: {
    fontFamily: homeFont.interSemiBold, // Inter_600SemiBold
    fontSize: 16,
    lineHeight: 20,
    color: homeColors.ink,
  },
  statLabel: {
    fontFamily: homeFont.interMedium, // Inter_500Medium
    fontSize: 12,
    lineHeight: 15,
    color: homeColors.sub, // #5D7480
  },
  // "Company A - Location" under the title - home's location meta style.
  jobSubtitle: {
    fontFamily: homeFont.interMedium, // Inter_500Medium
    fontSize: 14,
    lineHeight: 19,
    color: homeColors.sub, // #5D7480
  },
  // Job description and any long-form copy.
  body: {
    fontFamily: homeFont.interRegular, // Inter_400Regular
    fontSize: 15,
    lineHeight: 24,
    color: homeColors.textPrimary,
  },
  // Form field labels on the apply screen.
  label: {
    fontFamily: homeFont.interMedium, // Inter_500Medium
    fontSize: 14.5,
    lineHeight: 19.5,
    color: homeColors.textPrimary,
  },
  caption: {
    fontFamily: homeFont.interRegular, // Inter_400Regular
    fontSize: 13,
    lineHeight: 17,
    color: homeColors.sub,
  },
  button: {
    fontFamily: homeFont.interSemiBold, // Inter_600SemiBold
    fontSize: 16,
    lineHeight: 21,
  },
};