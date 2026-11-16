// rqstage / rqTokens.ts
// Constants, palette and scene definitions for the Recommended-page banner ("quay stage").
// Pure data. No React, no Reanimated.

import { fonts } from '@/lib/typography';

export const RQ_CYCLE_MS = 7400; // one scene lasts this long
export const RQ_SCENE_COUNT = 3;
export const RQ_STAGE_W = 280; // right-anchored scene area (px)
export const RQ_STAGE_H = 250; // banner content height (px)
export const RQ_PERSON_SCALE = 1.4;
export const RQ_EMP_X = 80; // giver x inside the stage
export const RQ_CAND_X = 230; // receiver x inside the stage
export const RQ_FREEZE_MS = 3700; // pose shown when reduce-motion is on
export const RQ_WAVE_PERIOD = 340; // wave pattern repeats every 340px

// ── banner layout ────────────────────────────────────────────────────────────
// The scene art is authored in a fixed 280x250 coordinate system, but 215px of
// text + 280px of stage is 495px, which does not fit a 360pt phone. So the stage
// is scaled down as a whole (anchored bottom-right, feet stay on the ground line)
// and the text column takes whatever is left. See rqLayout().
export const RQ_TEXT_MAX_W = 215; // widest the text column ever gets
export const RQ_TEXT_MIN_W = 140; // below this the headline becomes unreadable
export const RQ_STAGE_MIN_SCALE = 0.62; // stage never shrinks past this
export const RQ_PAD_X = 16; // banner side padding
export const RQ_COL_GAP = 10; // gap between the text column and the stage

export type RqLayout = {
  textW: number; // width of the text column (px)
  stageScale: number; // uniform scale applied to the 280x250 stage
  stageW: number; // visual width of the scaled stage (px)
};

/** Pure layout maths for a given screen width. No React, no Reanimated. */
export function rqLayout(width: number): RqLayout {
  const avail = Math.max(0, width - RQ_PAD_X * 2);
  let stageW = Math.min(
    RQ_STAGE_W,
    Math.max(RQ_STAGE_MIN_SCALE * RQ_STAGE_W, avail - RQ_TEXT_MAX_W - RQ_COL_GAP),
  );
  let textW = avail - stageW - RQ_COL_GAP;
  if (textW < RQ_TEXT_MIN_W) {
    // Very narrow phone: keep the text readable, shrink the stage instead.
    textW = RQ_TEXT_MIN_W;
    stageW = Math.max(0, avail - textW - RQ_COL_GAP);
  } else if (textW > RQ_TEXT_MAX_W) {
    // Wide screen (tablet): the column never grows past its authored width, so the
    // title row keeps its back/filter buttons together instead of stretching.
    textW = RQ_TEXT_MAX_W;
    stageW = Math.min(RQ_STAGE_W, avail - textW - RQ_COL_GAP);
  }
  return { textW, stageScale: stageW / RQ_STAGE_W, stageW };
}

export const RQ_CLR = {
  header: '#1b525c',
  waveBack: '#205a64',
  waveMid: '#256673',
  waveFront: '#2b727e',
  amber: '#F2B544',
  ink: '#14414a',
  white: '#FFFFFF',
  chipText: '#8A5A12',
  windowTeal: '#2b727e',
  boardTeal: '#1a4a53',
  lineTeal: '#8fc0c4',
  lampLine: '#7fb5bb',
  coral: '#F09C7D',
  mintSky: '#A9DADB',
  pageBg: '#F6F8F7',
  pillBg: 'rgba(255,255,255,0.16)',
} as const;

// The app's own font tokens (Plus Jakarta Sans headings + Inter body).
export const RQ_FONT = {
  head: fonts.heading.bold, // PlusJakartaSans_700Bold
  headMed: fonts.heading.semibold, // PlusJakartaSans_600SemiBold
  body: fonts.body.regular, // Inter_400Regular
  bodyMed: fonts.body.medium, // Inter_500Medium
} as const;

export type RqSkin = readonly [string, string]; // [light half, shade half]
export const RQ_SKIN: readonly RqSkin[] = [
  ['#ecce94', '#e0bd80'],
  ['#d9a679', '#c8946a'],
  ['#8d5a3b', '#7a4a2f'],
  ['#f1d3b3', '#e5c09a'],
];

export type RqDeco = 'apron' | 'jacket' | 'blazer' | 'none';
export type RqItemKind = 'cup' | 'parcel' | 'folder';

export type RqLook = {
  skin: RqSkin;
  hair: string;
  hairLong: boolean;
  shirt: string;
  longSleeve: boolean;
  deco: RqDeco;
  helmet: boolean;
};

export type RqSceneDef = {
  key: 'cafe' | 'delivery' | 'office';
  label: string;
  chip: string;
  chipW: number;
  item: RqItemKind;
  emp: RqLook; // the one handing over
  cand: RqLook; // the one receiving
};

export const RQ_SCENE_DEFS: RqSceneDef[] = [
  {
    key: 'cafe',
    label: 'Café',
    chip: 'Barista · 96%',
    chipW: 104,
    item: 'cup',
    emp: { skin: RQ_SKIN[1], hair: '#1d1d28', hairLong: false, shirt: '#F3E7D3', longSleeve: false, deco: 'apron', helmet: false },
    cand: { skin: RQ_SKIN[0], hair: '#42291a', hairLong: true, shirt: '#3b9a74', longSleeve: false, deco: 'none', helmet: false },
  },
  {
    key: 'delivery',
    label: 'Delivery',
    chip: 'Courier · 94%',
    chipW: 106,
    item: 'parcel',
    emp: { skin: RQ_SKIN[2], hair: '#2a1a12', hairLong: false, shirt: '#E8743B', longSleeve: true, deco: 'jacket', helmet: true },
    cand: { skin: RQ_SKIN[3], hair: '#8a4b22', hairLong: false, shirt: '#7a5bc4', longSleeve: false, deco: 'none', helmet: false },
  },
  {
    key: 'office',
    label: 'Office',
    chip: 'Reception · 92%',
    chipW: 118,
    item: 'folder',
    emp: { skin: RQ_SKIN[0], hair: '#42291a', hairLong: false, shirt: '#264a8c', longSleeve: true, deco: 'blazer', helmet: false },
    cand: { skin: RQ_SKIN[1], hair: '#1d1d28', hairLong: true, shirt: '#D9694F', longSleeve: false, deco: 'none', helmet: false },
  },
];
