import type { Job } from "@/components/job-store";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

export const defaultSearchCenter: MapCoordinate = { latitude: 11.5564, longitude: 104.9282 };

/**
 * Curated jobs get hand-picked Phnom Penh coordinates so map markers feel
 * meaningful. Anything we don't know about falls back to a deterministic
 * hash-based offset around the city center so jobs still spread out.
 */
type Seed = { lat: number; lng: number; name?: string };

const seeds: Record<string, Seed> = {
  "restaurant-server": { lat: 11.5535, lng: 104.9255, name: "BKK1" },
  "event-staff": { lat: 11.5492, lng: 104.9195, name: "Tuol Tom Poung" },
  "retail-assistant": { lat: 11.5748, lng: 104.9236, name: "Daun Penh" },
  "barista": { lat: 11.5498, lng: 104.9276, name: "Chamkarmon" },
  "weekend-cashier": { lat: 11.6042, lng: 104.9058, name: "Russey Keo" },
  "junior-software-developer": { lat: 11.5510, lng: 104.9260, name: "Chamkarmon" },
  "growth-marketing-intern": { lat: 11.5751, lng: 104.9221, name: "Daun Penh" },
  "remote-customer-success": { lat: 11.5600, lng: 104.9215, name: "Phnom Penh" },
  "sales-executive": { lat: 11.6205, lng: 104.8951, name: "Sen Sok" },
  "product-designer": { lat: 11.5620, lng: 104.9180, name: "Phnom Penh" },
  "frontend-engineer": { lat: 11.5490, lng: 104.9244, name: "Chamkarmon" },
  "data-analyst": { lat: 11.5580, lng: 104.9160, name: "Phnom Penh" },
  "qa-tester": { lat: 11.5641, lng: 104.8983, name: "Tuol Kork" },
  "account-executive": { lat: 11.5530, lng: 104.9305, name: "BKK1" },
  "retail-sales-advisor": { lat: 11.5761, lng: 104.9225, name: "Daun Penh" },
  "business-development-intern": { lat: 11.5570, lng: 104.9225, name: "Phnom Penh" },
  "content-creator": { lat: 11.5518, lng: 104.9264, name: "Chamkarmon" },
  "brand-coordinator": { lat: 11.5526, lng: 104.9290, name: "Chamkarmon" },
  "social-media-specialist": { lat: 11.5640, lng: 104.9170, name: "Phnom Penh" },
  "hotel-front-desk": { lat: 11.5762, lng: 104.9323, name: "Riverside" },
  "kitchen-assistant": { lat: 11.5478, lng: 104.9190, name: "Tuol Tom Poung" },
  "guest-relations-officer": { lat: 11.5635, lng: 104.9270, name: "Phnom Penh" },
  "customer-support-rep": { lat: 11.5610, lng: 104.9185, name: "Phnom Penh" },
  "operations-coordinator": { lat: 11.6202, lng: 104.8960, name: "Sen Sok" },
  "office-administrator": { lat: 11.5758, lng: 104.9232, name: "Daun Penh" },
  "junior-accountant": { lat: 11.5605, lng: 104.9215, name: "Phnom Penh" },
  "teaching-assistant": { lat: 11.5660, lng: 104.8990, name: "Tuol Kork" },
  "logistics-assistant": { lat: 11.6035, lng: 104.9070, name: "Russey Keo" },
  "site-engineer": { lat: 11.5870, lng: 104.9370, name: "Chroy Changvar" },
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function jobCoordinate(job: Pick<Job, "id" | "location">): MapCoordinate {
  const seed = seeds[job.id];
  if (seed) return { latitude: seed.lat, longitude: seed.lng };
  const hash = hashString(job.id || job.location || "homlo");
  const offsetLat = (((hash % 1000) / 1000) - 0.5) * 0.12;
  const offsetLng = (((hash / 1000 % 1000) / 1000) - 0.5) * 0.14;
  return { latitude: defaultSearchCenter.latitude + offsetLat, longitude: defaultSearchCenter.longitude + offsetLng };
}
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

const earthRadiusKm = 6371;

export function haversineDistance(a: MapCoordinate, b: MapCoordinate) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(value)));
}

export function distanceFromCenter(job: Job, center: MapCoordinate) {
  const coord = jobCoordinate(job);
  return { coordinate: coord, distanceKm: haversineDistance(coord, center) };
}