#!/usr/bin/env node
/**
 * Bundle-size guard (perf guardrail). Builds the production Android JS bundle
 * with `expo export` and fails if it grows past the limit, so a whole-library
 * import or a forgotten dev dependency in the app shows up in CI instead of
 * in users' startup time.
 *
 *   pnpm check:bundle                    # build + check
 *   BUNDLE_LIMIT_KB=9000 pnpm check:bundle
 *   pnpm check:bundle -- --dir <export>  # check an existing export, no build
 *
 * The limit is the measured size on 2026-11-20 (9,737 KB Hermes bytecode) plus ~5% headroom. Raise it on
 * purpose (with a reason in the commit), never to silence the check.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const DEFAULT_LIMIT_KB = Number(process.env.BUNDLE_LIMIT_KB) || 10_240;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const dirArg = process.argv.indexOf("--dir");
let outDir = dirArg > -1 ? process.argv[dirArg + 1] : null;
if (!outDir) {
  outDir = mkdtempSync(join(tmpdir(), "homlo-bundle-"));
  console.log(`Building production Android bundle into ${outDir} …`);
  execFileSync("npx", ["expo", "export", "--platform", "android", "--output-dir", outDir], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  });
}

const bundles = walk(outDir)
  .filter((file) => /_expo\/static\/js\/android\/.+\.(hbc|js)$/.test(file))
  .map((file) => ({ file, kb: Math.round(statSync(file).size / 1024) }))
  .sort((a, b) => b.kb - a.kb);

if (bundles.length === 0) {
  console.error("No Android JS bundle found in the export output.");
  process.exit(1);
}

const main = bundles[0];
console.log(`Initial bundle: ${main.kb} KB (limit ${DEFAULT_LIMIT_KB} KB) — ${main.file}`);
if (main.kb > DEFAULT_LIMIT_KB) {
  console.error(`Bundle size check FAILED: ${main.kb} KB > ${DEFAULT_LIMIT_KB} KB.`);
  process.exit(1);
}
console.log("Bundle size check passed.");
