You are working on the existing **Homlo Jobs React Native (Expo) mobile app**.

Two components have already been designed and coded. Your job is to
**integrate the attached files into the existing Job Detail screen** —
not redesign the screen, not build these from scratch.

Attached files:
- `jobDetailTokens.ts` — exact colors/sizes, sampled from the real screen. Import from here, don't retype values.
- `TravelingBorderLight.tsx` — reusable wrapper that animates a white streak around any rounded-rect border
- `LocationPill.tsx` — the new location pill (replaces the old job-type pill), using TravelingBorderLight
- `PositionsProgress.tsx` — the new positions indicator (replaces the old OPEN/slots-remaining display)

## Why this prompt exists — read before touching anything

The last two rounds of RN implementation came out **less bold and slightly
off** from the confirmed HTML preview — a font-weight rounded down, a
color a shade off, padding tightened. That gap is the thing to avoid
here. Concretely:

- Do NOT retype the hex colors or size numbers by hand anywhere. Import
  them from `jobDetailTokens.ts`. If a value needs to change, change it
  in that one file.
- `fontWeight: '600'` on the pill text is not negotiable — don't let it
  collapse to `'500'` or a platform default.
- The pill's border radius is `999` (a true stadium shape) and its
  border is `1.5` — not a small rounded-rect, not a hairline.
- After wiring these in, put the RN screen and the confirmed HTML
  preview side by side (screenshot vs. simulator) before calling this
  done. If anything reads thinner, smaller, or paler than the preview,
  that's a bug to fix, not an acceptable platform difference.

## Steps

1. Inspect the existing Job Detail screen — its current job-type pill,
   its current OPEN/slots indicator, and where each sits relative to the
   stat card.
2. Replace the job-type pill with `<LocationPill />` in the exact same
   position, wired to the job's actual location name and a navigation
   handler to the existing location/map screen (do not build a new map
   screen for this).
3. Replace the OPEN/slots-remaining display with `<PositionsProgress />`
   directly below the stat card, wired to the job's actual
   `positionsTotal` / `positionsFilled` (or equivalent field names —
   adjust the prop wiring to match the real data, don't rename the real
   fields to match the component).
4. Confirm `react-native-reanimated`, `expo-linear-gradient`, and
   `react-native-svg` are already installed (they should be, per the
   project's existing stack) — if not, install rather than reimplementing
   their functionality inline.
5. Verify the traveling light runs smoothly at 60fps on a real device or
   a recent simulator, loops seamlessly with no jump or gap, and that the
   streak follows the pill's rounded corners rather than cutting the
   corner or drifting off the border.

## Verification checklist

- Location pill matches the preview: full pill shape, colored border,
  colored icon + bold (600) text, white fill.
- Traveling light is a soft white streak with fade at both ends (not a
  dot, not a hard-edged bar), moving at the slower/wider setting, tracing
  the pill's actual border including corners.
- Positions block shows the correct centered text and correct number of
  filled vs. unfilled segments for the job's real data, and updates
  correctly when an application is accepted elsewhere in the app.
- Tapping the location pill navigates to the existing location/map view.
- No visual regression to the rest of the Job Detail screen.
