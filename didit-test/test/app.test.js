// Offline tests: no Didit calls. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhook, canonicalJson } from '../lib/signature.js';
import { summarize, ageFromDob } from '../lib/summary.js';

const secret = 'test-secret';
const now = 1_800_000_000;
const payload = { webhook_type: 'status.updated', session_id: 'abc', status: 'Approved', name: 'José', score: 100.0, event_id: 'e1' };
const raw = Buffer.from(JSON.stringify(payload, null, 2)); // pretty-printed: raw != canonical
const hmac = (d) => crypto.createHmac('sha256', secret).update(d).digest('hex');

test('accepts valid X-Signature-V2 (canonical JSON)', () => {
  const headers = { 'x-timestamp': String(now), 'x-signature-v2': hmac(canonicalJson(JSON.parse(raw))) };
  const r = verifyWebhook({ rawBody: raw, headers, secret, nowSeconds: now });
  assert.equal(r.ok, true); assert.equal(r.via, 'X-Signature-V2');
});

test('canonical JSON sorts keys, keeps Unicode, prints whole floats as ints', () => {
  assert.equal(canonicalJson({ b: 1.0, a: { d: 'é', c: [2, 1] } }), '{"a":{"c":[2,1],"d":"é"},"b":1}');
});

test('accepts valid raw-body X-Signature', () => {
  const headers = { 'x-timestamp': String(now), 'x-signature': hmac(raw) };
  assert.equal(verifyWebhook({ rawBody: raw, headers, secret, nowSeconds: now }).ok, true);
});

test('rejects bad signature, stale timestamp, missing timestamp', () => {
  const good = hmac(canonicalJson(payload));
  assert.equal(verifyWebhook({ rawBody: raw, headers: { 'x-timestamp': String(now), 'x-signature-v2': '00' + good.slice(2) }, secret, nowSeconds: now }).ok, false);
  assert.equal(verifyWebhook({ rawBody: raw, headers: { 'x-timestamp': String(now - 301), 'x-signature-v2': good }, secret, nowSeconds: now }).reason, 'stale X-Timestamp');
  assert.equal(verifyWebhook({ rawBody: raw, headers: { 'x-signature-v2': good }, secret, nowSeconds: now }).ok, false);
});

test('ageFromDob handles birthdays', () => {
  const today = new Date('2026-11-20T12:00:00Z');
  assert.equal(ageFromDob('2008-11-20', today), 18);
  assert.equal(ageFromDob('2008-11-21', today), 17);
  assert.equal(ageFromDob('garbage', today), null);
});

test('summarize picks fields, flags expiry, drops image URLs', () => {
  const s = summarize({
    status: 'Declined',
    id_verifications: [{ status: 'Declined', first_name: 'Ana', last_name: 'Diaz', date_of_birth: '1990-06-15', age: 36,
      document_type: 'Passport', document_number: 'X1', expiration_date: '2020-01-01', nationality: 'ESP',
      portrait_image: 'https://secret/img.jpg', warnings: [{ risk: 'DOCUMENT_EXPIRED', log_type: 'error', short_description: 'Expired' }] }],
    liveness_checks: [{ status: 'Approved', method: 'PASSIVE', score: 97.1, reference_image: 'https://x' }],
    face_matches: [{ status: 'Approved', score: 88.2 }],
  }, new Date('2026-11-20T00:00:00Z'));
  assert.equal(s.document.fullName, 'Ana Diaz');
  assert.equal(s.age.fromDob, 36); assert.equal(s.age.isAdult, true);
  assert.deepEqual(s.reasons, ['ID verification: Declined']);
  assert.ok(s.warnings.some(w => w.risk === 'DOCUMENT_EXPIRED' && w.feature === 'APP_CHECK'));
  assert.ok(!JSON.stringify(s).includes('https://'));
});
