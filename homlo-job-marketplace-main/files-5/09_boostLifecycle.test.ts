import { Pool } from 'pg';
import { randomUUID as uuid } from 'crypto';
import { activateBoostForPayment, boostTick, getOwnerBoostState } from './03_boostService';
import { applyBoost } from './02_boostConfig';
import { BOOST_JOIN_SQL, BOOST_SELECT_SQL, feedBoost, ownerBoost } from './04_boostFeedSql';
import assert from 'assert';

const db = new Pool({ host: '127.0.0.1', user: 'postgres', password: 'pw', database: 'boosttest' });
const q = (s: string, p: any[] = []) => db.query(s, p).then(r => r.rows);

(async () => {
  const owner = uuid(), jobId = uuid();
  await q(`insert into jobs(id,user_id,title) values($1,$2,'Barista')`, [jobId, owner]);

  // 1. first boost starts immediately
  const b1 = await activateBoostForPayment(db, { paymentId: uuid(), jobId, employerUserId: owner, planKey: 'standard', pricePaidCents: 999 });
  assert.equal(b1.status, 'active');
  let n = await q(`select type from notifications where user_id=$1`, [owner]);
  assert.deepEqual(n.map(x => x.type), ['boost_started']);
  console.log('1 ok: active + "boost_started" sent');

  // 2. webhook retry with same payment is a no-op
  const pay2 = uuid();
  const b2 = await activateBoostForPayment(db, { paymentId: pay2, jobId, employerUserId: owner, planKey: 'starter', pricePaidCents: 299 });
  assert.equal(b2.status, 'scheduled');
  assert.equal(new Date(b2.starts_at).getTime(), new Date(b1.ends_at).getTime());
  const dup = await activateBoostForPayment(db, { paymentId: pay2, jobId, employerUserId: owner, planKey: 'starter', pricePaidCents: 299 });
  assert.equal(dup, null);
  assert.equal((await q(`select count(*)::int c from boosts`))[0].c, 2);
  console.log('2 ok: second boost queued after first; retry is idempotent');

  // 3. feed fragments: seeker sees only the ad flag, owner sees timing
  const rows = await q(`select j.id, ${BOOST_SELECT_SQL} from jobs j ${BOOST_JOIN_SQL} where j.id=$1`, [jobId]);
  assert.deepEqual(feedBoost(rows[0]), { isSponsored: true });
  assert.ok(ownerBoost(rows[0])!.endsAt);
  const st = await getOwnerBoostState(db, jobId, owner);
  assert.equal(st.status, 'active'); assert.equal(st.queued, 1);
  console.log('3 ok: feed/owner serialization + owner state');

  // 4. time passes: first boost ends, queued one starts, both notified exactly once
  await q(`update boosts set starts_at=starts_at-interval '8 days', ends_at=ends_at-interval '8 days' where id=$1`, [b1.id]);
  await q(`update boosts set starts_at=now()-interval '1 second', ends_at=now()+interval '3 days' where id=$1`, [b2.id]);
  const t1 = await boostTick(db);
  const t2 = await boostTick(db);
  n = await q(`select type from notifications where user_id=$1 order by created_at, type`, [owner]);
  const types = n.map(x => x.type).sort();
  assert.deepEqual(types, ['boost_ended', 'boost_started', 'boost_started']);
  assert.equal(t2.notified_started + t2.notified_ended, 0);
  const s = await q(`select status from boosts order by created_at`);
  assert.deepEqual(s.map(x => x.status), ['expired', 'active']);
  console.log('4 ok: expire + promote queued + notifications exactly once', t1);

  // 5. expired boost disappears from the feed even if the sweeper never ran
  await q(`update boosts set ends_at=now()-interval '1 second', starts_at=now()-interval '2 days' where status='active'`);
  const lazy = await q(`select ${BOOST_SELECT_SQL} from jobs j ${BOOST_JOIN_SQL} where j.id=$1`, [jobId]);
  assert.equal(feedBoost(lazy[0]), null);
  await boostTick(db);
  assert.equal((await q(`select count(*)::int c from notifications where type='boost_ended'`))[0].c, 2);
  console.log('5 ok: no stale "Ad" badge between sweeps; ended notice sent');

  // 6. closed job cannot be boosted
  const closed = uuid();
  await q(`insert into jobs(id,user_id,title,status) values($1,$2,'Closed','closed')`, [closed, owner]);
  await assert.rejects(activateBoostForPayment(db, { paymentId: uuid(), jobId: closed, employerUserId: owner, planKey: 'local', pricePaidCents: 699 }), /not boostable|closed/i);
  await assert.rejects(activateBoostForPayment(db, { paymentId: uuid(), jobId, employerUserId: uuid(), planKey: 'local', pricePaidCents: 699 }));
  console.log('6 ok: closed / not-owned job rejected');

  // 7. rank math stays within the cap and is quality gated
  assert.ok(Math.abs(applyBoost(100, 1.15, 1) - 115) < 1e-9);
  assert.ok(Math.abs(applyBoost(100, 9, 1) - 115) < 1e-9);
  assert.equal(applyBoost(100, 1.15, 0), 100);
  console.log('7 ok: multiplier capped at 1.15, quality-gated');
  await db.end();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
