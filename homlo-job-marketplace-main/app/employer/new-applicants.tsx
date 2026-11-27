import { NewApplicantsScreen } from '@/components/employer-job/NewApplicantsScreen';

/**
 * "New applicants" tile. Thin route: all of the data, statistics and chart live
 * in the shared component so the screen can be reused or restyled without
 * touching the navigator.
 */
export default function EmployerNewApplicantsRoute() {
  return <NewApplicantsScreen />;
}