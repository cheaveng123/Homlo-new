import { fonts } from './typography';

// Tokens for the profile screens (forest/mint, Plus Jakarta Sans + Inter).
export const C = {
  bg: '#F4F8F8', surface: '#FFFFFF', fg: '#14272B', muted: '#58696B', border: '#E4ECEC',
  primary: '#0E7C86', mint: '#12A0AB', mint100: '#D8F0EE', forest: '#073B42',
  danger: '#C0392B', warn: '#B86E00', warnBg: '#FFF1DC', neutralBg: '#EEF1EF',
};

// Project font tokens (see lib/typography.ts).
export const F = {
  h800: fonts.heading.extrabold, h700: fonts.heading.bold,
  b400: fonts.body.regular, b500: fonts.body.medium, b600: fonts.body.semibold,
};

export const shadow = {
  shadowColor: '#073B42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 2,
};