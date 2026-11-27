/**
 * pangolin_sql_proof.ts
 * Run:  DATABASE_URL=postgres://user:pass@host:5432/db npx tsx --test pangolin_sql_proof.ts
 * USE A THROWAWAY DATABASE. It DROPS and recreates the public schema.
 *
 * Proves, against real PostgreSQL + PostGIS:
 *  - the migration applies, the eligibility view hides closed / deleted / filled jobs
 *  - event ingestion drops unknown/ineligible jobs and never fails the whole batch
 *  - refresh_job_stats matches the TypeScript decay math, dedupes spam, honours windows, retention, stale reset
 *  - PostGIS distances/radius filters are correct, remote jobs get no distance
 *  - the real feeds + router work end to end on top of it
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Opt-in Postgres proof run (needs `pg` installed separately); not part of the app build.
// eslint-disable-next-line import/no-unresolved
import pg from 'pg';
import { feedConfig, refreshConfigJson, refreshJobStatsSql } from './marmot_tuning_knobs';
import { createPostgresFeedStore } from './badger_postgres_store';
import { createFeedService } from './heron_feed_assembler';
import { createRouter } from './ibis_request_router';
import { decay } from './walrus_scoring_engine';

const url = process.env.DATABASE_URL ?? 'postgres://meng:meng@localhost:5432/homlo_test';
const client = new pg.Client({ connectionString: url });
const cfg = feedConfig;
const PP = { lat: 11.5564, lng: 104.9282 };

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const point = (lat: number, lng: number) => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

before(async () => {
  await client.connect();
  await client.query('drop schema public cascade; create schema public;');
  await client.query('create extension if not exists postgis;');
  // Stand-in for the app's real jobs table (the view in the migration is the adaptation point).
  await client.query(`
    create table jobs (
      id uuid primary key, employer_id uuid not null, category text, work_arrangement text, job_type text,
      pay_min numeric, pay_max numeric, pay_period text, created_at timestamptz not null default now(),
      positions_left int, location geography(Point,4326), status text not null, deleted_at timestamptz
    );`);
  await client.query(readFileSync(new URL('./quokka_ledger_schema.sql', import.meta.url), 'utf8'));

  const ins = async (n: number, o: Record<string, string | number | null>) =>
    client.query(
      `insert into jobs (id, employer_id, category, work_arrangement, job_type, pay_min, pay_max, pay_period, positions_left, location, status, deleted_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${o.loc ?? 'null'}, $10, ${o.deleted ?? 'null'}, now() - interval '3 days')`,
      [uuid(n), uuid(1000 + n), `cat${n}`, o.arr ?? 'on_site', o.type ?? 'part_time', o.pmin ?? 300, o.pmax ?? 400, 'monthly', o.left ?? 2, o.status ?? 'active'],
    );
  await ins(1, { loc: point(PP.lat + 0.1, PP.lng) });
  await ins(2, { loc: point(PP.lat + 0.01, PP.lng) });
  await ins(3, { arr: 'remote' });
  await ins(4, { status: 'closed', loc: point(PP.lat, PP.lng) });
  await ins(5, { deleted: 'now()', loc: point(PP.lat, PP.lng) });
  await ins(6, { left: 0, loc: point(PP.lat, PP.lng) });
  await ins(7, { loc: point(13.3633, 103.8564) }); // Siem Reap, ~230 km straight-line from Phnom Penh
  await ins(8, { arr: 'hybrid', loc: point(PP.lat + 0.03, PP.lng) });
});

after(async () => {
  await client.end();
});

const store = () => createPostgresFeedStore(client);

test('ingestion keeps only eligible jobs and never fails the batch', async () => {
  const s = store();
  const stored = await s.recordEvents('session-ignored', [
    { jobId: uuid(4), type: 'view' }, // closed
    { jobId: uuid(5), type: 'view' }, // deleted
    { jobId: uuid(6), type: 'view' }, // filled
    { jobId: uuid(999), type: 'view' }, // does not exist
  ]);
  assert.equal(stored, 0);
  assert.equal(await s.recordEvents('session-ignored', []), 0);
  const mixed = await s.recordEvents('session-mixed1', [
    { jobId: uuid(999), type: 'view' },
    { jobId: uuid(2), type: 'impression' },
  ]);
  assert.equal(mixed, 1);
  await client.query('truncate job_events');
});

test('refresh_job_stats matches the TypeScript math, dedupes spam, honours windows and retention', async () => {
  const s = store();
  const sessions = ['session-aaaa1', 'session-bbbb2', 'session-cccc3'];
  // Job 2: 3 sessions; spam inside a session must count once per (session, type, day).
  for (const sid of sessions) {
    await s.recordEvents(sid, [
      ...Array.from({ length: 5 }, () => ({ jobId: uuid(2), type: 'impression' as const })),
      { jobId: uuid(2), type: 'view' },
      { jobId: uuid(2), type: 'view' },
      { jobId: uuid(2), type: 'dwell_15s' },
    ]);
  }
  await s.recordEvents(sessions[0], [{ jobId: uuid(2), type: 'save' }]);
  await s.recordEvents(sessions[1], [{ jobId: uuid(2), type: 'apply' }]);
  // Job 8: one session hammering impressions.
  await s.recordEvents('session-spam001', Array.from({ length: 50 }, () => ({ jobId: uuid(8), type: 'impression' as const })));
  // Job 1: 10-day-old activity (month window only).
  await s.recordEvents(sessions[0], [{ jobId: uuid(1), type: 'impression' }, { jobId: uuid(1), type: 'view' }]);
  await s.recordEvents(sessions[1], [{ jobId: uuid(1), type: 'impression' }, { jobId: uuid(1), type: 'view' }]);

  await client.query(`update job_events set created_at = now() - interval '1 hour'`);
  await client.query(`update job_events set created_at = now() - interval '10 days' where job_id = $1`, [uuid(1)]);
  // Job 7: 35 days old (outside every window). Job 8: 100 days old (past retention, must be deleted).
  await client.query(`insert into job_events (job_id, event_type, session_id, created_at) values ($1,'view','session-old0001', now() - interval '35 days')`, [uuid(7)]);
  await client.query(`insert into job_events (job_id, event_type, session_id, created_at) values ($1,'view','session-old0002', now() - interval '100 days')`, [uuid(8)]);

  await client.query(refreshJobStatsSql(cfg)); // also proves the generated SQL string is valid

  const rows = (await client.query('select * from job_stats')).rows as Record<string, number | string>[];
  const by = (n: number) => rows.find((r) => r.job_id === uuid(n)) as Record<string, number>;

  const eWeights = 3 * (cfg.eventWeights.view + cfg.eventWeights.dwell_15s) + cfg.eventWeights.save + cfg.eventWeights.apply; // 21
  const age1h = 1 / 24;
  const near = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) <= Math.max(1e-3, Math.abs(b) * 5e-3), `${label}: got ${a}, expected ~${b}`);

  const j2 = by(2);
  near(j2.e_today, eWeights * decay(age1h, cfg.periods.today.halfLifeDays), 'job2 e_today');
  near(j2.i_today, 3 * decay(age1h, cfg.periods.today.halfLifeDays), 'job2 i_today');
  near(j2.e_week, eWeights * decay(age1h, cfg.periods.week.halfLifeDays), 'job2 e_week');
  near(j2.i_week, 3 * decay(age1h, cfg.periods.week.halfLifeDays), 'job2 i_week');
  near(j2.e_month, eWeights * decay(age1h, cfg.periods.month.halfLifeDays), 'job2 e_month');
  near(j2.i_month, 3 * decay(age1h, cfg.periods.month.halfLifeDays), 'job2 i_month');

  near(by(8).i_week, 1 * decay(age1h, cfg.periods.week.halfLifeDays), 'job8 spam counted once');

  const j1 = by(1);
  assert.equal(j1.e_today, 0);
  assert.equal(j1.e_week, 0);
  near(j1.e_month, 2 * cfg.eventWeights.view * decay(10, cfg.periods.month.halfLifeDays), 'job1 e_month (10 days old)');
  near(j1.i_month, 2 * decay(10, cfg.periods.month.halfLifeDays), 'job1 i_month');

  assert.equal(by(7), undefined, 'events outside every window leave no stats row');
  const old = await client.query(`select count(*)::int as n from job_events where created_at < now() - interval '90 days'`);
  assert.equal(old.rows[0].n, 0, 'retention deletes old raw events');

  for (const [col, period] of [['e_week', 'week'], ['i_month', 'month'], ['e_today', 'today']] as const) {
    const sum = rows.reduce((acc, r) => acc + (r[col] as number), 0);
    const g = (await client.query(`select ${col.startsWith('e') ? 'engagement' : 'impressions'} as v from job_stats_global where period = $1`, [period])).rows[0].v as number;
    near(g, sum, `global ${period} ${col}`);
  }
});

test('refresh is repeatable, works twice in one transaction, resets stale rows, and rejects incomplete config', async () => {
  await client.query('begin');
  await client.query(refreshJobStatsSql(cfg));
  await client.query(refreshJobStatsSql(cfg));
  await client.query('commit');

  await client.query(`insert into job_events (job_id, event_type, session_id, created_at) values ($1,'view','session-stale01', now() - interval '1 hour')`, [uuid(3)]);
  await client.query(refreshJobStatsSql(cfg));
  assert.equal((await client.query('select 1 from job_stats where job_id = $1', [uuid(3)])).rowCount, 1);
  await client.query('delete from job_events where job_id = $1', [uuid(3)]);
  await client.query(refreshJobStatsSql(cfg));
  assert.equal((await client.query('select 1 from job_stats where job_id = $1', [uuid(3)])).rowCount, 0, 'stale stats row removed');

  await assert.rejects(() => client.query(`select refresh_job_stats('{}'::jsonb)`), /incomplete config/);
  assert.equal(JSON.parse(refreshConfigJson(cfg)).periods.week.halfLifeDays, cfg.periods.week.halfLifeDays);
});

test('candidates: eligibility, PostGIS distance, radius, located-only, no-location viewer', async () => {
  const s = store();
  const all = await s.getCandidates({ viewer: PP, limit: 100 });
  assert.deepEqual(all.map((j) => j.id).sort(), [1, 2, 3, 7, 8].map(uuid).sort(), 'closed/deleted/filled jobs are hidden');

  const byId = (id: number) => all.find((j) => j.id === uuid(id))!;
  assert.ok(Math.abs((byId(2).distanceKm as number) - 1.112) < 0.05, `job2 ~1.1km, got ${byId(2).distanceKm}`);
  assert.ok(Math.abs((byId(1).distanceKm as number) - 11.12) < 0.1, `job1 ~11.1km, got ${byId(1).distanceKm}`);
  assert.ok((byId(7).distanceKm as number) > 215 && (byId(7).distanceKm as number) < 245, `job7 ~230km, got ${byId(7).distanceKm}`);
  assert.equal(byId(3).distanceKm, null, 'remote has no distance');

  // types the pure code depends on
  const j = byId(2);
  assert.ok(j.createdAt instanceof Date);
  for (const v of [j.agg.week.engagement, j.agg.month.impressions, j.positionsLeft as number, j.payMin as number]) assert.equal(typeof v, 'number');

  const within5 = await s.getCandidates({ viewer: PP, limit: 100, radiusKm: 5 });
  assert.deepEqual(within5.map((x) => x.id).sort(), [2, 8].map(uuid).sort());
  const located = await s.getCandidates({ viewer: PP, limit: 100, onlyLocated: true });
  assert.deepEqual(located.map((x) => x.id).sort(), [1, 2, 7, 8].map(uuid).sort());
  const limited = await s.getCandidates({ viewer: PP, limit: 2 });
  assert.equal(limited.length, 2);
  assert.equal(limited[0].id, uuid(2), 'highest-engagement job is kept first when the limit bites');

  const noLoc = await s.getCandidates({ viewer: { lat: null, lng: null }, limit: 100 });
  assert.equal(noLoc.length, 5);
  assert.ok(noLoc.every((x) => x.distanceKm === null));
  assert.equal((await s.getCandidates({ viewer: { lat: null, lng: null }, limit: 100, radiusKm: 10 })).length, 0);

  const g = await s.getGlobalRates();
  assert.ok(g.week.engagement > 0 && g.month.impressions > 0);
});

test('real feeds end to end: proven job first, far job damped, near ordered, home consistent', async () => {
  const svc = createFeedService(store(), cfg);
  const rec = await svc.recommended(PP);
  assert.equal(rec.items[0].jobId, uuid(2));
  assert.equal(rec.items[rec.items.length - 1].jobId, uuid(7), '~230 km away job is damped to the bottom');
  assert.ok(rec.items.every((i) => Number.isFinite(i.score)));

  const near = await svc.near(PP);
  assert.deepEqual(near.items.map((i) => i.jobId), [uuid(2), uuid(8), uuid(1)]);
  assert.ok(near.items.every((i) => i.distanceKm !== null && i.distanceKm < 60));
  assert.equal((await svc.near({ lat: null, lng: null })).status, 'no_location');

  const pop = await svc.popular(PP, { period: 'today' });
  assert.equal(pop.items[0].jobId, uuid(2));

  const home = await svc.home(PP);
  const eligible = new Set([1, 2, 3, 7, 8].map(uuid));
  for (const section of [home.recommended, home.popular, home.near, home.explore]) {
    assert.ok(section.items.every((i) => eligible.has(i.jobId)));
  }
  const withPrefs = await svc.recommended({ ...PP, preferences: { jobTypes: ['part_time'], payMin: 250, payMax: 450, payPeriod: 'monthly' } });
  assert.equal(withPrefs.items.find((i) => i.jobId === uuid(2))!.fitPercent, 98);

  const explore = await svc.explore(PP, { seed: 'sql-proof', limit: 50 });
  assert.equal(new Set(explore.items.map((i) => i.jobId)).size, explore.items.length);
});

test('router on top of the real store: events in, feeds out', async () => {
  const handle = createRouter(createFeedService(store(), cfg));
  const posted = await handle({
    method: 'POST',
    path: '/events',
    query: {},
    body: { sessionId: 'session-router01', events: [{ jobId: uuid(2), type: 'view' }, { jobId: uuid(5), type: 'view' }] },
  });
  assert.equal(posted.status, 202);
  assert.deepEqual(posted.body, { accepted: 1 });
  const home = await handle({ method: 'GET', path: '/feed/home', query: { lat: String(PP.lat), lng: String(PP.lng) } });
  assert.equal(home.status, 200);
  const page1 = (await handle({ method: 'GET', path: '/feed/explore', query: { limit: '2', seed: 'abc' } })).body as { nextCursor: string | null; items: unknown[] };
  assert.equal(page1.items.length, 2);
  assert.ok(page1.nextCursor);
  const page2 = await handle({ method: 'GET', path: '/feed/explore', query: { limit: '2', cursor: page1.nextCursor as string } });
  assert.equal(page2.status, 200);
});
