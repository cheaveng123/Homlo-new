# Plan: Fix back button and employer jobs filter bar positioning

## Issues
1. Recommended page (`app/jobs/recommended.tsx`): back button needs to be higher
2. Employer "View all jobs" page (`NewEmployerJobs.tsx`): filter hotbar (All/Part-time/...) is low/hanging

## Changes
### app/jobs/recommended.tsx
- Move back button higher: change `top: insets.top + 12` to `insets.top + 16` or `insets.top + 18`

### NewEmployerJobs.tsx
- The tabs bar looks detached/low. Options:
  1. Add marginTop to the tabs Animated.View when not sticky
  2. Adjust sticky calculation - headerH is ins.top+56 but header padding might be different
  3. Add paddingTop/border or adjust layout so chips sit properly under title
- Current: title has paddingBottom:8, tabs come right after. Maybe add marginTop:4-8 to tabs container.
- Also could increase z-index and ensure proper spacing.

Let me look up the actual visual: header height is paddingTop:ins.top+8 + content (Circ is ~44px) + paddingBottom:8 = ~ins.top + 60. headerH = ins.top+56, so K = tabY - headerH means when scrolled, it sticks at headerH. That seems reasonable.
But visually "hanging low" suggests maybe need more top margin/padding on tabs when not scrolled, or adjust the pin position.
