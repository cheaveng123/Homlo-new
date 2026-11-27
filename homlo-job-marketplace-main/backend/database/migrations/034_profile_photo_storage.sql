-- =========================================================
-- 034_profile_photo_storage.sql
-- Dedicated public Supabase Storage bucket for profile photos
-- plus the RLS contract and the read-model plumbing so a
-- profile photo can live on one device and render on any
-- other account/device.
--
-- Contract:
--   * profiles.profile_photo_key stores ONLY a Storage object
--     path inside the public `profile-photos` bucket, e.g.
--         <user_id>/avatar-<ts>.<ext>
--   * never a ph:// / file:// / content:// / data: / blob:
--     device-local reference (those cannot be cross-device).
--   * reads are public (profile photos are intentionally public);
--     writes are restricted to the caller's own user folder.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Bucket.
--
--    The `profile-photos` bucket MUST be created through the
--    Supabase Storage API (not a raw `insert into
--    storage.buckets`), because on the current Supabase Storage
--    backend a hand-inserted row resolves via GET bucket but
--    object uploads fail with "NoSuchBucket". Provision it with:
--
--        node scripts/provision-profile-photos-bucket.mjs
--
--    (idempotent: POST /storage/v1/bucket returns 200 when the
--    bucket already exists).
-- ---------------------------------------------------------

-- ---------------------------------------------------------
-- 2. Object-level RLS (defense in depth). Uploads in this
--    deployment go through the server service-role adapter,
--    which already scopes the key to the caller's user id;
--    these policies additionally block anon-key clients from
--    touching any folder except their own.
-- ---------------------------------------------------------

drop policy if exists "profile-photos public read" on storage.objects;
create policy "profile-photos public read"
on storage.objects for select
using ( bucket_id = 'profile-photos' );

drop policy if exists "profile-photos own upload" on storage.objects;
create policy "profile-photos own upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile-photos own update" on storage.objects;
create policy "profile-photos own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile-photos own delete" on storage.objects;
create policy "profile-photos own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------
-- 3. homlo_upsert_profile_media — refuse device-local URIs.
--    ph://, file://, content://, assets-library://,
--    ipod-library:// and blob: references can never resolve
--    to an image on another device, so they are dropped to
--    NULL (default avatar) instead of persisted.
--
--    data: URLS ARE PRESERVED — an embedded base64 image is
--    still a stored copy and we never auto-destroy image data.
--    Legacy https:// keys/URLs are also preserved.
-- ---------------------------------------------------------
create or replace function public.homlo_upsert_profile_media(
  p_user_id uuid,
  p_profile_photo_key text default null::text,
  p_banner_image text default null::text
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

  if p_profile_photo_key is not null
     and trim(coalesce(p_profile_photo_key, '')) ~* '^(ph|file|content|assets-library|ipod-library|blob):'
  then
    p_profile_photo_key := null;
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

-- ---------------------------------------------------------
-- 4. employer applicant read model now returns the worker's
--    profile_photo_key so employer screens can render the
--    applicant's public avatar (key-only; the client resolves
--    the public URL).
-- ---------------------------------------------------------
drop function if exists public.homlo_list_employer_applications_detailed(uuid, uuid);

create or replace function public.homlo_list_employer_applications_detailed(p_employer_id uuid, p_job_id uuid)
returns table (
  id uuid,
  job_id uuid,
  worker_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  worker_full_name text,
  worker_location text,
  worker_bio text,
  worker_photo_key text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, p.full_name, p.location_text, p.bio, p.profile_photo_key
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  join profiles p on p.user_id = a.worker_id and p.deleted_at is null
  where j.employer_id = p_employer_id and a.job_id = p_job_id
  order by a.created_at desc;
$$;

revoke all on function public.homlo_list_employer_applications_detailed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_employer_applications_detailed(uuid, uuid) to service_role;

-- ---------------------------------------------------------
-- 5. Optional data cleanup for EXISTING device-local keys.
--    Left commented-out on purpose: only run it when you have
--    confirmed no image data would be lost. ph:// / file:// /
--    content:// references hold no stored image (the bytes live
--    on one origin device) so nulling them only restores the
--    default avatar. data: URLs are intentionally excluded.
--
-- update profiles
--   set profile_photo_key = null
--   where profile_photo_key ~* '^(ph|file|content|assets-library|ipod-library|blob):';
-- ---------------------------------------------------------