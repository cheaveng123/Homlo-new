-- =========================================================
-- 057_trust_safety.sql
-- Legal consent, account verification, listing safety, reporting,
-- moderation, appeals, payment guards and data retention.
--
-- Design rule: anything that must hold "server-side" is enforced HERE,
-- in triggers on the tables themselves, so it holds for every write
-- path (the Express/tRPC server AND the homlo-service-gateway edge
-- function, which a client could call directly with its own token).
--
-- Every limit is a row in trust_settings, so it can be changed without
-- a deploy:  update trust_settings set value = '5' where key = '...';
--
-- Prepared locally for review. Take a database backup before applying.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Settings (all configurable limits live here)
-- ---------------------------------------------------------
create table if not exists trust_settings (
  key         text primary key,
  value       text,            -- null = feature switched off (e.g. no spend cap yet)
  description text not null,
  updated_at  timestamptz not null default now()
);

insert into trust_settings (key, value, description) values
  ('terms_version',               '1.0', 'Current Terms of Service version. Bump together with legal/terms.md.'),
  ('privacy_version',             '1.0', 'Current Privacy Policy version. Bump together with legal/privacy.md.'),
  ('new_account_days',            '7',   'How many days an account counts as "new".'),
  ('new_account_max_listings',    '3',   'Max listings a new account may submit during its first new_account_days.'),
  ('listing_expiry_days',         '30',  'Listings expire this many days after they go live.'),
  ('new_account_spend_cap_cents', null,  'Max total spend (cents, USD) for an account in its first new_account_days. NULL = no cap. OWNER DECISION ([$X]).'),
  ('posting_consent_window_minutes', '30', 'A job-posting consent row must be this recent when the listing is submitted.'),
  ('payment_consent_window_minutes', '30', 'A payment-terms consent row must be this recent when a payment is created.'),
  ('closed_account_purge_days',   '90',  'Closed accounts are fully anonymized this many days after closure.'),
  ('inactive_account_months',     '24',  'Accounts inactive this long are deleted (after a warning).'),
  ('inactive_warning_days',       '30',  'Warning email is sent this many days before inactive deletion.'),
  ('consent_retention_years',     '5',   'Consent logs are kept this long. Privacy policy says [2 to 5] years: OWNER DECISION.'),
  ('moderation_retention_years',  '5',   'Moderation records are kept this long. OWNER DECISION.'),
  ('renewal_reminder_days',       '3',   'Renewal reminder email is sent this many days before a subscription renews.'),
  ('appeal_window_days',          '14',  'Removed users may appeal within this many days (Terms section 9: [14]).')
on conflict (key) do nothing;

create or replace function trust_setting_int(p_key text)
returns integer language sql stable as $$
  select nullif(value, '')::integer from trust_settings where key = p_key;
$$;

create or replace function trust_setting_text(p_key text)
returns text language sql stable as $$
  select value from trust_settings where key = p_key;
$$;

-- ---------------------------------------------------------
-- 2. Users: verification, marketing, activity, closure
-- ---------------------------------------------------------
alter table users add column if not exists email_verified_at          timestamptz;
alter table users add column if not exists phone_verified_at          timestamptz;
alter table users add column if not exists phone_hash                 text;  -- HMAC of the verified E.164 number (ban matching)
alter table users add column if not exists marketing_opt_in           boolean not null default false;
alter table users add column if not exists last_active_at             timestamptz;
alter table users add column if not exists closed_at                  timestamptz;
alter table users add column if not exists anonymized_at              timestamptz;
alter table users add column if not exists inactivity_warning_sent_at timestamptz;
alter table users add column if not exists warning_count              integer not null default 0;

-- Platform administrators (moderators). Granted by hand:
--   insert into admin_users (user_id) values ('<users.id>');
create table if not exists admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function homlo_is_admin(p_user_id uuid)
returns boolean language sql stable as $$
  select exists (select 1 from admin_users where user_id = p_user_id);
$$;

