/** Sample data so every *New screen renders on its own for design review. Delete once wired to real hooks. */
import { JobSummaryNew } from '../types/jobNew';

export const mockJobsNew: JobSummaryNew[] = [
  { id: '1', title: 'E2E Plumbing Job', locationLabel: 'Khan Toul Kork', payLabel: '$100 / day', positionsLeft: 3, positionsTotal: 5, employerInitials: 'EE', typeLabel: 'Full-time' },
  { id: '2', title: 'Cashier (Weekend)', locationLabel: 'BKK1 · 0.8 km', payLabel: '$60 / day', positionsLeft: 1, positionsTotal: 4, employerInitials: 'MC', typeLabel: 'Weekends' },
  { id: '3', title: 'Warehouse Helper', locationLabel: 'Sen Sok · 1.4 km', payLabel: '$80 / day', positionsLeft: 2, positionsTotal: 3, employerInitials: 'WH', typeLabel: 'Part-time' },
];

export const mockJobDetailNew = {
  id: '1', title: 'E2E Plumbing Job', employerName: 'E2E Co.', employerInitials: 'EE', locationLabel: 'Khan Toul Kork, Phnom Penh',
  addressNote: 'Exact address shared after you are accepted', payLabel: '$100 / day', typeLabel: 'Full-time', positionsLeft: 3, positionsTotal: 5,
  description: 'Install and repair water pipes, sinks and fittings for small shops and homes. You will work with a small team and a supervisor on site.',
  requirements: ['1+ year of plumbing experience', 'Own basic tools', 'Reliable and on time'],
};
