import { fonts } from './typography';

// Tokens for the profile screens (forest/mint, Plus Jakarta Sans + Inter).
export const C = {
  bg: '#F3F6F5', surface: '#FFFFFF', fg: '#12303C', muted: '#6A7C84', border: '#E6EDEF',
  primary: '#0891B2', mint: '#0891B2', mint100: '#DCF1F6', forest: '#14324A',
  danger: '#C0392B', warn: '#B86E00', warnBg: '#FFF1DC', neutralBg: '#EEF3F4',
};

// Project font tokens (see lib/typography.ts).
export const F = {
  h800: fonts.heading.extrabold, h700: fonts.heading.bold,
  b400: fonts.body.regular, b500: fonts.body.medium, b600: fonts.body.semibold,
};

export const shadow = {
  shadowColor: '#14324A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 2,
};