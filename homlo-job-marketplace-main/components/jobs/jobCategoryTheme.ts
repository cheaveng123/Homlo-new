// components/jobs/jobCategoryTheme.ts
// Confirmed values from Meng — do not substitute other tokens from the
// codebase's other theme files (there is known drift between them).
export const jobCategoryTheme = {
  color: {
    mint: '#0891B2',       // live home screen mint — confirmed choice for this page
    mintTint: '#DCF1F6',
    forest: '#0E3B2E',
    bg: '#FFFFFF',
    bgGutter: '#F6F8F7',
    line: '#E7EDEA',
    muted: '#6B8478',
    white: '#FFFFFF',
    // Heart state colours, matching the home job cards, which use these exact
    // literals: a red filled heart when saved, a near-black outline when not.
    // Kept as literals here rather than imported from components/home/theme
    // because this file deliberately avoids cross-theme tokens.
    heartSaved: '#EF4444',
    heartIdle: '#1A1A1A',
  },
  spacing: {
    screenX: 20, // horizontal gutter — matches spacing.screenX on the live home screen
  },
  font: {
    heading: 'PlusJakartaSans_700Bold',
    headingExtraBold: 'PlusJakartaSans_800ExtraBold',
    headingSemiBold: 'PlusJakartaSans_600SemiBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 18,
    pill: 999,
  },
};
