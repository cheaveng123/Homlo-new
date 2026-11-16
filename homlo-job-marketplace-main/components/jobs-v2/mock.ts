/** Sample data only, to see each screen run. Replace with your existing hooks and data. */
import { colors } from './theme';
import type { PopularJob } from './PopularScreen';
import type { CategoryJob, Employer } from './CategoryScreen';
import type { PartTimeJob } from './PartTimeScreen';
import type { FullTimeJob } from './FullTimeScreen';
import type { WeekendJob } from './WeekendsScreen';
import type { RemoteJob } from './RemoteScreen';

const { teal, deepTeal, clay, dusk } = colors;

export const popular: PopularJob[] = [
  { id: '1', title: 'Barista', company: 'Café Lotus', pay: '$4/h', positionsLeft: 3, initials: 'CL', color: teal },
  { id: '2', title: 'Sales Executive', company: 'Vattanac', pay: '$750/mo', positionsLeft: 5, initials: 'VG', color: deepTeal },
  { id: '3', title: 'Delivery Rider', company: 'Foodie Go', pay: '$5/h', positionsLeft: 2, initials: 'FG', color: clay },
  { id: '4', title: 'Receptionist', company: 'Sokha Hotel', pay: '$480/mo', positionsLeft: 8, initials: 'SH', color: dusk },
  { id: '5', title: 'Tutor', company: 'Bright Kids', pay: '$8/h', positionsLeft: 1, initials: 'BK', color: teal },
];

export const employers: Employer[] = [
  { id: 'a', initials: 'W', color: dusk }, { id: 'b', initials: 'N', color: teal }, { id: 'c', initials: 'K', color: deepTeal },
  { id: 'd', initials: 'Z', color: clay }, { id: 'e', initials: 'A', color: dusk },
];

export const categoryJobs: CategoryJob[] = [
  { id: '1', title: 'Barista', company: 'Café Lotus', pay: '$4/h', type: 'Part-time', distance: '1.2 km', initials: 'CL', color: teal },
  { id: '2', title: 'Front Desk', company: 'Sokha Hotel', pay: '$480/mo', type: 'Full-time', distance: '2.4 km', initials: 'SH', color: deepTeal },
  { id: '3', title: 'Waiter', company: 'Rithy Kitchen', pay: '$3/h', type: 'Part-time', distance: '0.9 km', initials: 'RK', color: clay },
];

export const partTime: PartTimeJob[] = [
  { id: '1', title: 'Barista', company: 'Café Lotus', pay: '$4/h', location: 'Daun Penh · 1.2 km', photoColors: ['#B5E2DF', '#D8F0EE'] },
  { id: '2', title: 'Tutor', company: 'Bright Kids', pay: '$8/h', location: 'Toul Kork · 3.0 km', photoColors: ['#FFE0A0', '#FFF1D2'] },
  { id: '3', title: 'Shop Assistant', company: 'Miniso', pay: '$3/h', location: 'Chamkar Mon · 0.8 km', photoColors: ['#F8CDB6', '#FDE6DA'] },
];

export const fullTime: FullTimeJob[] = [
  { id: '1', title: 'Sales Executive', company: 'Vattanac', arrangement: 'On-site', pay: '$750', rangeLabel: '$600–900 /mo', min: 600, max: 900 },
  { id: '2', title: 'Accountant', company: 'KPMG', arrangement: 'Hybrid', pay: '$900', rangeLabel: '$700–1,200 /mo', min: 700, max: 1200 },
  { id: '3', title: 'Branch Manager', company: 'ACLEDA', arrangement: 'On-site', pay: '$1,400', rangeLabel: '$1,100–1,800 /mo', min: 1100, max: 1800 },
];

export const weekends: WeekendJob[] = [
  { id: '1', day: 'SAT', hours: '8–4', title: 'Market Helper', company: 'Phsar Thmey', pay: '$30/day' },
  { id: '2', day: 'SAT', hours: '6–2', title: 'Event Crew', company: 'Sun Events', pay: '$35/day' },
  { id: '3', day: 'SUN', hours: '9–5', title: 'Cafe Server', company: 'Brown Coffee', pay: '$32/day' },
];

export const remote: RemoteJob[] = [
  { id: '1', title: 'Support Agent', company: 'Wing Bank', pay: '$600/mo' },
  { id: '2', title: 'Content Writer', company: 'Khmer24', pay: '$450/mo' },
  { id: '3', title: 'Data Entry', company: 'Smart', pay: '$350/mo' },
  { id: '4', title: 'Designer', company: 'Studio K', pay: '$650/mo' },
];
