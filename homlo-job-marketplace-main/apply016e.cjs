const fs=require('fs');
require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 try{
  const body=fs.readFileSync('backend/database/migrations/016_job_search.sql','utf8');
  await sql.unsafe(body);
  console.log('APPLY OK');
  const chk=await sql.unsafe(`select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='homlo_search_public_jobs'`);
  console.log('SIG', JSON.stringify(chk));
  const r=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs('cashier'::text, '', '','','','',null,null,'','recommended',null,null,20,0, '')`);
  console.log('CASHIER', JSON.stringify(r));
  const r2=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs('English computer cashier'::text, '', '','','','',null,null,'','recommended',null,null,20,0, '')`);
  console.log('MULTI', JSON.stringify(r2));
  const r3=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs('', '', '','','','',null,null,'','recommended',null,null,20,0, '')`);
  console.log('EMPTY', JSON.stringify(r3));
  const b=await sql.unsafe(`select count(*)::int as n from homlo_search_public_jobs('', '','','','','',null,null,'','recommended',null,null,20,0, '11.5,104.8,11.7,105.1')`);
  console.log('BBOX', JSON.stringify(b));
 }catch(e){console.log('FAIL', String(e&&e.message||e));}
 await sql.end({timeout:2});
})();
