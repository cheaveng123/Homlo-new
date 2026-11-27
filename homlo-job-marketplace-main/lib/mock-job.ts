import type { Job } from "@/components/job-store";
import { defaultSearchCenter } from "@/lib/job-geography";
import { allExploreMockJobs, type ExploreMockJob } from "@/lib/mock/exploreMockJobs";

/**
 * Placeholder job used when an id is not in the database (e.g. the Explore
 * page's demo listings) or the listing has been removed. Keeps the detail
 * screen usable instead of showing "this role is no longer available".
 */
function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Deterministic point around the city centre so mock pins land on the map. */
function mockCoordinate(id: string) {
  const hash = hashString(id || "homlo");
  const offsetLat = (((hash % 1000) / 1000) - 0.5) * 0.09;
  const offsetLng = (((Math.floor(hash / 1000) % 1000) / 1000) - 0.5) * 0.11;
  return {
    latitude: defaultSearchCenter.latitude + offsetLat,
    longitude: defaultSearchCenter.longitude + offsetLng,
  };
}

const MOCK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80";

function fromExploreMock(mock: ExploreMockJob): Job {
  const remote = mock.distance.toLowerCase().includes("remote");
  const coordinate = remote ? null : mockCoordinate(mock.id);
  return {
    id: mock.id,
    title: mock.title,
    company: mock.company,
    location: remote ? "Remote · Cambodia" : `${mock.distance.replace(" km", "")} · Phnom Penh`,
    schedule: remote ? "Flexible remote hours" : "Weekdays",
    pay: `${mock.pay} / month`,
    tag: remote ? "Remote" : "Full-time",
    category: mock.category,
    image: MOCK_IMAGE,
    description: `${mock.title} at ${mock.company}. Join a friendly local team and help deliver great work every day.`,
    arrangement: remote ? "Remote" : "On-site",
    experience: "Entry level",
    posted: "Posted recently",
    status: "New",
    jobStatus: "open",
    positionsAvailable: 2,
    positionsTotal: 3,
    positionsFilled: 1,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    isCurated: true,
  };
}

function genericMock(id: string): Job {
  const coordinate = mockCoordinate(id);
  return {
    id,
    title: "Sample role",
    company: "Homlo employer",
    location: "Phnom Penh",
    schedule: "Weekdays",
    pay: "$300 / month",
    tag: "Full-time",
    category: "General",
    image: MOCK_IMAGE,
    description:
      "This listing is a preview. The role is no longer in the database, so the details below are placeholders.",
    arrangement: "On-site",
    experience: "Entry level",
    posted: "Posted recently",
    status: "New",
    jobStatus: "open",
    positionsAvailable: 1,
    positionsTotal: 1,
    positionsFilled: 0,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    isCurated: true,
  };
}

export function mockJobFor(id: string): Job {
  const explore = allExploreMockJobs.find((mock) => mock.id === id);
  return explore ? fromExploreMock(explore) : genericMock(id);
}
