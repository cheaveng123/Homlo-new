/**
 * HOMLO icon kit.
 *
 * Tier A (feature, 40x40, multi-tone, narrative 5s loop via useLoop): hero spots,
 *   empty/success/error states, onboarding, key shortcuts. Max ~6 looping on screen;
 *   never inside long scrolling lists; pass `active={useIsFocused()}`.
 * Tier B (list/shortcut, 24x24, two-tone or outline + one filled accent): mostly static;
 *   animate only on press or selection.
 * Tier C (utility, 24x24 outline, 1.7-1.9 stroke, round caps): #69777A idle, cyan active.
 */
import { EmptyInboxIcon, ErrorStateIcon, NoResultsIcon, SuccessIcon } from './FeatureIcons';
import { ApplicationsIcon, ClosedJobsIcon, LiveJobsIcon, NewApplicantsIcon } from './ManageIcons';

export { useLoop, kf, around, FADE, POP, LOOP_REST } from './loop';

// Tier A
export { ApplicationsIcon, ClosedJobsIcon, LiveJobsIcon, NewApplicantsIcon, type ManageIconProps } from './ManageIcons';
export { BoostIcon } from './BoostIcon';
export { NoResultsIcon, EmptyInboxIcon, SuccessIcon, ErrorStateIcon, type FeatureIconProps } from './FeatureIcons';

// Tier B / C
export {
  SearchGlyph,
  BellGlyph,
  HomeGlyph,
  PlusGlyph,
  UserGlyph,
  LiveTabGlyph,
  DraftTabGlyph,
  ReviewTabGlyph,
  PhotoGlyph,
} from './DashIcons';


/** Registry of tier A icons by concept, for EmptyState and shortcut grids. */
export const featureIcons = {
  noResults: NoResultsIcon,
  inbox: EmptyInboxIcon,
  success: SuccessIcon,
  error: ErrorStateIcon,
  applications: ApplicationsIcon,
  closedJobs: ClosedJobsIcon,
  liveJobs: LiveJobsIcon,
  newApplicants: NewApplicantsIcon,
} as const;
export type FeatureIconName = keyof typeof featureIcons;
