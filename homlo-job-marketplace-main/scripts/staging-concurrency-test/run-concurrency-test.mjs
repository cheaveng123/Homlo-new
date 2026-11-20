import { Buffer } from "node:buffer";
import postgres from "postgres";
import { createInterface } from "readline";
import { once } from "events";
import { readFileSync, readdirSync } from "fs";

const STAGING_REF = "fkoamjdqmlklyvmjtwji";
const PROD_REF = "gwzknvycbzloomxhvslo";

async function askPassword() {
  // Non-TTY: read one line from stdin (piped input)
  if (!process.stdin.isTTY) {
    const { stdin } = process;
    const chunks = [];
    return new Promise((resolve, reject) => {
      stdin.on("data", (c) => chunks.push(c));
      stdin.on("end", () => {
        const input = Buffer.concat(chunks).toString().replace(/\r?\n$/, "");
        if (input.length === 0) reject(new Error("no password provided on stdin"));
        else resolve(input);
      });
      stdin.on("error", reject);
    });
  }

  // TTY: hidden prompt
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let input = "";
    const onData = (chunk) => {
      const s = chunk.toString();
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\n" || c === "\r") {
          process.stdin.removeListener("data", onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          rl.close();
          resolve(input);
          return;
        }
        if (c === "\u0003") {
          process.stdin.removeListener("data", onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          rl.close();
          reject(new Error("cancelled"));
          return;
        }
        if (c === "\u007f" || c === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        input += c;
        process.stdout.write("*");
      }
    };
    process.stdout.write("Staging database password (input hidden): ");
    process.stdin.on("data", onData);
    once(rl, "close").then(() => process.stdout.write("\n"));
  });
}

