import 'dotenv/config';
import postgres from 'postgres';
const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) { console.error('no db url'); process.exit(1); }
const sql = postgres(url, { max: 1, connect_timeout: 15 });
try {
  const tables = ['jobs','boosts','notifications','payments','job_boosts','boost_packages'];
  for (const t of tables) {
    const rows = await sql`select column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
    console.log(`\n== ${t} (${rows.length}) ==`);
    for (const r of rows) console.log(`${r.column_name}\t${r.data_type}\t${r.is_nullable}\t${r.column_default ?? ''}`);
  }
  const counts = await sql`select
    (select count(*) from boosts) as boosts,
    (select count(*) from job_boosts) as job_boosts,
    (select count(*) from notifications) as notifications`;
  console.log('\ncounts', counts[0]);
} catch (e) { console.error('ERR', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
