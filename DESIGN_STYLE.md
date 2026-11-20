# Homlo mobile design style (React Native / Expo)

Use this file as the brief when designing new pages. It describes the look the user has approved across the Explore, Employer dashboard, job manager, applicants, boost and checkout screens. The rule that matters most: **change only how things look. Never change data, routes, API calls, handlers or business logic.**

---

## 1. Principles

1. **Professional, not playful.** No cartoon styling, no sparkle effects, no flashy glows. The user has asked for "plain" repeatedly.
2. **Plain white first.** Page backgrounds and headers are white (`#FFFFFF`). Colour lives in small accents: icons, one status tint, one primary button.
3. **Clear hierarchy.** One large navy title, a muted subtitle, then content. Each card has one job.
4. **Quiet depth.** Depth comes from a thin border plus a very faint shadow. No top light lines, no glowing edges.
5. **Custom icons.** Every key icon is drawn as an SVG line glyph (stroke about 1.8–2.2, round caps and joins). Add a custom glyph rather than reusing a generic one when a new concept needs an icon.
6. **Real content only.** Show real counts and data. Empty states get a custom line illustration and a plain sentence.

---

## 2. Colour

### Primary palette (employer side, `components/employer-job/applicants/tokens.ts`, object `AP`)

| Token | Hex | Use |
|---|---|---|
| `navy` | `#14324A` | Titles, primary buttons, selected states, key numbers |
| `cyan` | `#0891B2` | Accent icons, active progress, links |
| `cyanDeep` | `#0B6F8A` | Text on tints, icons on light cyan |
| `cyanSoft` | `#3FC1DB` | Rare highlights |
| `amber` | `#F5A524` | Attention: "new", boost, unread, seat markers |
| `amberSoft` | `#FFC765` | Amber gradient start |
| `amberDeep` | `#A8620B` | Amber text on white (readable) |
| `tint` | `#DCF1F6` | Icon tiles, soft chip backgrounds |
| `bg` | `#F3F6F5` | Input and quote backgrounds, switch track |
| `line` | `#E6EDEF` | Card borders |
| `ink` | `#12303C` | Body text |
| `muted` | `#6A7C84` | Secondary text, meta |
| `faint` | `#9AABB1` | Placeholder, tertiary |
| `white` | `#FFFFFF` | Page and card background |
| `danger` | `#C0392B` | Reject, cancel, errors |
| `dangerTint` | `#FBEAE6` | Reject button background |

### Other tokens in use

- Divider hairline: `#D5DEE2` or `#E3E9EC`, width `StyleSheet.hairlineWidth`.
- Explore (`components/explore/v2/tokens.ts`, `EX`): uses navy, cyanDeep and amber. Explore has one warm header shade (`#FFE9C7 → #FFF6E6 → #FFFFFF`). Only Explore gets the warm shade.
- Older theme (`NewTheme.ts`, `c`): teal `#0E7C86`, deep `#073B42`, cream `#FFF1D2`. Avoid for new work. Prefer `AP`.
- Boost and checkout pages: near-monochrome. White, grey (`#6A7C84`), navy. Keep colour to the plan picture.

### Colour rules

- Maximum about three colours on one screen: navy text, cyan or amber accent, neutrals.
- Amber means "needs attention" or "boost". Do not use it for decoration.
- Status uses icon + label + tint, never a dot and a colour alone.
- Don't put text on amber or cyan at low contrast. Navy text on amber is fine; white on amber is not.

---

## 3. Typography

Fonts (loaded through `expo-font`, referenced by these names):

| Role | Font | Name constant |
|---|---|---|
| Display / titles | Plus Jakarta Sans ExtraBold | `f.h` = `PlusJakartaSans_800ExtraBold` |
| Subheads, buttons, labels | Plus Jakarta Sans Bold | `f.hb` = `PlusJakartaSans_700Bold` |
| Body | Inter Regular | `f.b` = `Inter_400Regular` |
| Meta, secondary | Inter Medium | `f.m` = `Inter_500Medium` |
| Small emphasis | Inter SemiBold | `f.s` = `Inter_600SemiBold` |

Scale used on recent screens:

