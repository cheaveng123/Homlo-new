import { mapProviderConfig } from "@/lib/map-config";

export type MapCoordinate = { latitude: number; longitude: number };

export type OpenStreetMapPlace = {
  id: string;
  label: string;
  city: string;
  province: string;
  district: string;
  addressLine: string;
  country: string;
  postalCode: string;
  coordinate: MapCoordinate;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country_code?: string;
  country?: string;
  postcode?: string;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

function cityFromAddress(address?: NominatimAddress) {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.county ?? address?.state ?? "Selected area";
}

function districtFromAddress(address?: NominatimAddress) {
  return address?.city_district ?? address?.suburb ?? address?.neighbourhood ?? "";
}

function addressLineFromAddress(address?: NominatimAddress) {
  const parts = [address?.house_number, address?.road].filter(Boolean);
  return parts.join(" ");
}

function toPlace(result: NominatimResult): OpenStreetMapPlace {
  return {
    id: String(result.place_id),
    label: result.display_name,
    city: cityFromAddress(result.address),
    province: result.address?.state ?? "",
    district: districtFromAddress(result.address),
    addressLine: addressLineFromAddress(result.address),
    country: result.address?.country ?? "",
    postalCode: result.address?.postcode ?? "",
    coordinate: { latitude: Number(result.lat), longitude: Number(result.lon) },
  };
}

async function nominatimFetch(path: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), mapProviderConfig.geocodingTimeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    return await fetch(`${mapProviderConfig.nominatimBaseUrl}${path}`, {
      headers: { Accept: "application/json", "Accept-Language": "en" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function searchOpenStreetMapPlace(query: string, signal?: AbortSignal) {
  const encodedQuery = encodeURIComponent(`${query}, Cambodia`);
  const response = await nominatimFetch(
    `/search?format=jsonv2&addressdetails=1&limit=5&q=${encodedQuery}`,
    signal,
  );
  if (!response.ok) throw new Error("Location search is unavailable.");
  return (await response.json() as NominatimResult[]).map(toPlace);
}

export async function reverseOpenStreetMapPlace(coordinate: MapCoordinate, signal?: AbortSignal) {
  const response = await nominatimFetch(
    `/reverse?format=jsonv2&addressdetails=1&lat=${coordinate.latitude}&lon=${coordinate.longitude}`,
    signal,
  );
  if (!response.ok) throw new Error("Unable to resolve the selected area.");
  return toPlace(await response.json() as NominatimResult);
}
