begin;
drop function if exists public.homlo_list_messages(uuid, uuid, timestamptz, int);
create function public.homlo_list_messages(p_conversation_id uuid, p_user_id uuid, p_before timestamptz default null, p_limit integer default 500)
returns table(id uuid, conversation_id uuid, sender_id uuid, message text, message_type text, read_at timestamptz, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz, application_id uuid, job_id uuid, job_title text)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.homlo_is_conversation_member(p_conversation_id, p_user_id) then
    return;
  end if;

  return query
  select * from (
    select m.id, m.conversation_id, m.sender_id, m.message, m.message_type,
           m.read_at, m.created_at, m.updated_at, m.deleted_at,
           a.id as application_id, j.id as job_id, coalesce(j.title, '')::text as job_title
    from messages m
    join conversations c on c.id = m.conversation_id
    left join applications a on a.id = coalesce(m.application_id, c.application_id)
    left join jobs j on j.id = a.job_id
    where m.conversation_id = p_conversation_id
      and (p_before is null or m.created_at < p_before)
      and m.deleted_at is null
      and not exists (
        select 1 from message_hidden_for mh
        where mh.message_id = m.id and mh.user_id = p_user_id
      )
    order by m.created_at desc
    limit p_limit
  ) t
  order by t.created_at asc;
end;
$function$;
revoke all on function public.homlo_list_messages(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function public.homlo_list_messages(uuid, uuid, timestamptz, int) to service_role;
commit;
