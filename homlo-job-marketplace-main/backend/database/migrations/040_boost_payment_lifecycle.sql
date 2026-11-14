alter table public.boosts
  drop constraint if exists boosts_status_check;

alter table public.boosts
  add constraint boosts_status_check check (status in ('pending', 'active', 'expired', 'cancelled'));

create or replace function public.homlo_create_boost(
  p_employer_id uuid,
  p_job_id uuid,
  p_package text,
  p_amount numeric,
  p_currency text default 'USD',
  p_provider text default 'aba_payway'
)
returns table (
  boost_id uuid,
  payment_id uuid,
  payment_status text,
  amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_boost boosts%rowtype;
  v_payment payments%rowtype;
  v_days int;
  v_expected_amount numeric;
  v_is_pro boolean;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.employer_id <> p_employer_id then
    raise exception 'Only the listing employer can boost this job';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Only live jobs can be boosted';
  end if;

  case p_package
    when 'starter'  then v_days := 3;
    when 'local'    then v_days := 5;
    when 'standard' then v_days := 7;
    when 'urgent'   then v_days := 3;
    when 'strong'   then v_days := 7;
    when 'maximum'  then v_days := 14;
    else raise exception 'Unknown boost package';
  end case;

  select exists (
    select 1
    from subscriptions
    where user_id = p_employer_id
      and plan = 'pro'
      and status = 'active'
  ) into v_is_pro;

  case p_package
    when 'starter'  then v_expected_amount := case when v_is_pro then 2.49 else 2.99 end;
    when 'local'    then v_expected_amount := case when v_is_pro then 5.99 else 6.99 end;
    when 'standard' then v_expected_amount := case when v_is_pro then 7.99 else 9.99 end;
    when 'urgent'   then v_expected_amount := case when v_is_pro then 11.99 else 14.99 end;
    when 'strong'   then v_expected_amount := case when v_is_pro then 15.99 else 19.99 end;
    when 'maximum'  then v_expected_amount := case when v_is_pro then 31.99 else 39.99 end;
  end case;

  if p_amount is null or p_amount <= 0 or abs(p_amount - v_expected_amount) > 0.005 then
    raise exception 'Boost amount does not match package';
  end if;

  update boosts
    set status = 'cancelled', updated_at = now()
  where job_id = p_job_id
    and status = 'pending';

  insert into boosts (job_id, employer_id, package, start_at, expires_at, status)
  values (p_job_id, p_employer_id, p_package, now(), now() + make_interval(days => v_days), 'pending')
  returning * into v_boost;

  insert into payments (user_id, job_id, boost_id, amount, currency, provider, status)
  values (p_employer_id, p_job_id, v_boost.id, p_amount, coalesce(nullif(trim(p_currency), ''), 'USD'), coalesce(nullif(trim(p_provider), ''), 'aba_payway'), 'pending')
  returning * into v_payment;

  return query select v_boost.id, v_payment.id, v_payment.status, v_payment.amount, v_payment.currency;
end;
$$;

create or replace function public.homlo_record_payment_webhook(
  p_provider text,
  p_provider_event_id text,
  p_provider_transaction_id text,
  p_payment_id uuid,
  p_result text
)
returns payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment payments%rowtype;
  v_event_id uuid;
  v_boost boosts%rowtype;
begin
  if p_result not in ('completed', 'failed') then
    raise exception 'Unknown payment result';
  end if;

  insert into payment_webhook_events (provider, provider_event_id, event_type, payload)
  values (p_provider, p_provider_event_id, p_result, jsonb_build_object('payment_id', p_payment_id, 'provider_transaction_id', p_provider_transaction_id))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending' then
    return v_payment;
  end if;

  if p_result = 'completed' then
    update payments
      set status = 'completed',
          provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
          updated_at = now()
      where id = p_payment_id
      returning * into v_payment;

    if v_payment.boost_id is not null then
      update boosts
        set status = 'cancelled', updated_at = now()
        where job_id = v_payment.job_id
          and id <> v_payment.boost_id
          and status = 'active';

      update boosts
        set status = 'active',
            start_at = now(),
            expires_at = now() + make_interval(days => case package
              when 'starter' then 3
              when 'local' then 5
              when 'standard' then 7
              when 'urgent' then 3
              when 'strong' then 7
              when 'maximum' then 14
              else 7
            end),
            updated_at = now()
        where id = v_payment.boost_id
          and status = 'pending'
        returning * into v_boost;
    end if;
  else
    update payments
      set status = 'failed',
          provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
          updated_at = now()
      where id = p_payment_id
      returning * into v_payment;

    if v_payment.boost_id is not null then
      update boosts
        set status = 'cancelled', updated_at = now()
        where id = v_payment.boost_id
          and status = 'pending';
    end if;
  end if;

  return v_payment;
end;
$$;
