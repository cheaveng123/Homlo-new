#!/usr/bin/env node
/**
 * Migration linter (perf guardrail). Fails on new migrations that would lock a
 * busy table or break running code:
 *
 *   index-not-concurrent  CREATE INDEX on a busy table without CONCURRENTLY
 *                         (blocks writes for the whole build)
 *   drop-column           DROP COLUMN (running servers may still select it)
 *   alter-type            ALTER COLUMN ... TYPE (rewrites the table under lock)
 *   lock-table            explicit LOCK TABLE
 *   add-not-null          ADD COLUMN ... NOT NULL without DEFAULT (fails on
 *                         existing rows)
 *
 * Only migrations newer than the baseline are checked (older ones are already
 * applied). To allow a rule in one file on purpose, add a comment:
 *   -- migration-lint: allow drop-column
 *
 *   pnpm check:migrations
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

// Everything up to and including these is already applied: not checked.
const BASELINES = [
  { dir: "backend/database/migrations", after: (name) => Number.parseInt(name, 10) > 59 },
  { dir: "supabase/migrations", after: (name) => name.slice(0, 14) > "20261120150000" },
];

const BUSY_TABLES = [
  "jobs", "applications", "profiles", "users", "user_identities", "messages",
  "conversations", "conversation_members", "notifications", "job_events",
  "job_events_anon", "boosts", "payments", "saved_jobs", "reports",
];

/** Strips -- and /* *\/ comments so commented-out SQL is not linted. */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

export function lintMigration(name, sql) {
  const allowed = new Set([...sql.matchAll(/--\s*migration-lint:\s*allow\s+([a-z-]+)/gi)].map((m) => m[1].toLowerCase()));
  const body = stripComments(sql).replace(/\s+/g, " ").toLowerCase();
  const problems = [];
  const report = (rule, detail) => {
    if (!allowed.has(rule)) problems.push(`${name}: ${rule} — ${detail}`);
  };

  for (const m of body.matchAll(/create (unique )?index (?!concurrently)(?:if not exists )?([\w."]+)? ?on (only )?(?:public\.)?"?(\w+)"?/g)) {
    if (BUSY_TABLES.includes(m[4])) report("index-not-concurrent", `index on ${m[4]} without CONCURRENTLY`);
  }
  for (const m of body.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?"?(\w+)"?[^;]*?drop column/g)) {
    report("drop-column", `drops a column from ${m[1]}`);
  }
  for (const m of body.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?"?(\w+)"?[^;]*?alter column [\w"]+ (?:set data )?type /g)) {
    report("alter-type", `changes a column type on ${m[1]}`);
  }
  if (/\block table\b/.test(body)) report("lock-table", "explicit LOCK TABLE");
  for (const m of body.matchAll(/add column (?:if not exists )?[\w"]+ [^,;]*?not null[^,;]*/g)) {
    if (!/\bdefault\b/.test(m[0])) report("add-not-null", `adds a NOT NULL column without DEFAULT: "${m[0].trim()}"`);
  }
  return problems;
}

function main() {
  const problems = [];
  let checked = 0;
  for (const { dir, after } of BASELINES) {
    for (const name of readdirSync(join(root, dir)).filter((f) => f.endsWith(".sql")).sort()) {
      if (!after(name)) continue;
      checked += 1;
      problems.push(...lintMigration(`${dir}/${name}`, readFileSync(join(root, dir, name), "utf8")));
    }
  }
  if (problems.length) {
    console.error(`Migration lint failed (${problems.length}):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`Migration lint passed (${checked} new migration file(s) checked).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