- Hero title: 26–30 px, `f.h`, line height about 1.15, letter spacing -0.4 to -0.5.
- Page title in a top bar: 16–18 px, `f.h`.
- Section header: 18–20 px, `f.h`, navy.
- Card title: 15–17 px, `f.h` or `f.hb`, navy.
- Body: 14 px, `f.b`, line height 19–20, ink colour.
- Meta: 12–13 px, `f.m`, muted.
- Kicker (small uppercase label): 11 px, `f.h`, letter spacing 1.3, amberDeep or muted.
- Big numbers (stats): 20–28 px, `f.h`, navy.

Rules: use `f.h` only for titles and big numbers. Don't mix more than two weights in a card.

---

## 4. Shape, spacing and depth

### Corner radius (use these, avoid heavy rounding)

- Page and sheet top corners: 26 px (only for a sheet over a hero).
- Large cards: 16–20 px.
- Inner tiles, quotes, inputs, buttons: 12–14 px.
- Icon tiles: 10–14 px. Not circles.
- Chips and status badges: 8–9 px (rectangular chips) or 999 px (round filter pills only when a row of filters needs it).
- Circle buttons: only for the back and more buttons in a top bar (44 × 44, radius 22).

The user has said there are too many round corners. Default to 12–16 px rectangles. Use fully round shapes only for avatars, the top-bar buttons and the status ring.

### Spacing

- Side gutter: **16 px** (the rule the user has asked for).
- Gap between cards: 10–14 px.
- Inside card padding: 14–16 px.
- Section spacing: 22–28 px above a section header, 12 px below.
- Touch targets: at least 44 × 44.

### Borders and shadows

- Default card: `borderWidth: 1`, `borderColor: #E3E9EC` (or `AP.line`), white fill, very faint shadow.
  - Faint shadow: `shadowColor: '#12303C'`, `shadowOpacity: 0.04`, `shadowRadius: 8`, `shadowOffset: { width: 0, height: 2 }`, `elevation: 1`.
- Floating stats card over a hero: `shadowColor '#06425A'`, `shadowOpacity 0.18`, `shadowRadius 12`, `shadowOffset { 0, 6 }`, `elevation 5`. This is the `liftShadow` token.
- Primary button, boost card or glass card: `liftShadow` or the glass rim (see section 6).
- Don't use: top light lines on cards (`TopLight`), coloured glows, shadows heavier than `liftShadow`, or two shadows on one element.

---

## 5. Layout patterns

### Screen anatomy

1. **Top bar** (absolute or sticky): back button (white circle, 1 px border `#E3E9EC`) on the left, a centred title that fades in on scroll, and an optional more (⋯) button on the right. Background white.
2. **Header block**: large title (`f.h`, 24–30 px, navy), then a muted meta line with dot separators (·).
3. **Content**: cards in a vertical list, 16 px gutters.
4. **Sticky controls** (filters, status switch): white, hairline bottom border. When the header scrolls away, a pinned copy takes over (see section 7).

### Common components

- **Segmented switch**: `bg #F3F6F5`, radius 16, padding 4, active pill white with a soft shadow, count badges next to labels.
- **Filter chips**: height 38, radius 12, 1 px border `#E3E9EC`. Active chip is solid navy with white text. Show an icon and a count.
- **Stat strip**: one white floating card with 3 columns. Each column: a 30 px glyph (no background tile), the big number, then a label. Thin vertical dividers `#E3E9EC`.
- **Progress ring**: 78 px, 8 px stroke, grey track `#E3EEF1`, cyan arc, centred `n/total`.
- **Seat markers**: 24 px squares, radius 8. Filled = navy. Open = dashed amber border on `#FFF7EA`.
- **Status badge**: height 28, radius 9, 1 px border, white fill, icon 14 px in the status colour, label in `f.hb` 12.5 px in the status colour. Statuses: Open (cyan), Filled (navy), Closed (grey), Expired (tan), Cancelled (red), Draft (amber).
- **Applicant card**: white, radius 16, avatar 50 px circle (gradient or photo), name `f.hb`, meta with clock and pin glyphs, status tag top-right, quote box (`bg` fill, 3 px cyan bar on the left), footer actions: Reject (tint red, 46 px), Message (cyan tint with cyanDeep text), Accept (navy or cyan gradient, white text).
- **Job list card** (employer side): white, radius 20, border `#E3E9EC`, title `f.h` 17 px, meta line with pin glyph, status badge, "N new" chip (amber tint, dot), footer row with avatar stack, applicant count and posted date with a chevron. Boosted: small white tile with a static amber bolt on the right of the title and time left below it. No glow.
- **Empty state**: custom line-art illustration on **no background**, a bold 16–18 px title in navy, one short muted sentence (max 280 px wide), and optionally one outline button (1 px border, radius 12, navy text).
- **Primary button**: height 50–54, radius 12–16, navy gradient `#21486A → #14324A` diagonal, white `f.h` 15 px text, subtle top sheen (`rgba(255,255,255,0.14)` fading to 0 over the top 60%). Pressed: scale 0.97.
- **Accent button** (boost): amber gradient `#FFC765 → #F5A524`, navy text.
- **Secondary button**: white, 1 px border, navy text.
- **Destructive**: white with red border `#F3C9C0`, red text.
- **Bottom action bar** (checkout, boost): white, top hairline, horizontal row: label and total on the left, navy button on the right. Frosted bars are allowed only on the boost plan screen.

