import postgres from 'postgres';
import { readFileSync } from 'fs';

const envRaw = readFileSync('./.env', 'utf8');
const url = Object.fromEntries(envRaw.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => { const [k, ...rest] = l.split('='); return [k.trim(), rest.join('=').trim()]; })).SUPABASE_DB_URL;
const sql = postgres(url, { max: 1 });

const checks = [];
checks.push(["033 other_user_photo", (await sql`select exists(select 1 from pg_proc p where p.proname='homlo_list_conversations' and pg_get_function_result(p.oid)::text like '%other_user_photo%') as ok`)[0].ok]);
checks.push(["033 application_status present", (await sql`select exists(select 1 from pg_proc p where p.proname='homlo_list_conversations' and pg_get_function_result(p.oid)::text like '%application_status%') as ok`)[0].ok]);
checks.push(["034 bucket profile-photos", (await sql`select exists(select 1 from storage.buckets where id='profile-photos') as ok`)[0].ok]);
checks.push(["034 bucket public", (await sql`select public from storage.buckets where id='profile-photos'`)[0].public]);
const policies = await sql`select policyname, cmd, roles::text as roles from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'profile-photos%' order by cmd`;
checks.push(["034 storage policies", policies.map(p => `${p.policyname}[${p.cmd}→${p.roles}]`).join(", ")]);
checks.push(["034 worker_photo_key", (await sql`select exists(select 1 from pg_proc p where p.proname='homlo_list_employer_applications_detailed' and pg_get_function_result(p.oid)::text like '%worker_photo_key%') as ok`)[0].ok]);
checks.push(["034 media URI guard", (await sql`select exists(select 1 from pg_proc p where p.proname='homlo_upsert_profile_media' and p.prosrc like '%ph|file|content%') as ok`)[0].ok]);
checks.push(["033/034 media grants", (await sql`select (select count(*)::int from pg_proc p where p.proname='homlo_upsert_profile_media') = 1 as media, (select count(*)::int from pg_proc p where p.proname='homlo_list_employer_applications_detailed') = 1 as emp, (select count(*)::int from pg_proc p where p.proname='homlo_list_conversations') = 1 as conv`)[0]]);

for (const [label, value] of checks) console.log(label, "->", JSON.stringify(value));
await sql.end();