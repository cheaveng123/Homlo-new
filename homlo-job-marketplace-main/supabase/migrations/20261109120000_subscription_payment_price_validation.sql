alter table public.plan_catalog
  add column if not exists base_price_cents int;

update public.plan_catalog
   set base_price_cents = case plan
     when 'free' then 0
     when 'pro' then 1999
     when 'enterprise' then 49900
   end
 where base_price_cents is null;

create or replace function public.homlo_create_subscription_payment(
  p_user_id uuid,
  p_plan text,
  p_amount numeric,
  p_currency text default 'USD',
  p_provider text default 'aba_payway'
)
returns payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment payments%rowtype;
  v_price_cents int;
begin
  if not exists (select 1 from profiles where user_id = p_user_id and deleted_at is null) then
    raise exception 'Profile not found';
  end if;
  if p_plan not in ('free', 'pro', 'enterprise') then
    raise exception 'Unknown plan';
  end if;

  select base_price_cents into v_price_cents
    from public.plan_catalog
   where plan = p_plan;

  if v_price_cents is null then
    raise exception 'Plan price is not configured';
  end if;
  if p_amount is null or abs(p_amount * 100 - v_price_cents) > 0.5 then
    raise exception 'Subscription amount does not match plan price';
  end if;

  insert into payments (user_id, amount, currency, provider, status)
  values (
    p_user_id,
    v_price_cents / 100.0,
    coalesce(nullif(trim(p_currency), ''), 'USD'),
    coalesce(nullif(trim(p_provider), ''), 'aba_payway'),
    'pending'
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.homlo_create_subscription_payment(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.homlo_create_subscription_payment(uuid, text, numeric, text, text) to service_role;
