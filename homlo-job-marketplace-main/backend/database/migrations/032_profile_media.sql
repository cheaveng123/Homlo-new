-- =========================================================
-- 032_profile_media.sql
-- Profile media: a banner_image column on profiles plus a
-- service-role-only RPC that updates the profile photo key and
-- the banner image without touching the text-profile upsert
-- (homlo_upsert_profile stays 8-arg and is unchanged).
--
-- Profile photos follow the existing profile_photo_key storage
-- convention (a URI/reference the client renders), and banners
-- are stored the same way the job form stores its banner image,
-- so the Profile hero can show both.
-- =========================================================

alter table profiles add column if not exists banner_image text;

create or replace function public.homlo_upsert_profile_media(
  p_user_id uuid,
  p_profile_photo_key text default null,
  p_banner_image text default null
)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile profiles%rowtype;
begin
  if not exists (select 1 from users where id = p_user_id and deleted_at is null and status = 'active') then
    raise exception 'Active canonical user not found';
  end if;

  update profiles
    set profile_photo_key = nullif(trim(coalesce(p_profile_photo_key, '')), ''),
        banner_image = nullif(trim(coalesce(p_banner_image, '')), '')
  where user_id = p_user_id and deleted_at is null
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.homlo_upsert_profile_media(uuid, text, text) from public, anon, authenticated;
grant execute on function public.homlo_upsert_profile_media(uuid, text, text) to service_role;