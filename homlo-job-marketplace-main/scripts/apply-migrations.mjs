import postgres from 'postgres';
import { readFileSync } from 'fs';

function splitSql(text) {
  const stmts = [];
  let cur = "";
  let i = 0;
  const n = text.length;
  let inSingle = false, inDouble = false, inLineComment = false, inBlockComment = false, inDollar = null;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (inBlockComment) {
      cur += ch;
      if (ch === "*" && next === "/") {
        cur += "/"; i += 2; inBlockComment = false; continue;
      }
      i += 1; continue;
    }
    if (inLineComment) {
      cur += ch;
      if (ch === "\n") inLineComment = false;
      i += 1; continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'") {
        if (next === "'") { cur += "'"; i += 2; continue; }
        inSingle = false;
      }
      i += 1; continue;
    }
    if (inDouble) {
      cur += ch;
      if (ch === '"') {
        if (next === '"') { cur += '"'; i += 2; continue; }
        inDouble = false;
      }
      i += 1; continue;
    }
    if (inDollar !== null) {
      if (text.startsWith(inDollar, i)) {
        cur += inDollar;
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === "-" && next === "-") { cur += ch; i += 1; inLineComment = true; continue; }
    if (ch === "/" && next === "*") { cur += ch + next; i += 2; inBlockComment = true; continue; }
    if (ch === "'") { inSingle = true; cur += ch; i += 1; continue; }
    if (ch === '"') { inDouble = true; cur += ch; i += 1; continue; }
    if (ch === "$") {
      const m = /^\$[a-zA-Z_0-9]*\$/.exec(text.slice(i));
      if (m) { inDollar = m[0]; cur += m[0]; i += m[0].length; continue; }
    }
    if (ch === ";") { if (cur.trim()) stmts.push(cur.trim()); cur = ""; i += 1; continue; }
    cur += ch; i += 1;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

const envRaw = readFileSync('./.env', 'utf8');
const url = Object.fromEntries(envRaw.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => { const [k, ...rest] = l.split('='); return [k.trim(), rest.join('=').trim()]; })).SUPABASE_DB_URL;

const targets = process.argv.slice(2);
if (targets.length === 0) throw new Error("usage: node scripts/apply-migrations.mjs <file.sql> [...]");

for (const file of targets) {
  const query = readFileSync(file, 'utf8');
  const stmts = splitSql(query);
  console.log(`>> applying ${file} (${stmts.length} statements)`);
  const sql = postgres(url, { max: 1, connection: { application_name: 'homlo-migration' } });
  try {
    await sql.begin(async (tx) => {
      for (let k = 0; k < stmts.length; k++) {
        // eslint-disable-next-line no-console
        process.stdout.write(`   [${k + 1}/${stmts.length}] ${stmts[k].split('\n')[0].replace(/\s+/g, ' ').slice(0, 90)}\n`);
        await tx.unsafe(stmts[k]);
      }
    });
    console.log(`   ok`);
  } catch (e) {
    console.log(`   FAILED: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}