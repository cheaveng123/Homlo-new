import postgres from 'postgres';
import { readFileSync } from 'fs';

const envRaw = readFileSync('./.env', 'utf8');
const url = Object.fromEntries(envRaw.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => { const [k, ...rest] = l.split('='); return [k.trim(), rest.join('=').trim()]; })).SUPABASE_DB_URL;
const sql = postgres(url);

const checks = [
  ["conversations.application_id", "select exists(select 1 from information_schema.columns where table_name='conversations' and column_name='application_id') as ok"],
  ["conversation_members.last_read_at", "select exists(select 1 from information_schema.columns where table_name='conversation_members' and column_name='last_read_at') as ok"],
  ["messages.message_type", "select exists(select 1 from information_schema.columns where table_name='messages' and column_name='message_type') as ok"],
  ["homlo_get_or_create_conversation", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_get_or_create_conversation') as ok"],
  ["homlo_send_message", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_send_message') as ok"],
  ["homlo_list_conversations", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_list_conversations') as ok"],
  ["homlo_mark_conversation_read", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_mark_conversation_read') as ok"],
  ["homlo_get_unread_count", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_get_unread_count') as ok"],
  ["homlo_current_user_id", "select exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='homlo_current_user_id') as ok"],
  ["conversation members (aliases)", "select exists(select 1 from information_schema.columns where table_name='conversation_members' and column_name='blocked_at') as ok"],
  ["conversations unique idx", "select exists(select 1 from pg_indexes where indexname='uq_conversations_application') as ok"],
  ["homlo_messaging publication", "select exists(select 1 from pg_publication where pubname='homlo_messaging') as ok"],
  ["RLS conversations", "select relrowsecurity from pg_class where relname='conversations'"],
  ["RLS messages", "select relrowsecurity from pg_class where relname='messages'"],
];

console.log("=== 028 verification ===");
for (const [label, q] of checks) {
  const r = await sql.unsafe(q);
  console.log(label, JSON.stringify(r[0]));
}
await sql.end();
