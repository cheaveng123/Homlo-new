-- =========================================================
-- 055_user_age.sql
-- Remembers the age a person gives right after signing up.
--
-- The age lives on `users` (not `profiles`) because the canonical
-- user row exists from the moment of sign-up, while the profile row
-- is only created later on the "complete profile" step and requires
-- a role and full name.
--
-- `age_recorded_at` is kept next to `age` so the current age can be
-- estimated later as age + whole years since it was recorded.
--
-- Both RPCs are service-role only, like the rest of the direct
-- gateway: the actor id is passed explicitly by the gateway after
-- it has verified the caller's session.
-- =========================================================

alter table users add column if not exists age smallint;
alter table users add column if not exists age_recorded_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_age_range') then
    alter table users add constraint users_age_range check (age is null or age between 16 and 80);
  end if;
end;
$$;

create or replace function public.homlo_set_user_age(p_user_id uuid, p_age integer)
returns table (age smallint, age_recorded_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_age smallint;
  v_recorded_at timestamptz;
begin
  if p_age is null or p_age < 16 or p_age > 80 then
    raise exception 'Age must be between 16 and 80';
  end if;

  update users u
     set age = p_age::smallint,
         age_recorded_at = now()
   where u.id = p_user_id
     and u.deleted_at is null
     and u.status = 'active'
  returning u.age, u.age_recorded_at into v_age, v_recorded_at;

  if not found then
    raise exception 'Active canonical user not found';
  end if;

  return query select v_age, v_recorded_at;
end;
$$;

create or replace function public.homlo_get_user_age(p_user_id uuid)
returns table (age smallint, age_recorded_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select u.age, u.age_recorded_at
    from users u
   where u.id = p_user_id and u.deleted_at is null;
$$;

revoke all on function public.homlo_set_user_age(uuid, integer) from public, anon, authenticated;
revoke all on function public.homlo_get_user_age(uuid) from public, anon, authenticated;
grant execute on function public.homlo_set_user_age(uuid, integer) to service_role;
grant execute on function public.homlo_get_user_age(uuid) to service_role;
