/**
 * jobDetailTokens.ts
 *
 * Exact values used by the HTML preview — sampled directly from your
 * screenshot, not eyeballed. The "looks less bold / weirder" gap between
 * previews and the shipped RN screen almost always comes from small
 * substitutions here (a slightly different hex, a default font-weight,
 * a rounded-vs-sharp corner radius). Import these constants into the
 * components below instead of re-typing values, and re-use the same
 * constants anywhere else this pill/positions block shows up.
 */

export const colors = {
  accent: '#0891B2',       // sampled from the real "Apply now" button
  accentSoft: '#EEF7FA',
  ink: '#17181A',
  ink2: '#75797E',
  ink3: '#A2A6AA',
  line: '#E7E7E8',
  surface: '#FFFFFF',
  white: '#FFFFFF',
} as const;

export const locationPill = {
  borderWidth: 1.5,
  borderRadius: 999, // full stadium pill, not a small radius
  paddingVertical: 8,
  paddingHorizontal: 16,
  gap: 7,
  iconSize: 14,
  fontSize: 13,
  fontWeight: '600' as const, // NOT '500' or default — this is what reads as "bold enough"
} as const;

export const positionsBlock = {
  textFontSize: 12.5,
  textColor: colors.ink2,
  containerBorderWidth: 1,
  containerBorderRadius: 10,
  containerPaddingVertical: 10,
  containerPaddingHorizontal: 12,
  segmentGap: 5,
  segmentHeight: 6,
  segmentRadius: 3,
} as const;

export const travelingLight = {
  /** Width of the moving white streak, in px, at the pill's own border radius. */
  streakLength: 46,
  streakThickness: 3,
  /** One full loop around the pill, in ms — matches the "slower" pass. */
  durationMs: 4600,
} as const;
