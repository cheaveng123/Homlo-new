// Didit webhook signature verification.
// Spec: https://docs.didit.me/integration/webhooks
//   X-Signature-V2 = hex HMAC-SHA256(secret, canonical JSON: keys sorted recursively,
//                    compact separators, Unicode not escaped)   <- recommended
//   X-Signature    = hex HMAC-SHA256(secret, exact raw body bytes)
//   X-Timestamp    = unix seconds; reject if |now - ts| > 300
// X-Signature-Simple is deprecated (it does not cover `decision`), so it is not accepted here.
import crypto from 'node:crypto';

const MAX_SKEW_SECONDS = 300;

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = sortKeys(value[k]);
      return acc;
    }, {});
  }
  return value;
}

// JSON.parse already turns 100.0 into 100, which matches Didit's "whole floats as integers" rule.
export function canonicalJson(parsed) {
  return JSON.stringify(sortKeys(parsed));
}

function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqualHex(expected, received) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received.trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @param {object} p
 * @param {Buffer} p.rawBody  untouched request body
 * @param {object} p.headers  Node lower-cased headers
 * @param {string} p.secret   webhook destination secret_shared_key
 * @returns {{ok: true, payload: object, via: string} | {ok: false, reason: string}}
 */
export function verifyWebhook({ rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };

  const ts = Number(headers['x-timestamp']);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'missing X-Timestamp' };
  if (Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale X-Timestamp' };

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { ok: false, reason: 'body is not JSON' };
  }

  const v2 = headers['x-signature-v2'];
  if (v2 && safeEqualHex(hmacHex(secret, canonicalJson(payload)), v2)) {
    return { ok: true, payload, via: 'X-Signature-V2' };
  }
  const v1 = headers['x-signature'];
  if (v1 && safeEqualHex(hmacHex(secret, rawBody), v1)) {
    return { ok: true, payload, via: 'X-Signature' };
  }
  return { ok: false, reason: 'signature mismatch' };
}
