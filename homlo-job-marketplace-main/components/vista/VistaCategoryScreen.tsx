// VistaCategoryScreen.tsx
// Category detail page: ONE template for all 19 categories. Only the category
// name, the employers and the jobs change. Layout and motion live in the
// shared ListingScreen (also used by the Job type pages).
// Visual layer only: jobs, handlers and routes come from app/vista/[categoryKey].tsx.
import React, { useMemo } from 'react';
import { VistaJob, getVistaCategory } from './vistaCategoryData';
import { ListingScreen } from './category/ListingScreen';
import { CITY, plural } from './category/tokens';

type Props = {
  categoryKey?: string; // one of the 19 keys in vistaCategoryData.ts
  jobs?: VistaJob[]; // pass real jobs; falls back to sample jobs
  loading?: boolean;
  onBack?: () => void;
  onOpenSettings?: () => void;
  onOpenJob?: (job: VistaJob) => void;
  onOpenEmployer?: (job: VistaJob) => void;
  onGetAlerts?: () => void;
  isSaved?: (jobId: string) => boolean;
  onToggleSave?: (job: VistaJob) => void;
};

export default function VistaCategoryScreen({
  categoryKey = 'sales', jobs, loading, onBack, onOpenSettings, onOpenJob, onOpenEmployer, isSaved, onToggleSave,
}: Props) {
  const cat = useMemo(() => getVistaCategory(categoryKey), [categoryKey]);
  const name = cat.title;
  return (
    <ListingScreen
      title={name}
      subtitle={(n) => `${plural(n, 'open job', 'open jobs')} across ${CITY}`}
      heading={(n) => `${plural(n, 'open job', 'open jobs')} in ${name.toLowerCase()}`}
      areaSubject={name.toLowerCase()}
      jobs={jobs ?? cat.jobs}
      loading={loading}
      onBack={onBack}
      onMore={onOpenSettings}
      onOpenJob={onOpenJob}
      onOpenEmployer={onOpenEmployer}
      isSaved={isSaved}
      onToggleSave={onToggleSave}
    />
  );
}
