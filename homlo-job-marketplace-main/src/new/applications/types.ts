export type ApplicationStatus = 'waiting' | 'accepted' | 'declined';
export type DateInput = string | number | Date | null | undefined;

export type ApplicationListItem = {
  id: string; // APPLICATION id (never the job id)
  jobTitle: string;
  employerName?: string | null;
  jobImageUri?: string | null;
  status: ApplicationStatus;
  appliedAt?: DateInput;
};

export type ApplicationFile = { id: string; name: string; sizeLabel?: string | null };

export type ApplicationDetail = {
  id: string;
  jobTitle: string;
  employerName?: string | null;
  jobImageUri?: string | null;
  status: ApplicationStatus;
  appliedAt?: DateInput;
  payLabel?: string | null;
  typeLabel?: string | null;
  locationLabel?: string | null;
  message?: string | null;
  files: ApplicationFile[];
};