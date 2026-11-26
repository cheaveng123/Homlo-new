#!/usr/bin/env node
/**
 * App Store pre-submission check. Run before every TestFlight / App Store build:
 *
 *   npm run check:release
 *
 * Fails (exit 1) on settings that get iOS apps rejected or broken in review.
 * Reads .env (and the real process env, which wins) plus the shipped Info.plist.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isIP } from "node:net";

const root = new URL("..", import.meta.url).pathname;
const env = { ...parseEnv(`${root}.env`), ...process.env };
const failures = [];
const warnings = [];
const ok = [];

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const check = (pass, good, bad, level = "fail") => {
  if (pass) ok.push(good);
  else (level === "warn" ? warnings : failures).push(bad);
};

// 4. IPv6 / reachable API: App Review runs on an IPv6-only (NAT64) network.
const api = (env.PUBLIC_API_BASE_URL || "").trim();
let apiHost = "";
try { apiHost = new URL(api).hostname.replace(/^\[|\]$/g, ""); } catch { /* invalid */ }
check(Boolean(api), "API base URL is set", "PUBLIC_API_BASE_URL is not set — release builds fall back to http://localhost:3000 and nothing loads on the reviewer's phone.");
if (api) {
  check(api.startsWith("https://"), "API uses https", `PUBLIC_API_BASE_URL must use https:// (got ${api}).`);
  check(apiHost && isIP(apiHost) === 0, "API uses a hostname (works on IPv6/NAT64)", `PUBLIC_API_BASE_URL must be a hostname, not an IP address (${apiHost}) — IP literals break on Apple's IPv6 review network.`);
  check(!/^(localhost|127\.|10\.|192\.168\.|.*\.local$)/.test(apiHost), "API is not a local address", `PUBLIC_API_BASE_URL points at a local address (${apiHost}).`);
}

// In-app purchases must use the live App Store key, not RevenueCat's Test Store.
const rcIos = (env.PUBLIC_RC_IOS_KEY || "").trim();
check(rcIos.startsWith("appl_"), "RevenueCat iOS key is a live App Store key", "PUBLIC_RC_IOS_KEY is missing or not an appl_… key — the app would ship the Test Store key, which App Review rejects.");

// 5 / 20. No sample content or fake reviews.
check(env.PUBLIC_DEMO_CONTENT !== "true", "Demo content is off", "PUBLIC_DEMO_CONTENT=true would show sample employers, ratings and reviews to real users.");

// 5 / 17. Real legal pages with contact details.
const legal = readFileSync(`${root}lib/legal-content.ts`, "utf8");
check(!/isPlaceholder:\s*true/.test(legal), "Privacy policy and terms are published", "lib/legal-content.ts still has placeholder Privacy policy / Terms (isPlaceholder: true). Add your real text and a support contact.");

// 17. In-app contact (Profile → Contact support).
const support = (env.PUBLIC_SUPPORT_EMAIL || "").trim();
check(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(support), "Support email is set", "PUBLIC_SUPPORT_EMAIL is not set — the in-app \"Contact support\" option stays hidden.");

// 7 / 2.5.4. Info.plist purpose strings and background modes.
const plist = `${root}ios/HireNow/Info.plist`;
if (existsSync(plist)) {
  const json = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist]).toString());
  for (const [key, value] of Object.entries(json)) {
    if (!key.endsWith("UsageDescription")) continue;
    check(typeof value === "string" && value.length >= 40 && !/^Allow \$\(PRODUCT_NAME\) to/i.test(value) && !/to access your [\w ]+\.?$/i.test(value),
      `${key} is specific`, `${key} is too vague ("${value}") — say exactly why the app needs it.`);
  }
  const modes = json.UIBackgroundModes ?? [];
  check(!modes.includes("audio"), "No background-audio mode", "UIBackgroundModes contains 'audio' but the app plays no background audio (guideline 2.5.4).");
  check(!modes.includes("location"), "No background-location mode", "UIBackgroundModes contains 'location' but the app never tracks location in the background.");
}

// Reminders that can't be checked from code.
warnings.push(
  "App Store Connect: add a working demo account (email + password) in App Review Information (#15).",
  "App Store Connect: support URL + contact email, iOS-only screenshots of real screens (no splash, no Android), honest app name (#1, #11, #17, #19).",
);

for (const line of ok) console.log(`  ✓ ${line}`);
for (const line of warnings) console.log(`  ! ${line}`);
for (const line of failures) console.log(`  ✗ ${line}`);
console.log(failures.length ? `\n${failures.length} problem(s) would block App Store submission.` : "\nRelease configuration looks ready.");
process.exit(failures.length ? 1 : 0);
