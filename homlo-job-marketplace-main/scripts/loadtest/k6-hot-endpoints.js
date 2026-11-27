// Load test for the five hottest public read paths (perf Phase 7).
//
// Run (k6: https://k6.io/docs/get-started/installation/):
//   k6 run -e BASE_URL=https://<staging-host> scripts/loadtest/k6-hot-endpoints.js
//
// Ramps 0 → 100 → 500 → 1,000 virtual users, holding each level for 2 minutes,
// so p95 and error rate can be read per stage (tagged `stage`).
//
// IMPORTANT: run it against STAGING, never production. The API rate-limits
// each IP (server/_core/apiRateLimit.ts: 300 public tRPC requests / 5 min), so
// from one machine most requests will be 429s. Either raise the limits on the
// staging instance for the test window, or run k6 from several IPs (k6 cloud).
// 429s are counted separately (`rate_limited`) and not as errors.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";
import exec from "k6/execution";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const errors = new Rate("errors");
const rateLimited = new Counter("rate_limited");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 500 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 1000 },
        { duration: "2m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    "http_req_duration{stage:100}": ["p(95)<500"],
    "http_req_duration{stage:500}": ["p(95)<800"],
    "http_req_duration{stage:1000}": ["p(95)<1200"],
    errors: ["rate<0.01"],
  },
};

// tRPC v11 + superjson batch GET: input is {"0":{"json":<input>}}.
function trpc(procedure, input) {
  const query = input === undefined ? "batch=1&input=%7B%7D" : `batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: input } }))}`;
  return `${BASE_URL}/api/trpc/${procedure}?${query}`;
}

const SEARCHES = ["cook", "driver", "cleaner", "waiter", "delivery", "sales"];

function stageFor(vus) {
  if (vus <= 100) return "100";
  if (vus <= 500) return "500";
  return "1000";
}

function hit(url, name) {
  const res = http.get(url, { tags: { name, stage: stageFor(exec.instance.vusActive) } });
  if (res.status === 429) {
    rateLimited.add(1);
    return;
  }
  errors.add(res.status >= 400 || res.status === 0);
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
}

export default function () {
  // Home (the busiest screen): composed feed + full public list + categories.
  hit(trpc("homlo.homeFeed", { sectionSize: 8 }), "homeFeed");
  hit(trpc("homlo.publicJobs"), "publicJobs");
  hit(trpc("homlo.categories"), "categories");
  sleep(1);
  // Search / explore.
  const q = SEARCHES[Math.floor(Math.random() * SEARCHES.length)];
  hit(trpc("homlo.searchJobs", { query: q, limit: 20 }), "searchJobs");
  sleep(1);
  // Job detail also loads the employer's public profile.
  hit(trpc("homlo.employerProfile", { name: "Homlo" }), "employerProfile");
  // Readiness probe (touches the database).
  hit(`${BASE_URL}/api/health/ready`, "healthReady");
  sleep(1 + Math.random() * 2);
}
