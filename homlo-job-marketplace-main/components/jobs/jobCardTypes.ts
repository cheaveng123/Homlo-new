export type WorkArrangement = 'onsite' | 'hybrid' | 'remote';

export type JobCardVariant = 'carousel' | 'featured' | 'row' | 'grid';

// View-model for the card. Map the app's real Job type to this with a small
// adapter (toJobCardData) so the card never depends on database shapes.
export interface JobCardData {
  id: string;
  title: string;
  employerName: string;
  employerInitials?: string;
  employerLogoUrl?: string | null;
  employerColor?: string;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  /** Already formatted, e.g. "$320/mo" or "$2.5/hr". */
  payLabel: string;
  workArrangement: WorkArrangement;
  /** Shown only for onsite and hybrid jobs. */
  locationLabel?: string | null;
  positionsLeft?: number | null;
  positionsTotal?: number | null;
}