-- The login email lives in Supabase Auth, linked via user_identities.
create or replace function homlo_user_email(p_user_id uuid)
returns text language sql stable security definer set search_path = public, auth, pg_temp as $$
  select au.email::text
    from user_identities ui
    join auth.users au on au.id::text = ui.provider_user_id
   where ui.user_id = p_user_id and ui.provider = 'supabase' and ui.deleted_at is null
   limit 1;
$$;

-- ---------------------------------------------------------
-- 3. Consent log (append-only)
-- ---------------------------------------------------------
create table if not exists consent_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete restrict,
  consent_type    text not null check (consent_type in (
                    'signup',            -- 18+ and Terms + Privacy
                    'job_posting',       -- per listing, every submission
                    'payment_terms',     -- checkout for boosts / subscriptions
                    'marketing_opt_in',  -- optional email marketing: granted
                    'marketing_opt_out'  -- optional email marketing: withdrawn
                  )),
  terms_version   text not null,
  privacy_version text not null,
  created_at      timestamptz not null default now(),   -- stored in UTC
  ip_address      text,          -- encrypted by the app server (enc:v1:...) when FIELD_ENCRYPTION_KEY is set
  user_agent      text,          -- encrypted the same way
  listing_id      uuid,          -- job_posting (and the boosted job for payment_terms). No FK: the record must outlive a deleted draft.
  metadata        jsonb          -- e.g. product, amount and listing title for payment_terms (chargeback evidence)
);

create index if not exists idx_consent_log_user on consent_log (user_id, consent_type, created_at desc);
create index if not exists idx_consent_log_listing on consent_log (listing_id) where listing_id is not null;

-- Append-only at the database level. UPDATE is always refused. DELETE is
-- refused unless the retention job opts in for rows past the retention
-- period (homlo_run_retention sets homlo.retention_purge = 'on').
create or replace function consent_log_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consent_log is append-only';
  end if;
  if coalesce(current_setting('homlo.retention_purge', true), '') <> 'on'
     or old.created_at > now() - make_interval(years => coalesce(trust_setting_int('consent_retention_years'), 5)) then
    raise exception 'consent_log rows cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_consent_log_guard on consent_log;
create trigger trg_consent_log_guard
  before update or delete on consent_log
  for each row execute function consent_log_guard();

-- TRUNCATE bypasses row triggers, so revoke it (and UPDATE/DELETE) outright.
revoke update, delete, truncate on consent_log from public, anon, authenticated;

create or replace function homlo_has_current_signup_consent(p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from consent_log
     where user_id = p_user_id and consent_type = 'signup'
       and terms_version = trust_setting_text('terms_version')
       and privacy_version = trust_setting_text('privacy_version')
  );
$$;

-- ---------------------------------------------------------
-- 4. Verification codes (email link + SMS code), devices, bans
-- ---------------------------------------------------------
create table if not exists verification_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  channel     text not null check (channel in ('email', 'sms')),
  target_hash text not null,        -- HMAC of the email / phone it was sent to
  code_hash   text not null,        -- SHA-256 of the token / code, never the raw value
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_verification_codes_user on verification_codes (user_id, channel, created_at desc);

-- Device / network signals seen per account (hashed, never raw).
create table if not exists user_devices (
  user_id      uuid not null references users(id) on delete cascade,
  device_hash  text not null default '',
  ip_hash      text not null default '',
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (user_id, device_hash, ip_hash)
);

-- Identifiers of banned accounts, used to block re-registration.
-- 'email' and 'phone' and 'device' block sign-up. 'ip' only flags
-- (shared networks make IP blocking unreliable and possibly unlawful).
create table if not exists banned_identifiers (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('email', 'phone', 'device', 'ip')),
  value_hash  text not null,
  user_id     uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (kind, value_hash)
);

