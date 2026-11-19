// vistaCategoryData.ts
// Palette, copy, hero-edge settings and sample jobs for all 19 category pages.

export type VistaEdgeType = 'wave' | 'scal' | 'zig' | 'step' | 'sky' | 'arch' | 'cren' | 'torn' | 'hill';
export type VistaJobKind = 'monthly' | 'partTime' | 'remote';

export type VistaJob = {
  id: string;
  title: string;
  company: string;
  pay: number;
  kind: VistaJobKind;
  km: number; // 0 for remote
  // Optional display fields (Category detail redesign). All may be missing.
  area?: string; // raw location text; the page maps it onto a Phnom Penh area
  postedAt?: string; // ISO timestamp, for "2h ago" and the "New" chip
  schedule?: string; // e.g. "Mon–Sat · 8h"; falls back to a label by job type
  logoUrl?: string | null; // employer photo or logo URL
  payUnit?: '/hr' | '/day' | '/mo'; // pay suffix; falls back to the job kind
};

export type VistaCategory = {
  key: string;
  title: string;
  blurb: string;
  bg: string; // hero background
  ink: string; // title + illustration outline
  accent: string; // illustration accent
  light: string; // illustration light tone
  pay: string; // price / active chip colour (readable on white)
  edge: { type: VistaEdgeType; n: number; seed: number };
  jobs: VistaJob[];
};

const J = (key: string, s: string): VistaJob[] =>
  s.split(';').map((r, i) => {
    const [title, company, pay, k, km] = r.split('|');
    return {
      id: `${key}-${i}`,
      title,
      company,
      pay: +pay,
      kind: k === 'M' ? 'monthly' : k === 'P' ? 'partTime' : 'remote',
      km: +km,
    };
  });

const C = (
  key: string, title: string, blurb: string,
  bg: string, ink: string, accent: string, light: string, pay: string,
  type: VistaEdgeType, n: number, seed: number, jobs: string,
): VistaCategory => ({ key, title, blurb, bg, ink, accent, light, pay, edge: { type, n, seed }, jobs: J(key, jobs) });

