/**
 * badger_postgres_store.ts
 * The only file that runs SQL. Works with node-postgres (`pg` Pool/Client), Supabase's direct Postgres
 * connection, AWS RDS/Aurora, or anything exposing `query(text, params)`.
 * To leave Postgres one day, write another implementation of FeedStore. Nothing else changes.
 */
import {
  type ActiveJobBoost,
  type CandidateQuery,
  type EventInput,
  type FeedStore,
  type GlobalRates,
  type JobCandidate,
  type Period,
  type WindowAgg,
} from './finch_shared_shapes';

export interface SqlClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface ActiveBoostRow {
  job_id: string;
  package: string;
  rank_multiplier: number | string;
  start_at: Date;
  expires_at: Date;
  status: string;
}

interface CandidateRow {
  id: string;
  employer_id: string;
  category: string | null;
  work_arrangement: JobCandidate['workArrangement'];
  job_type: JobCandidate['jobType'];
  pay_min: number | null;
  pay_max: number | null;
  pay_period: JobCandidate['payPeriod'];
  created_at: Date;
  positions_left: number | null;
  employer_quality: number | null;
  distance_km: number | null;
  e_today: number;
  i_today: number;
  e_week: number;
  i_week: number;
  e_month: number;
  i_month: number;
}

// float8 comes back from node-postgres as number, timestamptz as Date, int4 as number. We never select
// bigint/numeric here because node-postgres returns those as strings.
const CANDIDATES_SQL = `
with pt as (
  select case when $1::float8 is not null and $2::float8 is not null
              then ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography end as g
)
select
  v.id, v.employer_id, v.category, v.work_arrangement, v.job_type,
  v.pay_min, v.pay_max, v.pay_period, v.created_at, v.positions_left, v.employer_quality,
  case when pt.g is null or v.location is null or v.work_arrangement = 'remote'
       then null
       else ST_Distance(v.location, pt.g) / 1000.0 end as distance_km,
  coalesce(s.e_today, 0) as e_today, coalesce(s.i_today, 0) as i_today,
  coalesce(s.e_week,  0) as e_week,  coalesce(s.i_week,  0) as i_week,
  coalesce(s.e_month, 0) as e_month, coalesce(s.i_month, 0) as i_month
from feed_eligible_jobs v
cross join pt
left join job_stats s on s.job_id = v.id
where ($4::boolean is not true
       or (pt.g is not null and v.location is not null and v.work_arrangement <> 'remote'))
  and ($5::float8 is null
       or (pt.g is not null and v.location is not null and v.work_arrangement <> 'remote'
           and ST_DWithin(v.location, pt.g, $5::float8 * 1000.0)))
order by coalesce(s.e_month, 0) desc, v.created_at desc, v.id
limit $3::int
`;

export function createPostgresFeedStore(db: SqlClient): FeedStore {
  return {
    async getCandidates(q: CandidateQuery): Promise<JobCandidate[]> {
      const radius = q.radiusKm ?? null;
      const onlyLocated = q.onlyLocated === true || radius !== null;
      const { rows } = await db.query<CandidateRow>(CANDIDATES_SQL, [
        q.viewer.lat,
        q.viewer.lng,
        q.limit,
        onlyLocated,
        radius,
      ]);
      return rows.map((r) => ({
        id: r.id,
        employerId: r.employer_id,
        category: r.category,
        workArrangement: r.work_arrangement,
        jobType: r.job_type,
        payMin: r.pay_min,
        payMax: r.pay_max,
        payPeriod: r.pay_period,
        createdAt: r.created_at,
        positionsLeft: r.positions_left,
        employerQuality: r.employer_quality,
        distanceKm: r.distance_km,
        agg: {
          today: { engagement: r.e_today, impressions: r.i_today },
          week: { engagement: r.e_week, impressions: r.i_week },
          month: { engagement: r.e_month, impressions: r.i_month },
        },
      }));
    },

    async getActiveBoosts(jobIds: readonly string[], now: Date): Promise<ActiveJobBoost[]> {
      if (jobIds.length === 0) return [];
      const { rows } = await db.query<ActiveBoostRow>(
        `select b.job_id, b.package, b.rank_multiplier, b.start_at, b.expires_at, b.status
           from public.boosts b
          where b.job_id = any($1::uuid[])
            and b.status = 'active'
            and b.start_at <= $2
            and b.expires_at > $2`,
        [jobIds, now],
      );
      return rows.map((r) => ({
        jobId: r.job_id,
        packageId: r.package,
        multiplier: Number(r.rank_multiplier),
        startsAt: r.start_at,
        endsAt: r.expires_at,
        status: r.status,
      }));
    },

    async getGlobalRates(): Promise<GlobalRates> {
      const { rows } = await db.query<{ period: Period; engagement: number; impressions: number }>(
        'select period, engagement, impressions from job_stats_global',
      );
      const empty = (): WindowAgg => ({ engagement: 0, impressions: 0 });
      const out: GlobalRates = { today: empty(), week: empty(), month: empty() };
      for (const r of rows) {
        if (r.period in out) out[r.period] = { engagement: r.engagement, impressions: r.impressions };
      }
      return out;
    },

    async recordEvents(sessionId: string, events: EventInput[]): Promise<number> {
      if (events.length === 0) return 0;
      // Joining the eligibility view drops events for unknown/closed jobs instead of failing the batch.
      const { rows } = await db.query<{ job_id: string }>(
        `insert into job_events_anon (job_id, event_type, session_id)
         select x.j, x.t, $3::text
         from unnest($1::uuid[], $2::text[]) as x(j, t)
         join feed_eligible_jobs v on v.id = x.j
         returning job_id`,
        [events.map((e) => e.jobId), events.map((e) => e.type), sessionId],
      );
      return rows.length;
    },
  };
}
