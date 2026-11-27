// Minimal Didit test app: start a hosted verification session, receive signed webhooks,
// show the result. In-memory storage only (restart = data gone), which is fine for a test.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { verifyWebhook } from './lib/signature.js';
import { summarize, TERMINAL_STATUSES } from './lib/summary.js';

try { process.loadEnvFile(); } catch { /* no .env file: rely on real env vars */ }

const {
  DIDIT_API_KEY, DIDIT_WEBHOOK_SECRET, DIDIT_WORKFLOW_ID,
  PUBLIC_BASE_URL = 'http://localhost:3000', DIDIT_ENV = 'sandbox', PORT = 3000,
} = process.env;
const API_BASE = 'https://verification.didit.me';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const [k, v] of Object.entries({ DIDIT_API_KEY, DIDIT_WEBHOOK_SECRET, DIDIT_WORKFLOW_ID })) {
  if (!v) console.warn(`[config] ${k} is not set`);
}

// sessionId -> { sessionId, vendorData, status, summary, lastEventAt, lastFetchAt }
const sessions = new Map();
const seenEventIds = new Set();

// --- tiny "test user" identity: a random id in an httpOnly cookie --------------------------
// Didit's recipe: never take the user id from the request body. Here the server assigns it.
function testUserId(req, res) {
  const match = /(?:^|;\s*)test_uid=([\w-]+)/.exec(req.headers.cookie ?? '');
  if (match) return match[1];
  const uid = `test-user-${crypto.randomUUID()}`;
  res.setHeader('Set-Cookie', `test_uid=${uid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  return uid;
}

async function didit(method, pathname, body) {
  const r = await fetch(API_BASE + pathname, {
    method,
    headers: { 'x-api-key': DIDIT_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!r.ok) {
    const err = new Error(`Didit ${method} ${pathname} -> ${r.status}`);
    err.status = r.status; err.data = data;
    throw err;
  }
  return data;
}

function applyDecision(sessionId, decision, vendorData) {
  const rec = sessions.get(sessionId) ?? { sessionId, vendorData };
  rec.status = decision.status ?? rec.status;
  rec.summary = summarize(decision);
  rec.vendorData ??= decision.vendor_data ?? vendorData;
  sessions.set(sessionId, rec);
  return rec;
}

const app = express();

// Webhook route first, with a RAW body parser so X-Signature (raw bytes) can be checked too.
app.post('/api/webhooks/didit', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  const result = verifyWebhook({ rawBody: req.body, headers: req.headers, secret: DIDIT_WEBHOOK_SECRET });
  if (!result.ok) {
    console.warn(`[webhook] rejected: ${result.reason}`);
    return res.status(401).json({ error: result.reason });
  }
  const p = result.payload;
  // Log only envelope fields: never the decision (it contains PII and media URLs).
  console.log(`[webhook] ${p.webhook_type} event=${p.event_id} session=${p.session_id} status=${p.status} env=${p.environment} via=${result.via}`);

  if (p.event_id && seenEventIds.has(p.event_id)) return res.json({ ok: true, duplicate: true });
  if (p.event_id) seenEventIds.add(p.event_id);

  if (!['status.updated', 'data.updated'].includes(p.webhook_type) || !p.session_id) {
    return res.json({ ok: true, ignored: true });
  }

  const rec = sessions.get(p.session_id);
  // Only apply an event to the user who owns the session.
  if (rec?.vendorData && p.vendor_data && rec.vendorData !== p.vendor_data) {
    console.warn(`[webhook] vendor_data mismatch for ${p.session_id}, ignoring`);
    return res.json({ ok: true, ignored: true });
  }
  // Delivery order is not guaranteed: ignore events older than what we already applied.
  if (rec?.lastEventAt && typeof p.created_at === 'number' && p.created_at < rec.lastEventAt) {
    return res.json({ ok: true, stale: true });
  }

  try {
    let updated;
    if (p.decision) {
      updated = applyDecision(p.session_id, { ...p.decision, status: p.status, environment: p.decision.environment ?? p.environment }, p.vendor_data);
    } else {
      updated = rec ?? { sessionId: p.session_id, vendorData: p.vendor_data };
      updated.status = p.status ?? updated.status;
      sessions.set(p.session_id, updated);
      // data.updated (or a status without decision): re-read the server of record.
      if (TERMINAL_STATUSES.has(updated.status) && DIDIT_API_KEY) {
        const decision = await didit('GET', `/v3/session/${encodeURIComponent(p.session_id)}/decision/`);
        updated = applyDecision(p.session_id, decision, p.vendor_data);
      }
    }
    if (typeof p.created_at === 'number') updated.lastEventAt = p.created_at;
  } catch (e) {
    console.error(`[webhook] processing failed: ${e.message}`);
    seenEventIds.delete(p.event_id); // let Didit's retry try again
    return res.status(500).json({ error: 'processing failed' });
  }
  res.json({ ok: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  testUserId(req, res);
  res.json({ environment: DIDIT_ENV });
});

app.post('/api/start-verification', async (req, res) => {
  const vendorData = testUserId(req, res);
  const body = {
    workflow_id: DIDIT_WORKFLOW_ID,
    vendor_data: vendorData,
    callback: `${PUBLIC_BASE_URL.replace(/\/$/, '')}/callback`,
    callback_method: 'both',
    metadata: { app: 'didit-test' },
  };
  // sandbox_scenario is only accepted by sandbox applications (live returns 400).
  const scenario = req.body?.sandbox_scenario;
  if (DIDIT_ENV === 'sandbox' && typeof scenario === 'string' && /^[a-z_]{1,64}$/.test(scenario)) {
    body.sandbox_scenario = scenario;
  }
  try {
    const s = await didit('POST', '/v3/session/', body);
    sessions.set(s.session_id, { sessionId: s.session_id, vendorData, status: s.status });
    console.log(`[session] created ${s.session_id} status=${s.status}`);
    // session_token is a secret for the native SDKs; the hosted redirect only needs `url`.
    res.json({ session_id: s.session_id, url: s.url });
  } catch (e) {
    console.error(`[session] ${e.message}`, e.data);
    res.status(502).json({ error: e.message, details: e.data });
  }
});

// Didit redirects the user here with ?verificationSessionId=...&status=...
// The status in the URL is not trusted; the result page asks the server.
app.get('/callback', (req, res) => {
  const id = String(req.query.verificationSessionId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.redirect('/');
  res.redirect(`/result/${id}`);
});

app.get('/result/:sessionId', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'result.html')));

app.get('/api/result/:sessionId', async (req, res) => {
  const uid = testUserId(req, res);
  const id = req.params.sessionId;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'bad session id' });
  let rec = sessions.get(id);
  if (rec && rec.vendorData !== uid) return res.status(404).json({ error: 'not found' });

  // No final data yet (webhook not arrived / not configured): ask the API, at most every 5s.
  const needsFetch = !rec?.summary || !TERMINAL_STATUSES.has(rec.status);
  if (needsFetch && DIDIT_API_KEY && Date.now() - (rec?.lastFetchAt ?? 0) > 5000) {
    try {
      const decision = await didit('GET', `/v3/session/${encodeURIComponent(id)}/decision/`);
      if (decision.vendor_data !== uid) return res.status(404).json({ error: 'not found' });
      rec = applyDecision(id, decision, uid);
      rec.lastFetchAt = Date.now();
    } catch (e) {
      if (!rec) return res.status(e.status === 404 ? 404 : 502).json({ error: e.message });
      rec.lastFetchAt = Date.now();
    }
  }
  if (!rec) return res.status(404).json({ error: 'not found' });
  res.json({ sessionId: id, status: rec.status, final: TERMINAL_STATUSES.has(rec.status), summary: rec.summary ?? null });
});

app.listen(PORT, () => console.log(`didit-test on http://localhost:${PORT} (public: ${PUBLIC_BASE_URL}, env: ${DIDIT_ENV})`));
