import { BOOST_PLANS, type BoostPlanKey } from './boostConfig';

export interface BoostQueryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface BoostDb extends BoostQueryable {
  transaction?<T>(fn: (tx: BoostQueryable) => Promise<T>): Promise<T>;
}

export interface ActivateBoostInput {
  /** null only for free perks (e.g. Pro's monthly free boost). */
  paymentId: string | null;
  jobId: string;
  employerUserId: string;
  planKey: BoostPlanKey;
  pricePaidCents: number;
}

export interface ActivatedBoost {
  id: string;
  status: 'active' | 'scheduled';
  start_at: Date | string;
  expires_at: Date | string;
}

export class BoostError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BoostError';
  }
}

async function withTransaction<T>(
  db: BoostDb,
  fn: (tx: BoostQueryable) => Promise<T>,
): Promise<T> {
  if (db.transaction) return db.transaction(fn);
  await db.query('begin');
  try {
    const result = await fn(db);
    await db.query('commit');
    return result;
  } catch (error) {
    await db.query('rollback').catch(() => undefined);
    throw error;
  }
}

/**
 * Idempotent per paymentId. If the job already has a boost running, the new one is queued
 * right after it (the employer never loses time they paid for).
 *
 * Use this variant when the caller already owns a transaction (e.g. the plan-boost
 * purchase path), so the insert commits atomically with the payment record.
 */
export async function activateBoostInTransaction(
  tx: BoostQueryable,
  input: ActivateBoostInput,
): Promise<ActivatedBoost | null> {
  const plan = BOOST_PLANS[input.planKey];
  if (!plan) throw new BoostError('UNKNOWN_PLAN', `Unknown boost plan: ${input.planKey}`);

  // Serialize concurrent boosts on the same job and verify ownership + that it can be boosted.
  const job = await tx.query<{ id: string }>(
    `select id from public.jobs
      where id = $1 and employer_id = $2 and status = 'open' and deleted_at is null
      for update`,
    [input.jobId, input.employerUserId],
  );
  if (job.rows.length === 0) {
    throw new BoostError('JOB_NOT_BOOSTABLE', 'Job is closed, filled, or not yours.');
  }

  const result = await tx.query<ActivatedBoost>(
    `with base as (
       select greatest(now(), coalesce(
         (select max(expires_at) from public.boosts
           where job_id = $1 and status in ('active','scheduled')), now())) as s
     )
     insert into public.boosts
       (job_id, employer_id, package, price_paid_cents, duration_days, rank_multiplier,
        payment_id, status, start_at, expires_at)
     select $1, $2, $3, $4, $5::int, $6, $7,
            case when base.s <= now() then 'active' else 'scheduled' end,
            base.s, base.s + make_interval(days => $5::int)
       from base
     on conflict (payment_id) where payment_id is not null do nothing
     returning id, status, start_at, expires_at`,
    [
      input.jobId,
      input.employerUserId,
      input.planKey,
      input.pricePaidCents,
      plan.days,
      plan.rankMultiplier,
      input.paymentId,
    ],
  );
  return result.rows[0] ?? null;
}

/**
 * Call this from the payment-succeeded handler (after webhook idempotency check).
 * If the job already has a boost running, the new one is queued right after it.
 */
export async function activateBoostForPayment(
  db: BoostDb,
  input: ActivateBoostInput,
): Promise<ActivatedBoost | null> {
  const inserted = await withTransaction(db, (tx) => activateBoostInTransaction(tx, input));

  // Sends "Your boost is live" immediately when it starts now.
  await boostTick(db);
  return inserted;
}

export interface BoostTickResult {
  activated: number;
  expired: number;
  notified_started: number;
  notified_ended: number;
}

export async function boostTick(db: BoostQueryable): Promise<BoostTickResult> {
  const result = await db.query<BoostTickResult>('select * from public.boost_tick()');
  return (
    result.rows[0] ?? {
      activated: 0,
      expired: 0,
      notified_started: 0,
      notified_ended: 0,
    }
  );
}

/** Start once at server boot. Correctness never depends on it: feed queries also check ends_at. */
export function startBoostSweeper(db: BoostQueryable, everyMs = 60_000): () => void {
  const run = () => boostTick(db).catch((error) => console.error('[boost sweeper]', error));
  run();
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export interface OwnerBoostState {
  serverNow: string;
  status: 'active' | 'scheduled' | 'none';
  startsAt: string | null;
  endsAt: string | null;
  planKey: string | null;
  /** Boosts waiting behind the active one. */
  queued: number;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Employer-side view for the job management page and the Live tab. */
export async function getOwnerBoostState(
  db: BoostQueryable,
  jobId: string,
  employerUserId: string,
): Promise<OwnerBoostState> {
  const result = await db.query<{
    server_now: Date | string;
    status: string;
    start_at: Date | string;
    expires_at: Date | string;
    package: string;
  }>(
    `select now() as server_now, status, start_at, expires_at, package
       from public.boosts
      where job_id = $1 and employer_id = $2
        and ((status = 'active' and expires_at > now()) or status = 'scheduled')
      order by (status = 'active') desc, start_at asc`,
    [jobId, employerUserId],
  );

  const now = toIso(result.rows[0]?.server_now) ?? new Date().toISOString();
  const first = result.rows[0];
  return {
    serverNow: now,
    status: first ? (first.status === 'active' ? 'active' : 'scheduled') : 'none',
    startsAt: first ? toIso(first.start_at) : null,
    endsAt: first ? toIso(first.expires_at) : null,
    planKey: first ? first.package : null,
    queued: Math.max(0, result.rows.length - 1),
  };
}

/**
 * Employer cancels a job's boost: the running boost and any boosts queued
 * after it stop immediately. Only boosts owned by `employerUserId` are touched,
 * so the job id alone can never cancel someone else's boost. The matching
 * purchase-ledger rows (job_boosts) are cancelled too, which also frees the
 * job to be boosted again. Store purchases are not refunded here.
 */
export async function cancelOwnerBoosts(
  db: BoostQueryable,
  jobId: string,
  employerUserId: string,
): Promise<{ cancelled: number }> {
  const result = await db.query<{ id: string }>(
    `update public.boosts
        set status = 'cancelled', updated_at = now()
      where job_id = $1 and employer_id = $2
        and status in ('active', 'scheduled')
      returning id`,
    [jobId, employerUserId],
  );
  if (result.rows.length === 0) return { cancelled: 0 };

  await db.query(
    `update public.job_boosts
        set status = 'cancelled', updated_at = now()
      where job_id = $1 and employer_id = $2
        and status in ('pending', 'active')`,
    [jobId, employerUserId],
  );
  return { cancelled: result.rows.length };
}
