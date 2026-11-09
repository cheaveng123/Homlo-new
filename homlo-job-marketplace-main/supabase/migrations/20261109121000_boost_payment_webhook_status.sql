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
          provider_transaction_id = coalesce(payments.provider_transaction_id, p_provider_transaction_id),
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
          and status in ('pending', 'scheduled')
        returning * into v_boost;
    end if;
  else
    update payments
      set status = 'failed',
          provider_transaction_id = coalesce(payments.provider_transaction_id, p_provider_transaction_id),
          updated_at = now()
      where id = p_payment_id
      returning * into v_payment;

    if v_payment.boost_id is not null then
      update boosts
        set status = 'cancelled', updated_at = now()
        where id = v_payment.boost_id
          and status in ('pending', 'scheduled');
    end if;
  end if;

  return v_payment;
end;
$$;

revoke all on function public.homlo_record_payment_webhook(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_record_payment_webhook(text, text, text, uuid, text) to service_role;
