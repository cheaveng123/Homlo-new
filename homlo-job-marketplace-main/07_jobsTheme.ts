// → lib/jobsTheme.ts
// Palette "Lagoon & Sunrise". Main = lagoon teal. Accents = sun (saffron), clay, cream.
// Spacing is an 8pt grid. Screen side margin is always S.lg (16). Touch targets are at least 44.
export const J = {
  primary: '#0E7C86', deep: '#073B42', tint: '#D8F0EE',
  sun: '#F5B52B', clay: '#C4531F', cream: '#FFF1D2', creamInk: '#7A4300', eyebrowInk: '#8A4B00',
  fg: '#14272B', muted: '#58696B', border: '#E4ECEC', bg: '#F4F8F8', surface: '#FFFFFF',
  track: '#D9EAEA', headerFrom: '#052E34',
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R = { chip: 14, logo: 16, card: 20, hero: 24, pill: 999 };
// Type scale (px). Headings use Plus Jakarta Sans, body uses Inter (see F in profileTheme).
export const TS = { caption: 12, meta: 13, body: 14, title: 16, section: 17, header: 20, hero: 24 };

// Soft gradient pairs for logo tiles and selector circles (cycle by index).
export const TINTS: [string, string][] = [
  ['#D8F0EE', '#B5E2DF'], ['#FFF1D2', '#FFE0A0'], ['#FDE6DA', '#F8CDB6'], ['#EDE6F7', '#D9CBEE'],
];
export const SOLIDS = ['#0E7C86', '#073B42', '#C4531F', '#6B4FA0'];

export const shadowSm = {
  shadowColor: '#073B42', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1,
};
export const shadowMd = {
  shadowColor: '#073B42', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 8,
};
