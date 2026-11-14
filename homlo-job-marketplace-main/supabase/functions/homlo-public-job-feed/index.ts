/* eslint-disable-next-line import/no-unresolved -- jsr: specifiers are resolved by the Deno edge runtime, not the Node resolver */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { authorizeFeedRequest } from "../_shared/feed-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function loadSecretKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("SUPABASE_SECRET_KEYS is not set");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS is not valid JSON");
  }
  const key = (parsed as Record<string, unknown> | null)?.default;
  if (typeof key !== "string" || !key.startsWith("sb_secret_")) {
    throw new Error('SUPABASE_SECRET_KEYS needs a "default" entry starting with sb_secret_');
  }
  return key;
}

const SECRET_KEY = loadSecretKey();
const FEED_SECRET = Deno.env.get("HOMLO_FEED_SECRET")?.trim() ?? "";

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Allow": "GET", "Cache-Control": "no-store" },
    });
  }

  const auth = authorizeFeedRequest(FEED_SECRET, request.headers.get("x-homlo-feed-secret"));
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error("[homlo-public-job-feed] HOMLO_FEED_SECRET is not set");
    }
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/homlo_list_public_published_jobs`, {
    method: "POST",
    headers: {
      apikey: SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: "{}",
  });

  const data = response.json ? await response.json().catch(() => ({ error: "Supabase service request failed" })) : [];
  if (!response.ok) {
    console.error("[homlo-public-job-feed] database call failed", { status: response.status, message: data?.message });
    return new Response(JSON.stringify({ error: "Unable to load published jobs" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const jobs = Array.isArray(data)
    ? data.map((job) => ({
        ...job,
        banner_image:
          typeof job?.banner_image === "string"
            ? job.banner_image
            : typeof job?.bannerImage === "string"
            ? job.bannerImage
            : null,
      }))
    : data;

  return new Response(JSON.stringify({ jobs }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});