---

## 6. Glass (used sparingly)

Glass is used only for the boost plan hero and the boost card, and only in a clear, low-saturation way:

- Behind the glass: soft amber and cyan blobs, blurred (`expo-blur` `BlurView`, intensity 30–50, tint light).
- Glass fill: `rgba(255,255,255,0.34–0.5)`.
- Rim: 1.2 px `rgba(255,255,255,0.95)` on top of the glass.
- Top sheen: `rgba(255,255,255,0.85) → 0` over the top 56–60 px.
- A slow sheen sweep every few seconds is allowed on the boost card only. Stop it when reduced motion is on.

Do not add glass to other screens unless the user asks.

---

## 7. Motion

Motion must feel calm, with no bounce and no looping attention-seekers on normal content.

- **Easing**: `SMOOTH` from `src/design/motion` (ease out, no overshoot). Use `smooth(value, ms)` or `withTiming(…, { easing: SMOOTH })`.
- **Durations**: 180–300 ms for taps and state changes; 400–450 ms for entrances; 900–1100 ms for progress rings and counters.
- **Entrances**: `Reveal` (FadeInDown, delay `i * 70` ms, duration 420 ms) for each block. List rows: `FadeInDown.delay(i * 60–80)`.
- **Layout changes**: `LinearTransition` on lists so rows slide, not jump.
- **Press feedback**: `PressableScaleNew` (`scaleTo` 0.94–0.985) plus `haptic.selection()` on selections, `haptic.success()` on success.
- **Count-up**: numbers count up once on mount (`CountUp`, `useCountUpNew`), about 700–900 ms.
- **Looping**: only on small signals. Examples: the boost bolt charging, the pulse dot on a new applicant (14 px amber, ring expands every ~2.3 s), the slow orbit rings on the boost hero. Keep loops slow (1.2–3.6 s) and subtle.
- **Reduced motion**: always check `useReducedMotion()` and skip loops and counts when it is true.

### Scroll behaviour (pattern used on Explore, Home, the job manager and New applicants)

- The hero moves at about 0.4–0.45 of scroll speed (parallax), and fades out over roughly the first 55% of its height.
- The page scrolls under the top bar. The title fades in on the top bar after about 50–100 px of scroll.
- Sticky controls (tabs, status switch) pin under the top bar. Use a **real** inline element plus a fixed copy with `opacity` animated from scroll position.
- The fixed copy must set `pointerEvents` from React state (driven by `useAnimatedReaction` + `runOnJS`), not always `auto`. Otherwise taps land on stale positions on iOS (Fabric hit-test issue).
- Pulling down past the top: stretch the hero image or the warm shade (`translateY` plus `scaleY`). Never show white above the content.

---

## 8. Iconography

- **Line glyphs** (utility, in lists and tiles): `viewBox 0 0 24 24`, stroke 1.8–2.2, `strokeLinecap round`, `strokeLinejoin round`, `fill none`. One accent detail per glyph (a dot, a spark, a filled shape), in amber or cyan.
- **Sizes**: 14–16 px inline with text, 18–22 px in buttons, 24–30 px for stat glyphs, 40–56 px for icon tiles.
- **Explore tabs**: rendered 3D-style SVG icons (briefcase, folded map with red pin, office tower with a person waving). Keep these as they are unless asked. They use gradients and a soft drop shadow.
- **Custom empty-state art**: line illustration, two or three colours at most (navy outline, grey details, one amber or cyan accent), no background tile. Example: open folder with an amber magnifier.
- **Don't**: use emoji, generic clip-art, filled multicolour icons on busy rows, or icon-only buttons without an `accessibilityLabel`.

