// Creates the test KYC workflow via POST /v3/workflows/ (SimpleWorkflowRequest in the OpenAPI spec).
// Creating a workflow is free; sessions run on it are what cost credits on a live application.
// Usage: node scripts/create-workflow.js [--with-ip]
try { process.loadEnvFile(); } catch { /* ignore */ }

const { DIDIT_API_KEY } = process.env;
if (!DIDIT_API_KEY) {
  console.error('Set DIDIT_API_KEY in .env first.');
  process.exit(1);
}

const features = [
  { feature: 'OCR' },
  { feature: 'LIVENESS', config: { face_liveness_method: 'PASSIVE' } },
  { feature: 'FACE_MATCH' },
];
// Device & IP Analysis is NOT free ($0.03/check on didit.me/pricing), so it is opt-in.
if (process.argv.includes('--with-ip')) features.push({ feature: 'IP_ANALYSIS' });

const r = await fetch('https://verification.didit.me/v3/workflows/', {
  method: 'POST',
  headers: { 'x-api-key': DIDIT_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({
    workflow_label: 'Didit test KYC',
    features,
    // Defaults to false; true lets you run the flow in a desktop browser with a webcam.
    is_desktop_allowed: true,
  }),
});
const data = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(`Failed: HTTP ${r.status}`, data);
  process.exit(1);
}
console.log(`Created workflow "${data.workflow_label}" (status ${data.status}, total_price ${data.total_price ?? 'n/a'})`);
console.log(`DIDIT_WORKFLOW_ID=${data.workflow_id}`);
