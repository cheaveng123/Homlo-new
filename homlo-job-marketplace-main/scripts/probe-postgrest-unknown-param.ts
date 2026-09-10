// =========================================================
// Read-only probe: does PostgREST reject an unknown named parameter on an RPC?
// If YES, then homlo-save-job (which always sends p_banner_image to
// homlo_save_job, a function that has no such param) fails EVERY call today —
// which would explain "Save Draft is broken".
//
// Uses the harmless SELECT-only functions homlo_list_employer_jobs with a bogus
// employer uuid; never writes. Sends the same unknown param the gateway sends.
// =========================================================

import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function callRpc(name: string, input: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(input),
  });
  const body = await response.text();
  console.log(`--- ${name} -> HTTP ${response.status}`);
  console.log(body.slice(0, 400));
  console.log("");
  return { status: response.status, body };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL/SERVICE_ROLE_KEY required");
    process.exit(1);
  }
  const bogus = "00000000-0000-0000-0000-000000000000";
  // Control: correct param.
  await callRpc("homlo_list_employer_jobs", { p_employer_id: bogus });
  // Experiment: extra unknown param, exactly like the gateway does for save-job.
  await callRpc("homlo_list_employer_jobs", { p_employer_id: bogus, p_banner_image: null });
}

main();