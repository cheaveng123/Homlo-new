import type { Pool } from 'pg';
import { BOOST_PLANS, BoostPlanKey } from './02_boostConfig';

export interface ActivateBoostInput {
  paymentId: string | null;      // null only for free perks (e.g. Pro's monthly free boost)
  jobId: string;
  employerUserId: string;
  planKey: BoostPlanKey;
  pricePaidCents: number;
}

/**
 * Call this from the payment-succeeded handler (after webhook idempotency check).
 * Idempotent per paymentId. If the job already has a boost running, the new one is queued
 * right after it (the employer never loses time they paid for).
 */
export async function activateBoostForPayment(db: Pool, input: ActivateBoostInput) {
  const plan = BOOST_PLANS[input.planKey];
  if (!plan) throw new Error(`Unknown boost plan: ${input.planKey}`);

  const client = await db.connect();
  try {
    await client.query('begin');
    // serialize concurrent boosts on the same job and verify ownership + that it can be boosted
    const job = await client.query(
      `select id from public.jobs
        where id = $1 and user_id = $2 and status = 'open' and deleted_at is null
        for update`,
      [input.jobId, input.employerUserId],
    );
    if (job.rowCount === 0) throw new BoostError('JOB_NOT_BOOSTABLE', 'Job is closed, filled, or not yours.');

    const ins = await client.query(
      `with base as (
         select greatest(now(), coalesce(
           (select max(ends_at) from public.boosts
             where job_id = $1 and status in ('active','scheduled')), now())) as s
       )
       insert into public.boosts
         (job_id, employer_user_id, plan_key, price_paid_cents, duration_days, rank_multiplier,
          payment_id, status, starts_at, ends_at)
       select $1, $2, $3, $4, $5::int, $6, $7,
              case when base.s <= now() then 'active' else 'scheduled' end,
              base.s, base.s + make_interval(days => $5::int)
         from base
       on conflict (payment_id) where payment_id is not null do nothing
       returning id, status, starts_at, ends_at`,
      [input.jobId, input.employerUserId, input.planKey, input.pricePaidCents,
       plan.days, plan.rankMultiplier, input.paymentId],
    );
    await client.query('commit');

    await boostTick(db);   // sends "Your boost is live" immediately when it starts now
    return ins.rows[0] ?? null; // null = this payment was already processed
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export class BoostError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function boostTick(db: Pool) {
  const r = await db.query('select * from public.boost_tick()');
  return r.rows[0] as { activated: number; expired: number; notified_started: number; notified_ended: number };
}

/** Start once at server boot. Correctness never depends on it: feed queries also check ends_at. */
export function startBoostSweeper(db: Pool, everyMs = 60_000) {
  const run = () => boostTick(db).catch((e) => console.error('[boost sweeper]', e));
  run();
  const t = setInterval(run, everyMs);
  t.unref?.();
  return () => clearInterval(t);
}

export interface OwnerBoostState {
  serverNow: string;
  status: 'active' | 'scheduled' | 'none';
  startsAt: string | null;
  endsAt: string | null;
  planKey: string | null;
  queued: number;               // boosts waiting behind the active one
}

/** Employer-side view for the job management page and the Live tab. */
export async function getOwnerBoostState(db: Pool, jobId: string, employerUserId: string): Promise<OwnerBoostState> {
  const r = await db.query(
    `select now() as server_now, status, starts_at, ends_at, plan_key
       from public.boosts
      where job_id = $1 and employer_user_id = $2
        and ((status = 'active' and ends_at > now()) or status = 'scheduled')
      order by (status = 'active') desc, starts_at asc`,
    [jobId, employerUserId],
  );
  const now = (r.rows[0]?.server_now ?? new Date()).toISOString?.() ?? new Date().toISOString();
  const first = r.rows[0];
  return {
    serverNow: now,
    status: first ? first.status : 'none',
    startsAt: first ? first.starts_at.toISOString() : null,
    endsAt: first ? first.ends_at.toISOString() : null,
    planKey: first ? first.plan_key : null,
    queued: Math.max(0, r.rowCount! - 1),
  };
}