// Order matters: index i here = scene i in vistaScenes.tsx
export const VISTA_CATEGORIES: VistaCategory[] = [
  C('sales', 'Sales & Business', 'Close deals, grow accounts, earn commission', '#d4dcf3', '#131f4a', '#2b45b8', '#94a6ec', '#2b45b8', 'step', 6, 0,
    'Sales Executive|Mekong Motors|450|M|1.2;Business Developer|Lotus Capital|600|M|2.6;Telesales Agent|CallPro KH|300|R|0'),
  C('marketing', 'Marketing & Media', 'Brands and campaigns that get noticed', '#ffd8cc', '#4a1408', '#e5472a', '#ff9d85', '#c9361a', 'zig', 9, 0,
    'Social Media Manager|Brightside|520|M|1.8;Content Creator|Khmer Eats Media|20|P|1.1;Video Editor|Reel House|400|R|0'),
  // Finance: calm single swell instead of the old jagged skyline
  C('finance', 'Finance & Accounting', 'Books, payroll and audits for growing firms', '#c9f0e0', '#06382a', '#0f8a5f', '#7fd9b5', '#0b7a52', 'wave', 1, 0,
    'Accountant|Sok & Partners|550|M|0.9;Bookkeeper|Angkor Fintech|380|M|3.2;Payroll Clerk|Prime Auditors|25|P|1.4'),
  C('it', 'IT & Technology', 'Build, fix and secure the tech behind it all', '#0f1e2e', '#e6fff7', '#2ee6a6', '#1e6f5c', '#0a8f66', 'torn', 60, 5,
    'Web Developer|Pixel Phnom|800|M|2.0;IT Support|NetBridge|420|M|1.1;QA Tester|Appstack|500|R|0'),
  C('customer', 'Customer Service', 'Help people by phone, chat and in person', '#f3e1d3', '#3f2414', '#a8572b', '#e3b08c', '#a8572b', 'scal', 5, 0,
    'Call Center Agent|HelloKH|350|M|1.5;Chat Support|ShopLine|330|R|0;Client Care Lead|Meng Cheaveng|480|M|1.0'),
  C('hospitality', 'Hospitality & Food', 'Cafés, kitchens and hotels hiring now', '#ffd3cf', '#4a0f0c', '#d93a2b', '#f79a90', '#c42d1f', 'scal', 12, 0,
    'Barista|Brew Lab|280|M|0.6;Line Cook|Mekong Kitchen|320|M|1.9;Waiter / Waitress|Riverside Bistro|15|P|2.3'),
  C('retail', 'Retail & E-commerce', 'Shop floors and online stores', '#ead9fb', '#2e1556', '#8b45d6', '#cfaef2', '#7a35c4', 'arch', 6, 0,
    'Shop Assistant|Urban Mart|260|M|0.8;Online Store Admin|Kampot Goods|350|R|0;Store Manager|Aeon Fresh|650|M|3.4'),
  C('logistics', 'Logistics & Delivery', 'Riders, drivers and warehouse teams on the move', '#ffe9a3', '#3a3000', '#a97800', '#f4d66a', '#946a00', 'zig', 22, 0,
    'Delivery Rider|Nham Express|300|M|1.3;Warehouse Staff|Cargo Link|290|M|4.0;Dispatch Coordinator|Swift KH|400|M|2.2'),
  // Admin: shorter title so it sets at full size on two lines
  C('admin', 'Admin & Office', 'Front desk and office roles that keep things running', '#efe6d6', '#3a2f1c', '#8a6a2f', '#d8c28f', '#7a5c24', 'cren', 3, 0,
    'Receptionist / Admin Assistant|Meng Cheaveng|380|M|1.0;Office Clerk|Bayon Legal|310|M|2.7;Virtual Assistant|Lotus Studio|450|R|0'),
  C('hr', 'Human Resources', 'Hire, onboard and look after teams', '#ffd9e0', '#4a1224', '#cf2e57', '#f59ab0', '#bd2149', 'wave', 4, 2,
    'HR Officer|Talent Bridge|500|M|1.6;Recruiter|Hire Khmer|420|M|2.1;Payroll & Benefits Aide|Sovann Group|20|P|3.0'),
  C('education', 'Education & Training', 'Teach, tutor and train the next generation', '#e2f1c7', '#26400a', '#5f8f0e', '#bfdc7a', '#4d7a08', 'arch', 9, 0,
    'English Teacher|Bright Minds|600|M|1.7;Teaching Assistant|Little Scholars|250|M|0.9;Online Tutor|LearnEx|350|R|0'),
  C('engineering', 'Engineering & Construction', 'Sites, drawings and trades that build the city', '#ffd7b5', '#3d1d00', '#d4620a', '#f5a468', '#b85208', 'sky', 24, 7,
    'Site Engineer|Build Co|700|M|3.8;Civil Draftsman|Metro Design Works|480|M|2.5;Electrician|Volt KH|22|P|1.2'),
  C('design', 'Design & Creative', 'Make brands and screens look good', '#2a2140', '#ffffff', '#ff7ac6', '#7c5cff', '#c4278f', 'wave', 2, 4,
    'Graphic Designer|Pixel Phnom|420|M|1.0;UI Designer|Studio Ngor|650|R|0;Photographer|Frame & Co|30|P|2.9'),
  C('healthcare', 'Healthcare', 'Clinics, pharmacies and care roles', '#cdf1ee', '#06403c', '#0e9488', '#7fd6cd', '#0b7d72', 'wave', 6, 0,
    'Nurse Assistant|Sunrise Clinic|400|M|1.4;Pharmacy Assistant|HealthPlus|350|M|0.7;Medical Receptionist|Royal Clinic|320|M|2.0'),
  C('manufacturing', 'Manufacturing', 'Factory floors, quality checks and production', '#d9dde3', '#1f252d', '#3a6ea5', '#aeb9c6', '#2f5d90', 'step', 12, 0,
    'Machine Operator|Garment Hub|300|M|8.0;Quality Inspector|Prime Factory|380|M|6.5;Production Lead|Mekong Plastics|520|M|7.2'),
  // Beauty: makeup-focused copy and jobs
  C('beauty', 'Beauty & Personal Care', 'Makeup, hair and skincare roles', '#fcd6ee', '#4a0f3a', '#c4278f', '#f2a0d6', '#b01d7d', 'scal', 3, 0,
    'Makeup Artist|Glow Studio|25|P|1.6;Beauty Advisor|Lumi Cosmetics|350|M|0.8;Skincare Consultant|Dew Clinic|380|M|2.2'),
  C('cleaning', 'Cleaning & Housekeeping', 'Hotels, offices and homes kept spotless', '#c7ecff', '#0a3350', '#1a8fe3', '#8ccdf5', '#0f76c0', 'hill', 3, 5,
    'Housekeeper|Hotel Sala|260|M|1.1;Office Cleaner|SparkPro|240|M|0.5;Laundry Attendant|FreshFold|18|P|1.9'),
  C('security', 'Security', 'Guarding people, places and cameras', '#e5e5ea', '#16161a', '#3d3d4a', '#b8b8c4', '#3d3d4a', 'cren', 5, 0,
    'Security Guard|Shield Guard|280|M|0.9;CCTV Operator|SafeEye|320|M|2.4;Night Patrol|Guardian KH|300|M|3.3'),
  C('agriculture', 'Agriculture', 'Farms, harvests and fresh produce supply', '#f1e6c4', '#3a3112', '#7d8c1a', '#c8d46a', '#667412', 'hill', 2, 2,
    'Farm Supervisor|Green Valley|350|M|12;Agronomy Assistant|Khmer Agri|400|M|9.5;Packing Staff|Fresh Harvest|15|P|6.8'),
];

export const getVistaCategory = (key: string) =>
  VISTA_CATEGORIES.find((c) => c.key === key) ?? VISTA_CATEGORIES[0];

// Home "Job field" tile id (lib/job-fields.ts) -> vista key. Same 19 entries, in
// the same order, as JOB_FIELDS and VISTA_CATEGORIES.
export const FIELD_TO_VISTA: Readonly<Record<string, string>> = {
  'sales-business': 'sales',
  'marketing-media': 'marketing',
  'finance-accounting': 'finance',
  'it-technology': 'it',
  'customer-service': 'customer',
  'hospitality-food': 'hospitality',
  'retail-ecommerce': 'retail',
  'logistics-delivery': 'logistics',
  administration: 'admin',
  'human-resources': 'hr',
  'education-training': 'education',
  'engineering-construction': 'engineering',
  'design-creative': 'design',
  healthcare: 'healthcare',
  manufacturing: 'manufacturing',
  'beauty-personal-care': 'beauty',
  'cleaning-housekeeping': 'cleaning',
  security: 'security',
  agriculture: 'agriculture',
};

export const vistaKeyForField = (fieldId: string): string | undefined => FIELD_TO_VISTA[fieldId];

export const fieldForVistaKey = (key: string): string | undefined => {
  for (const [id, vistaKey] of Object.entries(FIELD_TO_VISTA)) {
    if (vistaKey === key) return id;
  }
  return undefined;
};

export const getVistaSceneIndex = (key: string) =>
  Math.max(0, VISTA_CATEGORIES.findIndex((c) => c.key === key));

/** Blend two #rrggbb colours. t = 0 → a, t = 1 → b */
export const vistaMix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
