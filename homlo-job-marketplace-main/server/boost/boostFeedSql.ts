// Drop-in fragments for the existing feed + employer-list queries (alias the jobs table as `j`).
export const BOOST_JOIN_SQL = `
  left join lateral (
    select b.id, b.start_at, b.expires_at, b.rank_multiplier
      from public.boosts b
     where b.job_id = j.id and b.status = 'active'
       and b.start_at <= now() and b.expires_at > now()
     order by b.rank_multiplier desc
     limit 1
  ) ab on true`;

export const BOOST_SELECT_SQL = `
  (ab.id is not null)            as is_boosted,
  ab.start_at                    as boost_starts_at,
  ab.expires_at                  as boost_ends_at,
  coalesce(ab.rank_multiplier, 1.0)::float8 as boost_multiplier,
  now()                          as server_now`;

/** Job seekers get ONLY the ad flag: never price, plan, or end time. */
export const feedBoost = (row: any) => (row.is_boosted ? { isSponsored: true } : null);

/** Employer dashboards get the full timing. */
export const ownerBoost = (row: any) =>
  row.is_boosted
    ? {
        status: 'active' as const,
        startsAt: new Date(row.boost_starts_at).toISOString(),
        endsAt: new Date(row.boost_ends_at).toISOString(),
        serverNow: new Date(row.server_now).toISOString(),
      }
    : null;