async function main() {
  const REGION = process.env.STAGING_REGION;
  if (!REGION) {
    console.error("ERROR: STAGING_REGION environment variable is not set.");
    console.error("Set it to the staging project's AWS region (e.g. ap-southeast-1) and re-run.");
    process.exit(1);
  }

  const password = await askPassword();
  const encodedPw = encodeURIComponent(password);

  const host = `aws-1-${REGION}.pooler.supabase.com`;
  if (host.includes("xxxx")) {
    console.error("ERROR: resolved host contains placeholder 'xxxx'. Region may be wrong.");
    process.exit(1);
  }

  const url = `postgres://postgres.${STAGING_REF}:${encodedPw}@${host}:5432/postgres`;
  if (!url.includes(STAGING_REF)) {
    console.error("ERROR: built URL does not contain the staging project ref.");
    process.exit(1);
  }
  if (url.includes(PROD_REF)) {
    console.error("ERROR: built URL contains the production project ref. Aborting.");
    process.exit(1);
  }

  const results = { preflight: {}, setup: null, tests: [], cleanup: null };
  const createdAuthIds = new Set();

  async function ensureAuthUser(sql, id, role) {
    await sql`
      insert into public.users (id)
      values (${id})
      on conflict (id) do nothing
    `;
    createdAuthIds.add(id);
  }

  // TWO SEPARATE database connections (two postgres instances, max 1 each)
  const sql1 = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });
  const sql2 = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });

  try {
    // ===== STEP 0: PREFLIGHT (read-only) =====
    console.log("\n===== STEP 0: PREFLIGHT (read-only) =====");

    // 0a. Confirm database by project ref only
    const [verRow] = await sql1`select current_database() as db_name, current_user as db_user`;
    console.log(`0a. Connected to database: ${verRow.db_name}, user: ${verRow.db_user}`);
    console.log(`    Target project ref (staging): ${STAGING_REF}`);
    results.preflight["0a"] = { database: verRow.db_name, project_ref: STAGING_REF };

    // 0b. Function definition
    const funcRows = await sql1`
      select proname, prosrc,       pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and proname = 'homlo_submit_application'
    `;
    if (funcRows.length === 0) {
      console.error("0b. FAIL: public.homlo_submit_application not found on staging. STOP.");
      results.preflight["0b"] = { found: false };
      console.log(JSON.stringify(results, null, 2));
      process.exit(1);
    }
    const funcDef = funcRows[0].prosrc;
    const hasVShouldNotify = funcDef.includes("v_should_notify");
    const hasForUpdate = funcDef.includes("FOR UPDATE");
    console.log(`0b. public.homlo_submit_application found.`);
    console.log(`    Contains v_should_notify: ${hasVShouldNotify}`);
    console.log(`    Contains FOR UPDATE: ${hasForUpdate}`);
    console.log(`    Function definition:`);
    console.log(funcDef);
    results.preflight["0b"] = { found: true, hasVShouldNotify, hasForUpdate, definition: funcDef };

    const fsMig = readFileSync("supabase/migrations/20261110230000_harden_application_and_job_posting.sql", "utf8");
    const migFuncMatch = fsMig.match(/CREATE OR REPLACE FUNCTION public\.homlo_submit_application[\s\S]*?END;\s*\$function\$/);
    const matchesMigration = migFuncMatch && migFuncMatch[0].trim() === funcDef.trim();
    console.log(`    Matches migration file 20261110230000: ${matchesMigration}`);
    results.preflight["0b"].matchesMigration = matchesMigration;

    // 0c. Applied migrations vs files
    const appliedRows = await sql1`select version from supabase.schema_migrations order by version`;
    const appliedVersions = appliedRows.map((r) => r.version);
    console.log(`0c. Applied migrations on staging (${appliedVersions.length}):`);
    appliedVersions.forEach((v) => console.log(`    - ${v}`));

    const migrationFiles = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    console.log(`    Migration files in repo (${migrationFiles.length}):`);
    migrationFiles.forEach((f) => console.log(`    - ${f}`));

    const fileVersions = migrationFiles.map((f) => f.replace(/_.*$/, ""));
    const notApplied = fileVersions.filter((v) => !appliedVersions.includes(v));
    const notInFiles = appliedVersions.filter((v) => !fileVersions.includes(v));
    console.log(`    Files not applied (${notApplied.length}): ${notApplied.join(", ")}`);
    console.log(`    Applied but not in files (${notInFiles.length}): ${notInFiles.join(", ")}`);
    results.preflight["0c"] = { appliedVersions, fileVersions, notApplied, notInFiles };

    // 0d. Unique constraint on applications (job_id, worker_id)
    const constraints = await sql1`
      select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
      where conrelid = 'public.applications'::regclass and contype = 'u'
    `;
    const uniqueOnJobWorker = constraints.some((c) => c.def.includes("job_id") && c.def.includes("worker_id"));
    console.log(`0d. Unique constraints on applications:`);
    constraints.forEach((c) => console.log(`    - ${c.conname}: ${c.def}`));
    console.log(`    Unique constraint on (job_id, worker_id) exists: ${uniqueOnJobWorker}`);
    results.preflight["0d"] = { constraints, uniqueOnJobWorkerExists: uniqueOnJobWorker };

    if (!hasVShouldNotify || !hasForUpdate || !uniqueOnJobWorker) {
      console.error("\nSTOP: preflight 0b or 0d failed. Not proceeding to setup/tests.");
      console.log(JSON.stringify(results, null, 2));
      process.exit(1);
    }

    // ===== STEP 1: SETUP =====
    console.log("\n===== STEP 1: SETUP (create minimal test data) =====");

    const employerId = crypto.randomUUID();
    const worker1Id = crypto.randomUUID();
    const worker2Id = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    try {
      await ensureAuthUser(sql1, employerId, 'employer');
      await ensureAuthUser(sql1, worker1Id, 'worker');
      await ensureAuthUser(sql1, worker2Id, 'worker');
      await sql1`
        insert into public.profiles (user_id, role, full_name, deleted_at)
        values
          (${employerId}, 'employer', 'TEST-concurrency-employer', null),
          (${worker1Id}, 'worker', 'TEST-concurrency-worker-1', null),
          (${worker2Id}, 'worker', 'TEST-concurrency-worker-2', null)
        on conflict (user_id) do nothing
      `;
      console.log(`    Created profiles: employer=${employerId}, worker1=${worker1Id}, worker2=${worker2Id}`);
    } catch (e) {
      console.error(`    Failed to insert profiles: ${e.message}`);
      console.error("    Profiles may require auth users. Need to create auth users first.");
      process.exit(1);
    }

    await sql1`
      insert into public.jobs (id, employer_id, title, description, pay_amount, pay_currency, pay_type, status, workers_needed, workers_hired, deleted_at, published_at)
      values (${jobId}, ${employerId}, 'TEST-concurrency-job', 'Concurrency test job', 1000, 'USD', 'hourly', 'open', 10, 0, null, now())
    `;
    console.log(`    Created job: ${jobId} (employer=${employerId}, workers_needed=10, status=open)`);

    results.setup = { employerId, worker1Id, worker2Id, jobId, authIds: Array.from(createdAuthIds) };

    // ===== STEP 2: CONCURRENCY TESTS =====
    console.log("\n===== STEP 2: CONCURRENCY TESTS =====");

    async function countApplications(jid) {
      const rows = await sql1`select count(*)::int as cnt from public.applications where job_id = ${jid}`;
      return rows[0].cnt;
    }
    async function countNotifications(eid) {
      const rows = await sql1`select count(*)::int as cnt from public.notifications where user_id = ${eid} and type = 'new_application'`;
      return rows[0].cnt;
    }

    async function cleanupRound(eid, wid, jid) {
      await sql1`delete from public.notifications where user_id = ${eid} and type = 'new_application'`;
      await sql1`delete from public.applications where job_id = ${jid}`;
      await sql1`delete from public.jobs where id = ${jid}`;
      await sql1`delete from public.profiles where user_id in (${eid}, ${wid})`;
      await sql1`delete from public.users where id in (${eid}, ${wid})`;
    }

    async function runTestA(round) {
      const eid = crypto.randomUUID();
      const wid = crypto.randomUUID();
      const jid = crypto.randomUUID();
      await ensureAuthUser(sql1, eid, 'employer');
      await ensureAuthUser(sql1, wid, 'worker');
      await sql1`insert into public.profiles (user_id, role, full_name) values (${eid}, 'employer', 'TEST-concurrency-employer'), (${wid}, 'worker', 'TEST-concurrency-worker') on conflict (user_id) do nothing`;
      await sql1`insert into public.jobs (id, employer_id, title, description, pay_amount, pay_currency, pay_type, status, workers_needed, workers_hired, deleted_at, published_at) values (${jid}, ${eid}, 'TEST-concurrency-job', 'test', 1000, 'USD', 'hourly', 'open', 10, 0, null, now())`;

      const errors = [];
      let appBefore, appAfter, notifBefore, notifAfter;
      try {
        appBefore = await countApplications(jid);
        notifBefore = await countNotifications(eid);
        await Promise.all([
          sql2`select * from public.homlo_submit_application(${wid}, ${jid}, 'msg')`,
          sql1`select * from public.homlo_submit_application(${wid}, ${jid}, 'msg')`,
        ]);
        appAfter = await countApplications(jid);
        notifAfter = await countNotifications(eid);
      } catch (e) {
        errors.push(e.message);
        appAfter = await countApplications(jid).catch(() => -1);
        notifAfter = await countNotifications(eid).catch(() => -1);
      }

      const pass = errors.length === 0 && appAfter === 1 && notifAfter === 1;
      await cleanupRound(eid, wid, jid);
      return { test: "A", round, applications: appAfter, newNotifications: notifAfter - notifBefore, errors, pass, appBefore, notifBefore, notifAfter };
    }

    async function runTestB(round) {
      const eid = crypto.randomUUID();
      const wid = crypto.randomUUID();
      const jid = crypto.randomUUID();
      await ensureAuthUser(sql1, eid, 'employer');
      await ensureAuthUser(sql1, wid, 'worker');
      await sql1`insert into public.profiles (user_id, role, full_name) values (${eid}, 'employer', 'TEST-concurrency-employer'), (${wid}, 'worker', 'TEST-concurrency-worker') on conflict (user_id) do nothing`;
      await sql1`insert into public.jobs (id, employer_id, title, description, pay_amount, pay_currency, pay_type, status, workers_needed, workers_hired, deleted_at, published_at) values (${jid}, ${eid}, 'TEST-concurrency-job', 'test', 1000, 'USD', 'hourly', 'open', 10, 0, null, now())`;
      await sql1`select * from public.homlo_submit_application(${wid}, ${jid}, 'initial')`;
      await sql1`update public.applications set status = 'withdrawn' where job_id = ${jid} and worker_id = ${wid}`;

      const errors = [];
      let appAfter, notifBefore, notifAfter;
      try {
        notifBefore = await countNotifications(eid);
        await Promise.all([
          sql2`select * from public.homlo_submit_application(${wid}, ${jid}, 'reapply-msg')`,
          sql1`select * from public.homlo_submit_application(${wid}, ${jid}, 'reapply-msg')`,
        ]);
        appAfter = await countApplications(jid);
        notifAfter = await countNotifications(eid);
      } catch (e) {
        errors.push(e.message);
        appAfter = await countApplications(jid).catch(() => -1);
        notifAfter = await countNotifications(eid).catch(() => -1);
      }

      const newNotifs = notifAfter - notifBefore;
      const finalApp = await sql1`select status from public.applications where job_id = ${jid} and worker_id = ${wid}`;
      const finalStatus = finalApp.length > 0 ? finalApp[0].status : null;

      const pass = errors.length === 0 && finalStatus === "applied" && appAfter === 1 && newNotifs === 1;
      await cleanupRound(eid, wid, jid);
      return { test: "B", round, applications: appAfter, newNotifications: newNotifs, errors, pass, finalStatus, notifBefore, notifAfter };
    }

    async function runTestC() {
      const eid = crypto.randomUUID();
      const w1 = crypto.randomUUID();
      const w2 = crypto.randomUUID();
      const jid = crypto.randomUUID();
      await ensureAuthUser(sql1, eid, 'employer');
      await ensureAuthUser(sql1, w1, 'worker');
      await ensureAuthUser(sql1, w2, 'worker');
      await sql1`insert into public.profiles (user_id, role, full_name) values (${eid}, 'employer', 'TEST-concurrency-employer'), (${w1}, 'worker', 'TEST-concurrency-worker-1'), (${w2}, 'worker', 'TEST-concurrency-worker-2') on conflict (user_id) do nothing`;
      await sql1`insert into public.jobs (id, employer_id, title, description, pay_amount, pay_currency, pay_type, status, workers_needed, workers_hired, deleted_at, published_at) values (${jid}, ${eid}, 'TEST-concurrency-job', 'test', 1000, 'USD', 'hourly', 'open', 10, 0, null, now())`;

      const errors = [];
      let appAfter, notifAfter;
      try {
        await Promise.all([
          sql2`select * from public.homlo_submit_application(${w1}, ${jid}, 'msg-1')`,
          sql1`select * from public.homlo_submit_application(${w2}, ${jid}, 'msg-2')`,
        ]);
        appAfter = await countApplications(jid);
        notifAfter = await countNotifications(eid);
      } catch (e) {
        errors.push(e.message);
        appAfter = await countApplications(jid).catch(() => -1);
        notifAfter = await countNotifications(eid).catch(() => -1);
      }

      const pass = errors.length === 0 && appAfter === 2 && notifAfter === 2;
      await cleanupRound(eid, w1, jid);
      await sql1`delete from public.profiles where user_id = ${w2}`;
      return { test: "C", round: 1, applications: appAfter, newNotifications: notifAfter, errors, pass };
    }

    console.log("Running Test A (20 rounds)...");
    for (let i = 1; i <= 20; i++) {
      const r = await runTestA(i);
      results.tests.push(r);
      console.log(`  Round ${i}: apps=${r.applications}, new_notifs=${r.newNotifications}, errors=${r.errors.length}, pass=${r.pass}`);
    }

    console.log("Running Test B (20 rounds)...");
    for (let i = 1; i <= 20; i++) {
      const r = await runTestB(i);
      results.tests.push(r);
      console.log(`  Round ${i}: apps=${r.applications}, new_notifs=${r.newNotifications}, errors=${r.errors.length}, pass=${r.pass}, status=${r.finalStatus}`);
    }

    console.log("Running Test C (sanity, 1 round)...");
    const rC = await runTestC();
    results.tests.push(rC);
    console.log(`  Round 1: apps=${rC.applications}, new_notifs=${rC.newNotifications}, errors=${rC.errors.length}, pass=${rC.pass}`);

    // ===== STEP 3: CLEANUP =====
    console.log("\n===== STEP 3: CLEANUP =====");
    await sql1`delete from public.notifications where user_id = ${employerId} and type = 'new_application'`;
    await sql1`delete from public.applications where job_id = ${jobId}`;
    await sql1`delete from public.jobs where id = ${jobId}`;
    await sql1`delete from public.profiles where user_id in (${employerId}, ${worker1Id}, ${worker2Id})`;
    await sql1`delete from public.users where id in (${employerId}, ${worker1Id}, ${worker2Id})`;
    console.log(`    Deleted job ${jobId}`);
    console.log(`    Deleted profiles: ${employerId}, ${worker1Id}, ${worker2Id}`);
    results.cleanup = { deleted: { employerId, worker1Id, worker2Id, jobId } };

    const remainingJobs = await sql1`select count(*)::int as cnt from public.jobs where title like 'TEST-concurrency%'`;
    const remainingProfiles = await sql1`select count(*)::int as cnt from public.profiles where full_name like 'TEST-concurrency%'`;
    console.log(`    Remaining TEST-concurrency jobs: ${remainingJobs[0].cnt}`);
    console.log(`    Remaining TEST-concurrency profiles: ${remainingProfiles[0].cnt}`);

    // ===== REPORT =====
    console.log("\n===== FINAL REPORT =====");
    console.log(`Database touched: ${STAGING_REF} (staging only)`);
    console.log(`Production (${PROD_REF}): never touched`);
    console.log(`No secrets printed.`);

    console.log("\nTest results table:");
    console.log("test | round | applications | new_notifications | errors | pass");
    for (const t of results.tests) {
      console.log(`${t.test.padEnd(4)} | ${String(t.round).padEnd(5)} | ${String(t.applications).padEnd(12)} | ${String(t.newNotifications).padEnd(19)} | ${String(t.errors.length).padEnd(6)} | ${t.pass}`);
    }

    const testA = results.tests.filter((t) => t.test === "A");
    const testB = results.tests.filter((t) => t.test === "B");
    const testC = results.tests.filter((t) => t.test === "C");
    const aPass = testA.every((t) => t.pass);
    const bPass = testB.every((t) => t.pass);
    const cPass = testC.every((t) => t.pass);

    console.log(`\nTest A (same worker, 2x simultaneous first application): ${aPass ? "PASS" : "FAIL"} (${testA.filter((t) => t.pass).length}/${testA.length} rounds passed)`);
    console.log(`Test B (withdrawn -> 2x simultaneous reapplication): ${bPass ? "PASS" : "FAIL"} (${testB.filter((t) => t.pass).length}/${testB.length} rounds passed)`);
    console.log(`Test C (2 different workers, same job): ${cPass ? "PASS" : "FAIL"}`);

    const failedRounds = results.tests.filter((t) => !t.pass);
    if (failedRounds.length > 0) {
      console.log("\nFailed rounds (full detail):");
      for (const f of failedRounds) {
        console.log(JSON.stringify(f, null, 2));
      }
    }

    console.log("\nFiles created: scripts/staging-concurrency-test/run-concurrency-test.mjs");

  } catch (e) {
    console.error("FATAL ERROR:", e.message);
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  } finally {
    await sql1.end().catch(() => {});
    await sql2.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("UNCAUGHT:", e.message);
  process.exit(1);
});
