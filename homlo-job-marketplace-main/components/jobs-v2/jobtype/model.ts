// Display model for the Job type page: jobs grouped by employer.
// Pure functions over the fields both job sources already provide (search
// results and home-feed jobs). Nothing here fetches or changes data.

export type ListedJob = {
  id: string;
  title: string;
  company: string;
  pay: string; // e.g. "$3 / hour", "$300", "$25 / day"
  location?: string;
  image?: string;
  schedule?: string;
  category?: string;
  boosted?: boolean;
  positionsAvailable?: number;
  positionsTotal?: number;
};

export type Role = { id: string; title: string; price: string; image?: string };

export type EmployerGroup = {
  key: string;
  company: string;
  category?: string;
  promoted: boolean;
  payLine: string;
  location?: string;
  locationUnknown: boolean;
  positions?: string; // "1/3 open"
  shift?: string;
  roles: Role[];
  firstJobId: string;
};

const UNIT: Record<string, string> = { hour: 'hr', day: 'day' };

/** "$3 / hour" → { amount: 3, label: "$3/hr" }; plain amounts read as monthly. */
export function parsePay(pay: string): { amount: number; label: string } {
  const amount = Number(String(pay).replace(/\/.*$/, '').replace(/[^0-9.]/g, '')) || 0;
  const head = String(pay).split('/')[0].trim();
  const unitWord = String(pay).split('/')[1]?.trim().toLowerCase();
  const unit = unitWord ? UNIT[unitWord] ?? unitWord : 'mo';
  return { amount, label: `${head}/${unit}` };
}

// Search results fill these when the record has no real value: never show them.
const FILLER_SCHEDULE = /schedule set by employer/i;
const UNKNOWN_LOCATION = /location to be confirmed|location tbc/i;

export function groupByEmployer(jobs: ListedJob[]): EmployerGroup[] {
  const order: string[] = [];
  const map = new Map<string, ListedJob[]>();
  for (const job of jobs) {
    const key = job.company.trim().toLowerCase() || job.id;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(job);
  }
  return order.map((key) => {
    const list = map.get(key)!;
    const first = list[0];
    const pays = list.map((j) => parsePay(j.pay));
    // "From" compares like with like: only roles paid in the first role's unit.
    const unitOf = (label: string) => label.slice(label.lastIndexOf('/'));
    const sameUnit = pays.filter((p) => unitOf(p.label) === unitOf(pays[0].label));
    const cheapest = sameUnit.reduce((a, b) => (b.amount > 0 && (a.amount === 0 || b.amount < a.amount) ? b : a), sameUnit[0]);
    const withPositions = list.filter((j) => typeof j.positionsTotal === 'number' && j.positionsTotal > 0);
    const open = withPositions.reduce((n, j) => n + (j.positionsAvailable ?? 0), 0);
    const total = withPositions.reduce((n, j) => n + (j.positionsTotal ?? 0), 0);
    const location = list.map((j) => j.location?.trim()).find((l) => l && !UNKNOWN_LOCATION.test(l));
    const shift = list.map((j) => j.schedule?.trim()).find((x) => x && !FILLER_SCHEDULE.test(x));
    return {
      key,
      company: first.company,
      category: first.category && first.category !== 'Other' ? first.category : undefined,
      promoted: list.some((j) => j.boosted),
      payLine: list.length > 1 ? `From ${cheapest.label}` : cheapest.label,
      location: location ?? 'Location to be confirmed',
      locationUnknown: !location,
      positions: total > 0 ? `${open}/${total} open` : undefined,
      shift,
      roles: list.map((j, i) => ({ id: j.id, title: j.title, price: pays[i].label, image: j.image || undefined })),
      firstJobId: first.id,
    };
  });
}