-- ---------------------------------------------------------
-- 5. Listings: required fields, safety rules, review, expiry
-- ---------------------------------------------------------
alter table jobs add column if not exists employer_name      text;
alter table jobs add column if not exists contact_method     text;
alter table jobs add column if not exists contact_value      text;
alter table jobs add column if not exists expires_at         timestamptz;
alter table jobs add column if not exists first_submitted_at timestamptz;
alter table jobs add column if not exists moderation_status  text not null default 'none';
alter table jobs add column if not exists moderation_reasons text[] not null default '{}';
alter table jobs add column if not exists approved_text_hash text;

do $$
declare v_name text;
begin
  -- Widen the job status list with 'pending_review' and 'removed'. Every public
  -- feed already filters on status = 'open', so these stay hidden automatically.
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.jobs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%draft%open%'
  loop
    execute format('alter table jobs drop constraint %I', v_name);
  end loop;
  alter table jobs add constraint jobs_status_check check (status in
    ('draft', 'open', 'filled', 'closed', 'expired', 'cancelled', 'pending_review', 'removed'));

  if not exists (select 1 from pg_constraint where conname = 'jobs_contact_method_check') then
    alter table jobs add constraint jobs_contact_method_check
      check (contact_method is null or contact_method in ('in_app', 'email', 'phone'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_moderation_status_check') then
    alter table jobs add constraint jobs_moderation_status_check
      check (moderation_status in ('none', 'pending_review', 'approved', 'removed'));
  end if;
end;
$$;

-- Listings that went live before this migration count as already submitted
-- (for the new-account cap and the "first listing is reviewed" rule).
-- Runs before the gate trigger exists, so it does not fire it.
update jobs set first_submitted_at = coalesce(published_at, created_at)
 where first_submitted_at is null and status <> 'draft';

create index if not exists idx_jobs_expires on jobs (expires_at) where status = 'open' and deleted_at is null;
create index if not exists idx_jobs_review on jobs (first_submitted_at) where status = 'pending_review';

-- Word lists for the listing filter. Patterns are case-insensitive POSIX
-- regexes. Admins can add rows without a deploy.
--   block_discrimination : listing is refused, poster must edit
--   minor_target         : combined with hazardous_adult -> refused
--   hazardous_adult      : combined with minor_target -> refused
--   scam                 : listing goes to the manual review queue
create table if not exists listing_safety_rules (
  id       serial primary key,
  kind     text not null check (kind in ('block_discrimination', 'minor_target', 'hazardous_adult', 'scam')),
  pattern  text not null,
  label    text not null,
  unique (kind, pattern)
);

insert into listing_safety_rules (kind, pattern, label) values
  ('scam', 'registration fee', 'registration fee'),
  ('scam', '(application|training|processing|joining|starter|security) (fee|deposit)', 'fee or deposit from applicants'),
  ('scam', 'send (us |me )?(money|payment|cash)', 'send money'),
  ('scam', 'wire transfer', 'wire transfer'),
  ('scam', 'western union|moneygram', 'money transfer service'),
  ('scam', 'guaranteed (income|earnings|profit|salary)', 'guaranteed income'),
  ('scam', 'gift ?cards?', 'gift card payment'),
  ('scam', '\m(bitcoin|btc|ethereum|eth|usdt|tether|crypto(currency)?|binance)\M', 'crypto payment'),
  ('scam', 'bank (details|account (number|details)|login)', 'bank details request'),
  ('scam', '(your )?password', 'password request'),
  ('scam', 'pay (to|before) (start|apply|join|work)', 'pay to start'),
  ('scam', 'get rich|work from home and earn \$|unlimited earning', 'get-rich-quick wording'),
  ('block_discrimination', '\m(males?|men|man) only\M|\monly (males?|men)\M', 'gender restriction'),
  ('block_discrimination', '\m(females?|women|woman|ladies|girls) only\M|\monly (females?|women|ladies|girls)\M', 'gender restriction'),
  ('block_discrimination', '\m(no|not) (women|men|females|males|ladies)\M', 'gender restriction'),
  ('block_discrimination', '(age|aged) (under|below|less than) [0-9]{2}|\munder [0-9]{2} (only|years)\M|\mmax(imum)? age\M', 'age restriction'),
  ('block_discrimination', '\m(young|younger) (people|applicants|candidates) only\M|\mno (older|old) (people|applicants)\M', 'age restriction'),
  ('block_discrimination', '\m(white|black|asian|chinese|khmer|vietnamese|indian|african|european) (people|applicants|candidates|staff|workers) only\M', 'race or nationality restriction'),
  ('block_discrimination', '\m(christians?|muslims?|buddhists?|hindus?|jews?|jewish|catholics?) only\M|\mno (christians?|muslims?|buddhists?|hindus?|jews)\M', 'religion restriction'),
  ('minor_target', '\m(minors?|under ?18s?|under-18s?|underage|teens?|teenagers?|school ?(kids|children|students))\M ?(welcome|wanted|accepted|can apply|ok|okay|only|preferred)', 'targets people under 18'),
  ('minor_target', '\m(aged?|ages) ?1[0-7]\M|\m1[0-7][ -]?(years?[ -]?old|yo)\M', 'targets people under 18'),
  ('hazardous_adult', '\m(adult|escort|massage parlou?r|strip|nightclub|bar ?girl|hostess|casino|alcohol|bar ?work)\M', 'adult work'),
  ('hazardous_adult', '\m(construction|demolition|mining|chemicals?|pesticides?|heavy machinery|scaffold(ing)?|welding|explosives?)\M', 'hazardous work')
on conflict (kind, pattern) do nothing;

-- Checks listing text and returns the problems found (empty = clean).
-- Used by the trigger below AND by the app's live pre-check, so both
-- always agree.
create or replace function homlo_check_listing_text(p_text text)
returns table (kind text, label text)
language sql stable as $$
  with t as (select lower(coalesce(p_text, '')) as body),
  hits as (
    select distinct r.kind, r.label
      from listing_safety_rules r, t
     where t.body ~* r.pattern
  )
  select h.kind, h.label from hits h
   where h.kind in ('scam', 'block_discrimination')
  union all
  -- A minor-targeting phrase is only a problem next to adult/hazardous work.
  select 'minor_hazardous', 'work for minors in hazardous or adult jobs'
   where exists (select 1 from hits where kind = 'minor_target')
     and exists (select 1 from hits where kind = 'hazardous_adult');
$$;

create or replace function homlo_listing_text(j jobs)
returns text language sql stable as $$
  select concat_ws(' ', j.title, j.description, j.requirements::text);
$$;

-- The gate every listing passes when it is submitted (draft -> live) or
-- edited while live. Raises a user-readable error (SQLSTATE P0001) when a
-- rule is broken; diverts to the review queue when it is suspicious.
create or replace function jobs_trust_safety_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user         users%rowtype;
  v_submitting   boolean;
  v_live_edit    boolean;
  v_text_changed boolean;
  v_new_days     integer := coalesce(trust_setting_int('new_account_days'), 7);
  v_max_new      integer := coalesce(trust_setting_int('new_account_max_listings'), 3);
  v_window       integer := coalesce(trust_setting_int('posting_consent_window_minutes'), 30);
  v_submitted    integer;
  v_blocks       text;
  v_flags        text[] := '{}';
  v_hash         text;
  v_profile_name text;
begin
  -- Admin moderation actions run with this flag and skip the gate.
  if coalesce(current_setting('homlo.moderation_action', true), '') = 'on' then
    return new;
  end if;

  v_submitting := new.status in ('open', 'pending_review')
                  and (tg_op = 'INSERT' or old.status not in ('open', 'pending_review'));
  v_live_edit  := tg_op = 'UPDATE' and old.status in ('open', 'pending_review')
                  and new.status in ('open', 'pending_review');
  v_text_changed := tg_op = 'INSERT' or homlo_listing_text(new) is distinct from homlo_listing_text(old);

  if tg_op = 'UPDATE' and old.status = 'removed' and new.status in ('open', 'pending_review', 'draft', 'filled') then
    raise exception 'This listing was removed by moderators and cannot be republished. You can appeal the decision.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'pending_review' and new.status = 'open' then
    new.status := 'pending_review';   -- only a moderator can release a listing from review
  end if;

  if not v_submitting and not (v_live_edit and v_text_changed) then
    return new;
  end if;

  v_hash := md5(homlo_listing_text(new));

  -- Text rules apply to every submission and every live edit.
  select string_agg(distinct label, ', ') into v_blocks
    from homlo_check_listing_text(homlo_listing_text(new))
   where kind in ('block_discrimination', 'minor_hazardous');
  if v_blocks is not null then
    raise exception 'Please edit your listing. It contains wording we cannot publish: %. Listings must not discriminate by age, gender, race or religion, or recruit minors for hazardous or adult work.', v_blocks;
  end if;

  select coalesce(array_agg(distinct 'scam: ' || label), '{}') into v_flags
    from homlo_check_listing_text(homlo_listing_text(new))
   where kind = 'scam';

  if v_submitting then
    select * into v_user from users where id = new.employer_id;
    if not found or v_user.deleted_at is not null or v_user.status <> 'active' then
      raise exception 'This account cannot post jobs.';
    end if;
    if v_user.email_verified_at is null then
      raise exception 'Confirm your email address before posting a job.';
    end if;
    if v_user.phone_verified_at is null then
      raise exception 'Verify your phone number before posting your first job.';
    end if;
    if not homlo_has_current_signup_consent(new.employer_id) then
      raise exception 'Please accept the current Terms of Service and Privacy Policy before posting.';
    end if;
    if not exists (
      select 1 from consent_log
       where user_id = new.employer_id and consent_type = 'job_posting'
         and listing_id = new.id
         and created_at > now() - make_interval(mins => v_window)
    ) then
      raise exception 'Confirm the job posting declaration before submitting this listing.';
    end if;

    -- Required fields.
    if coalesce(trim(new.employer_name), '') = '' then
      select full_name into v_profile_name from profiles where user_id = new.employer_id and deleted_at is null;
      new.employer_name := nullif(trim(coalesce(v_profile_name, '')), '');
    end if;
    if new.employer_name is null then
      raise exception 'Add the employer name before posting.';
    end if;
    if coalesce(trim(new.location_text), '') = '' and coalesce(trim(new.city), '') = '' then
      raise exception 'Add the job location before posting.';
    end if;
    if new.pay_type is null or trim(new.pay_type) = '' then
      raise exception 'Choose a pay type before posting.';
    end if;
    if new.contact_method is null then
      raise exception 'Choose how applicants should contact you before posting.';
    end if;
    if new.contact_method in ('email', 'phone') and coalesce(trim(new.contact_value), '') = '' then
      raise exception 'Add the % applicants should use to contact you.', new.contact_method;
    end if;

    -- New-account listing cap (counts every listing ever submitted, even deleted ones).
    if new.first_submitted_at is null and v_user.created_at > now() - make_interval(days => v_new_days) then
      select count(*) into v_submitted from jobs
       where employer_id = new.employer_id and first_submitted_at is not null and id <> new.id;
      if v_submitted >= v_max_new then
        raise exception 'New accounts can post up to % listings in their first % days.', v_max_new, v_new_days;
      end if;
    end if;

    -- The first listing of every account is reviewed by a person.
    if not exists (
      select 1 from jobs
       where employer_id = new.employer_id and first_submitted_at is not null and id <> new.id
    ) then
      v_flags := array_append(v_flags, 'first listing from this account');
    end if;

    new.first_submitted_at := coalesce(new.first_submitted_at, now());
  end if;

  -- Editing a listing that is waiting for review keeps it in review.
  if tg_op = 'UPDATE' and old.status = 'pending_review' then
    v_flags := array(select distinct unnest(array_cat(old.moderation_reasons, v_flags)));
    if cardinality(v_flags) = 0 then v_flags := array['waiting for review']; end if;
  end if;

  -- A moderator-approved text that has not changed skips the review queue again.
  if new.moderation_status = 'approved' and new.approved_text_hash = v_hash then
    v_flags := '{}';
  end if;

  if cardinality(v_flags) > 0 then
    new.status := 'pending_review';
    new.moderation_status := 'pending_review';
    new.moderation_reasons := v_flags;
  elsif new.status in ('open', 'pending_review') then
    new.status := 'open';
    if new.moderation_status = 'pending_review' then new.moderation_status := 'none'; end if;
    new.moderation_reasons := '{}';
  end if;

  if new.status = 'open' and v_submitting then
    new.expires_at := now() + make_interval(days => coalesce(trust_setting_int('listing_expiry_days'), 30));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_trust_safety_gate on jobs;
create trigger trg_jobs_trust_safety_gate
  before insert or update on jobs
  for each row execute function jobs_trust_safety_gate();

-- ---------------------------------------------------------
-- 6. Reports, moderation actions, snapshots, appeals
-- ---------------------------------------------------------
alter table reports add column if not exists category text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_category_check') then
    alter table reports add constraint reports_category_check
      check (category is null or category in ('scam', 'underage_user', 'discrimination', 'illegal', 'other'));
  end if;
end;
$$;

-- Append-only log of every moderator decision: who, what, when, why.
create table if not exists moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references users(id) on delete restrict,
  action      text not null check (action in ('approve', 'remove', 'warn', 'suspend', 'ban', 'reinstate', 'dismiss_report', 'appeal_upheld', 'appeal_rejected')),
  target_type text not null check (target_type in ('job', 'user', 'report', 'appeal')),
  target_id   uuid not null,
  report_id   uuid references reports(id) on delete set null,
  reason      text not null check (length(trim(reason)) > 0),
  snapshot    jsonb,          -- full listing / profile content at the time of removal
  created_at  timestamptz not null default now()
);
create index if not exists idx_moderation_actions_target on moderation_actions (target_type, target_id, created_at desc);

create or replace function moderation_actions_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception 'moderation_actions is append-only'; end if;
  if coalesce(current_setting('homlo.retention_purge', true), '') <> 'on'
     or old.created_at > now() - make_interval(years => coalesce(trust_setting_int('moderation_retention_years'), 5)) then
    raise exception 'moderation_actions rows cannot be deleted';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_moderation_actions_guard on moderation_actions;
create trigger trg_moderation_actions_guard
  before update or delete on moderation_actions
  for each row execute function moderation_actions_guard();
revoke update, delete, truncate on moderation_actions from public, anon, authenticated;

create table if not exists appeals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,  -- null when the account can no longer sign in
  contact_email text not null,
  target_type  text not null check (target_type in ('job', 'account')),
  target_id    uuid,
  message      text not null check (length(message) between 10 and 4000),
  status       text not null default 'open' check (status in ('open', 'upheld', 'rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index if not exists idx_appeals_status on appeals (status, created_at);

-- ---------------------------------------------------------
-- 7. Email outbox (receipts, report notices, reminders, verification)
-- ---------------------------------------------------------
create table if not exists email_outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  to_address  text not null,
  template    text not null,
  subject     text not null,
  body        text not null,
  dedupe_key  text unique,     -- stops the same reminder/receipt being queued twice
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists idx_email_outbox_pending on email_outbox (created_at) where status = 'pending';

create or replace function homlo_queue_email(
  p_user_id uuid, p_template text, p_subject text, p_body text, p_dedupe_key text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := homlo_user_email(p_user_id);
begin
  if v_email is null then return; end if;
  insert into email_outbox (user_id, to_address, template, subject, body, dedupe_key)
  values (p_user_id, v_email, p_template, p_subject, p_body, p_dedupe_key)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Email the owner of a reported listing or profile (without naming the reporter).
create or replace function reports_notify_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid; v_title text;
begin
  if new.target_type = 'job' then
    select employer_id, title into v_owner, v_title from jobs where id = new.target_id;
  elsif new.target_type = 'user' then
    v_owner := new.target_id;
  end if;
  if v_owner is not null then
    perform homlo_queue_email(
      v_owner, 'report_received', 'A report was made about your ' || case when new.target_type = 'job' then 'listing' else 'profile' end,
      'Someone reported ' || coalesce('your listing "' || v_title || '"', 'your profile')
        || ' (' || coalesce(new.category, new.reason) || '). Our team will review it. '
        || 'You do not need to do anything now. If we take action we will tell you and explain how to appeal.',
      'report:' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reports_notify_owner on reports;
create trigger trg_reports_notify_owner after insert on reports
  for each row execute function reports_notify_owner();

-- ---------------------------------------------------------
-- 8. Payments: consent + new-account spend cap + receipts
-- ---------------------------------------------------------
alter table subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table subscriptions add column if not exists renewal_reminder_sent_for timestamptz;

-- Amount in cents an account has committed in its first new_account_days.
create or replace function homlo_new_account_spend_cents(p_user_id uuid)
returns bigint language sql stable as $$
  -- Completed spend, plus checkouts started in the last 30 minutes (abandoned
  -- older ones never charged anything, so they stop counting).
  select (coalesce((select sum(round(amount * 100)) from payments
                     where user_id = p_user_id
                       and (status = 'completed' or (status = 'pending' and created_at > now() - interval '30 minutes'))
                       and created_at > now() - make_interval(days => coalesce(trust_setting_int('new_account_days'), 7))), 0)
        + coalesce((select sum(price_cents) from revenuecat_boost_purchases
                     where user_id = p_user_id
                       and (status in ('purchased', 'activated') or (status = 'pending' and created_at > now() - interval '30 minutes'))
                       and created_at > now() - make_interval(days => coalesce(trust_setting_int('new_account_days'), 7))), 0))::bigint;
$$;

create or replace function homlo_assert_payment_allowed(p_user_id uuid, p_amount_cents bigint)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_cap     integer := trust_setting_int('new_account_spend_cap_cents');
  v_days    integer := coalesce(trust_setting_int('new_account_days'), 7);
  v_window  integer := coalesce(trust_setting_int('payment_consent_window_minutes'), 30);
  v_created timestamptz;
begin
  if not exists (
    select 1 from consent_log
     where user_id = p_user_id and consent_type = 'payment_terms'
       and created_at > now() - make_interval(mins => v_window)
  ) then
    raise exception 'Please agree to the payment terms before paying.';
  end if;
  select created_at into v_created from users where id = p_user_id;
  if v_cap is not null and v_created > now() - make_interval(days => v_days)
     and homlo_new_account_spend_cents(p_user_id) + p_amount_cents > v_cap then
    raise exception 'New accounts can spend up to % USD in their first % days.', to_char(v_cap / 100.0, 'FM999990.00'), v_days;
  end if;
end;
$$;

create or replace function payments_before_insert_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only a NEW checkout (status 'pending') is checked. Rows recording money
  -- that was already taken (webhooks) must never be refused.
  if new.status = 'pending' and new.amount > 0 then
    perform homlo_assert_payment_allowed(new.user_id, round(new.amount * 100)::bigint);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_payments_guard on payments;
create trigger trg_payments_guard before insert on payments
  for each row execute function payments_before_insert_guard();

create or replace function rc_purchases_before_insert_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only the pre-purchase intent is checked, never webhook rows ('unmatched', ...).
  if new.status = 'pending' and new.user_id is not null and new.price_cents > 0 then
    perform homlo_assert_payment_allowed(new.user_id, new.price_cents);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rc_purchases_guard on revenuecat_boost_purchases;
create trigger trg_rc_purchases_guard before insert on revenuecat_boost_purchases
  for each row execute function rc_purchases_before_insert_guard();

-- Receipt email whenever a payment completes (any provider path).
create or replace function payments_send_receipt()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform homlo_queue_email(new.user_id, 'receipt', 'Your Homlo receipt',
      'Thank you for your purchase.' || chr(10)
      || 'Amount: ' || to_char(new.amount, 'FM999990.00') || ' ' || new.currency || chr(10)
      || 'Item: ' || case when new.boost_id is not null then 'Job boost' else 'Subscription' end || chr(10)
      || 'Date (UTC): ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || chr(10)
      || 'Reference: ' || coalesce(new.provider_transaction_id, new.id::text) || chr(10)
      || 'Boosts and subscription periods are non-refundable once started, except where the law requires otherwise.',
      'receipt:payment:' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_payments_receipt on payments;
create trigger trg_payments_receipt after insert or update of status on payments
  for each row execute function payments_send_receipt();

create or replace function rc_purchases_send_receipt()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'activated' and old.status is distinct from 'activated' and new.user_id is not null then
    perform homlo_queue_email(new.user_id, 'receipt', 'Your Homlo receipt',
      'Thank you for your purchase.' || chr(10)
      || 'Amount: ' || to_char(new.price_cents / 100.0, 'FM999990.00') || ' ' || new.currency || chr(10)
      || 'Item: Job boost (' || coalesce(new.plan_id, new.product_id) || ')' || chr(10)
      || 'Date (UTC): ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || chr(10)
      || 'Reference: ' || coalesce(new.rc_transaction_id, new.id::text) || chr(10)
      || 'Boosts are non-refundable once started, except where the law requires otherwise. '
      || 'App Store / Google Play purchases are refunded through the store.',
      'receipt:rc:' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rc_purchases_receipt on revenuecat_boost_purchases;
create trigger trg_rc_purchases_receipt after update of status on revenuecat_boost_purchases
  for each row execute function rc_purchases_send_receipt();

-- ---------------------------------------------------------
-- 9. Chargeback evidence: one call returns everything to contest a dispute
-- ---------------------------------------------------------
create or replace function homlo_chargeback_evidence(p_payment_ref text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with p as (
    select 'payment' as source, id, user_id, boost_id, null::uuid as job_id, amount * 100 as amount_cents, currency,
           status, provider, provider_transaction_id as transaction_id, created_at, updated_at
      from payments where id::text = p_payment_ref or provider_transaction_id = p_payment_ref
    union all
    select 'revenuecat', id, user_id, boost_id, job_id, price_cents, currency,
           status, 'revenuecat', rc_transaction_id, created_at, updated_at
      from revenuecat_boost_purchases where id::text = p_payment_ref or rc_transaction_id = p_payment_ref
  )
  select jsonb_build_object(
    'payment', to_jsonb(p),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb) from consent_log c
                  where c.user_id = p.user_id and c.created_at <= p.created_at + interval '1 hour'),
    'boost',    (select to_jsonb(b) from boosts b where b.id = p.boost_id),
    'listing',  (select jsonb_build_object('id', j.id, 'title', j.title, 'description', j.description,
                         'status', j.status, 'published_at', j.published_at, 'expires_at', j.expires_at)
                   from jobs j where j.id = coalesce(p.job_id, (select job_id from boosts where id = p.boost_id))),
    'account',  (select jsonb_build_object('user_id', u.id, 'created_at', u.created_at,
                         'email_verified_at', u.email_verified_at, 'phone_verified_at', u.phone_verified_at)
                   from users u where u.id = p.user_id),
    'generated_at', now()
  )
  from p limit 1;
$$;

-- ---------------------------------------------------------
-- 10. Privileges: all of the above is server-only.
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['trust_settings', 'admin_users', 'consent_log', 'verification_codes', 'user_devices',
                           'banned_identifiers', 'listing_safety_rules', 'moderation_actions', 'appeals', 'email_outbox']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end;
$$;

revoke all on function homlo_user_email(uuid) from public, anon, authenticated;
revoke all on function homlo_queue_email(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function homlo_chargeback_evidence(text) from public, anon, authenticated;
revoke all on function homlo_assert_payment_allowed(uuid, bigint) from public, anon, authenticated;

commit;
