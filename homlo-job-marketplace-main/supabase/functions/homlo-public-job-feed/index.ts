/* eslint-disable-next-line import/no-unresolved -- jsr: specifiers are resolved by the Deno edge runtime, not the Node resolver */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Allow": "GET", "Cache-Control": "no-store" },
    });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/homlo_list_public_published_jobs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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

