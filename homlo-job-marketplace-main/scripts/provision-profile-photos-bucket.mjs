/**
 * Idempotently provisions the public `profile-photos` Supabase Storage bucket
 * through the Storage API.
 *
 * Why the API and not `insert into storage.buckets`? On the current Supabase
 * Storage backend, a hand-inserted bucket row is visible to GET bucket, but
 * object uploads fail with "Bucket not found" / NoSuchBucket. Creating the
 * bucket via POST /storage/v1/bucket registers it with the object backend.
 *
 * Usage:
 *   node scripts/provision-profile-photos-bucket.mjs
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env. No rows are
 * touched; run before applying migration 034.
 */
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
    }),
);

const supabaseUrl = (env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "profile-photos";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env");
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
});

if (response.ok) {
  console.log(`Bucket "${BUCKET}" ready.`);
} else {
  const body = (await response.text()).slice(0, 300);
  console.error(`Bucket provisioning failed: ${response.status} ${body}`);
  process.exit(1);
}