---

## 9. Copy and tone

- Short, plain English. Sentence case for headings ("Applicants", "No open jobs right now").
- Use the real count with the noun: "1 applicant", "3 applicants", "2 seats still open".
- Empty states say what happens next: "New applicants will show up here."
- Avoid exclamation marks and marketing words.
- Dates: relative for recent items ("Posted 3 days ago", "Applied 2w ago"), grouped headers: Today, Yesterday, This week, Earlier.
- Money: `$` prefix, two decimals for prices, `/mo` or `/hr` suffix in a smaller muted size.

---

## 10. Page checklist for new screens

Before finishing a new page, check:

- [ ] Background is white; no gradient above the content unless it is Explore's warm header.
- [ ] Title is `f.h` navy, with one muted subtitle line.
- [ ] 16 px side gutters everywhere; no horizontal page scroll on a phone.
- [ ] Cards: white, radius 12–20, 1 px `#E3E9EC` border, faint shadow only.
- [ ] Round shapes only for avatars, top-bar buttons and the status ring.
- [ ] Status shown with icon + label + tint (never a dot alone).
- [ ] At most one accent colour per block; amber only for attention or boost.
- [ ] Icons are custom line glyphs with an `accessibilityLabel` on the control.
- [ ] Empty state uses the custom line art on no background, with a short sentence.
- [ ] Primary action is the one navy button; secondary actions are outline or tint.
- [ ] Motion: `SMOOTH` easing, entrances via `Reveal`/`FadeInDown`, loops only for small signals, all disabled by reduced motion.
- [ ] Sticky controls pin with state-driven `pointerEvents`.
- [ ] No data, route or logic changes. Type-check (`npx tsc --noEmit -p .`) and lint (`npx eslint <files>`) pass.

---

## 11. Things the user has rejected (avoid)

- Light lines or glows along the top of cards (`TopLight`) — removed from employer screens.
- Warm or tinted backgrounds on pages other than Explore.
- Too many rounded pills and circles.
- Flashy animated highlights, pulsing badges on every card, sparkles.
- Dot-and-colour status pills with no icon.
- Overlapping badges (e.g. a "Boosted" tag on top of a "new" tag). Keep badges in their own row or column.
- Cartoony or "AI-looking" illustrations. Keep art line-based and restrained.
- Too many colours on payment or checkout pages.

---

## 12. Where things live

| Area | Files |
|---|---|
| Explore screen | `components/explore/ExploreScreen.tsx`, `components/explore/v2/ExploreParts.tsx`, `ExploreFeature.tsx`, `ExploreListParts.tsx`, `TabIcons3D.tsx`, `tokens.ts` |
| Home | `src/new/screens/HomeScreenNew.tsx`, `src/new/components/home/*` |
| Employer dashboard | `src/new/components/dashboard/*` |
| Applicants (new page) | `components/employer-job/NewApplicantsScreen.tsx`, `components/employer-job/applicants/*` (tokens, glyphs, cards) |
| Job manager | `NewJobManager.tsx`, `components/employer-job/manager/JobManagerParts.tsx`, `JobStatusBadge.tsx` |
| Employer job lists | `components/employer-job/EmployerJobsListScreen.tsx`, `EmployerJobCard.tsx` |
| View all jobs (employer) | `NewEmployerJobs.tsx`, `app/employer/[employerId]/` |
| Boost plan | `NewBoost.tsx`, `components/boost/*` |
| Boost checkout | `app/boost/payment.tsx` |
| Shared primitives | `src/design/primitives.tsx`, `src/design/motion.tsx`, `src/new/components/NewUI` (legacy wrappers), `src/new/components/PrimitivesNew` |

---

## 13. Prompt to paste into a new chat

> Design a new screen for the Homlo React Native (Expo) app following `/Users/mengcheaveng/Downloads/homlo-diff/DESIGN_STYLE.md`. Use plain white backgrounds, navy `#14324A` titles in Plus Jakarta Sans ExtraBold, Inter for body, 16 px side gutters, cards with a 1 px `#E3E9EC` border and a faint shadow, 12–16 px corners, custom line-art icons, and calm `SMOOTH` motion. Change visuals only — do not change data, routes, API calls or handlers. Add a custom line-art empty state on no background if the list can be empty. Type-check and lint before finishing.
