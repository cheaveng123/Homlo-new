
require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:15});
(async()=>{
 try{
  const ext=await sql.unsafe(`select name, installed_version from pg_available_extensions where name in ('postgis','pg_trgm','postgis_topology')`);
  console.log('EXT', JSON.stringify(ext));
  const fn=await sql.unsafe(`select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='homlo_search_public_jobs'`);
  console.log('FUNCSIG', JSON.stringify(fn));
  const cnt=await sql.unsafe(`select count(*)::int as n from jobs where deleted_at is null and status='open'`);
  console.log('OPEN_JOBS', JSON.stringify(cnt));
  const j=await sql.unsafe(`select id, title, location_text, latitude, longitude from jobs where deleted_at is null order by created_at desc limit 6`);
  console.log('JOBS', JSON.stringify(j.map(r=>({id:r.id,t:r.title,l:r.location_text,la:r.latitude,lo:r.longitude}))));
  const cat=await sql.unsafe(`select id, name, slug from categories order by name limit 20`);
  console.log('CATS', JSON.stringify(cat));
 }catch(e){console.log('FAIL', String(e).split('\n')[0]);}
 finally{await sql.end({timeout:2});}
})();
