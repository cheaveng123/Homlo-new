import { c } from "@/components/explore/tokens";

/**
 * Placeholder listings used by the Explore page. They are not in the
 * database, so the job detail screen falls back to these (see
 * `lib/mock-job.ts`) instead of showing "role unavailable".
 */
export type ExploreMockJob = {
  id: string; title: string; company: string; pay: string; distance: string;
  initials: string; logoColor: string; category: string;
};

export const hospitalityMockJobs: ExploreMockJob[] = [
  { id: 'h1', title: 'Front Desk Officer', company: 'Sokha Hotel', pay: '$300', distance: '2.4 km', initials: 'SH', logoColor: c.deep, category: 'Hospitality' },
  { id: 'h2', title: 'Housekeeping Lead', company: 'Cambodiana', pay: '$260', distance: '3.1 km', initials: 'CP', logoColor: c.teal, category: 'Hospitality' },
  { id: 'h3', title: 'Bellboy', company: 'Rosewood', pay: '$240', distance: '4.0 km', initials: 'RV', logoColor: c.deep, category: 'Hospitality' },
  { id: 'h4', title: 'Concierge', company: 'Raffles', pay: '$340', distance: '3.6 km', initials: 'RF', logoColor: c.teal, category: 'Hospitality' },
];

export const foodMockJobs: ExploreMockJob[] = [
  { id: 'f1', title: 'Barista', company: 'Brown Coffee', pay: '$320', distance: '1.2 km', initials: 'BC', logoColor: c.clay, category: 'Food & Drink' },
  { id: 'f2', title: 'Line Cook', company: 'Plantation', pay: '$280', distance: '1.9 km', initials: 'PL', logoColor: c.teal, category: 'Food & Drink' },
  { id: 'f3', title: 'Waiter / Waitress', company: 'Teav Sneha', pay: '$230', distance: '2.2 km', initials: 'TS', logoColor: c.purple, category: 'Food & Drink' },
  { id: 'f4', title: 'Pastry Chef', company: 'Feel Good', pay: '$380', distance: '2.6 km', initials: 'FG', logoColor: c.deep, category: 'Food & Drink' },
  { id: 'f5', title: 'Kitchen Helper', company: 'Lucky Burger', pay: '$200', distance: '1.4 km', initials: 'LB', logoColor: c.clay, category: 'Food & Drink' },
  { id: 'f6', title: 'Bartender', company: 'Elephant Bar', pay: '$310', distance: '3.0 km', initials: 'EB', logoColor: c.teal, category: 'Food & Drink' },
];

export const retailMockJobs: ExploreMockJob[] = [
  { id: 'r1', title: 'Sales Associate', company: 'Lucky Mall', pay: '$220', distance: '0.8 km', initials: 'LM', logoColor: c.clay, category: 'Retail & Sales' },
  { id: 'r2', title: 'Cashier', company: 'Aeon Mall', pay: '$240', distance: '5.6 km', initials: 'AE', logoColor: c.deep, category: 'Retail & Sales' },
  { id: 'r3', title: 'Store Supervisor', company: 'Circle K', pay: '$350', distance: '2.8 km', initials: 'CK', logoColor: c.clay, category: 'Retail & Sales' },
  { id: 'r4', title: 'Stock Keeper', company: 'Makro', pay: '$230', distance: '6.1 km', initials: 'MK', logoColor: c.teal, category: 'Retail & Sales' },
];

export const deliveryMockJobs: ExploreMockJob[] = [
  { id: 'd1', title: 'Motorbike Courier', company: 'PassApp', pay: '$400', distance: '1.0 km', initials: 'PP', logoColor: c.deep, category: 'Delivery & Drivers' },
  { id: 'd2', title: 'Delivery Rider', company: 'Nham24', pay: '$350', distance: '2.5 km', initials: 'NG', logoColor: c.clay, category: 'Delivery & Drivers' },
  { id: 'd3', title: 'Van Driver', company: 'Giant Ibis', pay: '$450', distance: '3.4 km', initials: 'GI', logoColor: c.teal, category: 'Delivery & Drivers' },
  { id: 'd4', title: 'Parcel Sorter', company: 'J&T', pay: '$260', distance: '4.2 km', initials: 'JT', logoColor: c.purple, category: 'Delivery & Drivers' },
  { id: 'd5', title: 'Dispatcher', company: 'Grab', pay: '$420', distance: '2.0 km', initials: 'GR', logoColor: c.teal, category: 'Delivery & Drivers' },
  { id: 'd6', title: 'Courier', company: 'Wowkh', pay: '$330', distance: '1.7 km', initials: 'WK', logoColor: c.clay, category: 'Delivery & Drivers' },
];

export const officeMockJobs: ExploreMockJob[] = [
  { id: 'o1', title: 'Graphic Designer', company: 'Ad Studio', pay: '$600', distance: 'Remote', initials: 'AD', logoColor: c.purple, category: 'Office & Admin' },
  { id: 'o2', title: 'Accounting Clerk', company: 'ABA Bank', pay: '$450', distance: '3.3 km', initials: 'AB', logoColor: c.teal, category: 'Office & Admin' },
  { id: 'o3', title: 'Receptionist', company: 'Canadia', pay: '$380', distance: '2.1 km', initials: 'CN', logoColor: c.deep, category: 'Office & Admin' },
  { id: 'o4', title: 'HR Assistant', company: 'Smart', pay: '$420', distance: '4.4 km', initials: 'SM', logoColor: c.clay, category: 'Office & Admin' },
];

export const employerMockJobs = [
  { id: 'emp-sokha-hotel', name: 'Sokha Hotel', initials: 'SH', color: c.teal },
  { id: 'emp-aeon-mall', name: 'Aeon Mall', initials: 'AE', color: c.deep },
  { id: 'emp-lucky-mall', name: 'Lucky Mall', initials: 'LM', color: c.clay },
  { id: 'emp-ad-studio', name: 'Ad Studio', initials: 'AD', color: c.purple },
  { id: 'emp-brown-coffee', name: 'Brown Coffee', initials: 'BC', color: c.teal },
];

export const allExploreMockJobs: ExploreMockJob[] = [
  ...hospitalityMockJobs,
  ...foodMockJobs,
  ...retailMockJobs,
  ...deliveryMockJobs,
  ...officeMockJobs,
];
