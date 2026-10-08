// Design tokens for the new job container. Reuses mint/forest from the
// existing home job-category theme to avoid introducing new green tokens.
import { jobCategoryTheme } from './jobCategoryTheme';

export const jobCardTokens = {
  color: {
    forest: jobCategoryTheme.color.forest,
    mint: jobCategoryTheme.color.mint,
    mintDark: '#0A7A4B',
    mintTint: '#DFF7E9',
    ink: '#17201A',
    muted: '#66736A',
    border: '#E2E8E5',
    surface: '#FFFFFF',
    bg: '#F7F8F6',
    star: '#F5A524',
    heart: '#E5484D',
    lowBg: '#FFE9D6',
    lowFg: '#B4540A',
    lowBar: '#F08A2B',
    filledBg: '#EEF1EF',
    shadow: '#173C25',
  },
  radius: {
    image: 22,
    thumb: 18,
    rowCard: 22,
    pill: 9,
  },
  size: {
    carouselWidth: 208,
    carouselImageHeight: 176,
    featuredImageHeight: 190,
    rowThumb: 96,
    logo: 34,
    logoGrid: 30,
    logoRow: 26,
    save: 34,
    saveGrid: 30,
  },
  layout: {
    gutter: 20,
    carouselGap: 14,
    gridGap: 12,
    gridRowGap: 16,
    listGap: 10,
  },
  motion: {
    pressScale: 0.975,
    pressMs: 120,
  },
  // Figtree is loaded with @expo-google-fonts/figtree (see IMPLEMENTATION_PROMPT.md).
  // Used only inside job containers.
  font: {
    regular: 'Figtree_400Regular',
    medium: 'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
    bold: 'Figtree_700Bold',
    extrabold: 'Figtree_800ExtraBold',
  },
} as const;
