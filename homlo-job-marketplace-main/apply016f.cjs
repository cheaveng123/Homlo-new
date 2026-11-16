require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 try{
  await sql.unsafe(`drop function if exists public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int);`);
  console.log('DROPPED OLD 15-ARG');
  const chk=await sql.unsafe(`select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='homlo_search_public_jobs'`);
  console.log('SIGS', JSON.stringify(chk.map(r=>r.sig)));
  // Cast args explicitly to avoid ambiguity now
  const r=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs('cashier'::text, '':text, '':text,'':text,'':text,'':text,null::numeric,null::numeric,'':text,'recommended'::text,null::double precision,null::double precision,20::int,0::int, '':text)`);
  console.log('CASHIER', JSON.stringify(r));
  const r2=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs('English computer cashier'::text, '':text, '':text,'':text,'':text,'':text,null::numeric,null::numeric,'':text,'recommended'::text,null::double precision,null::double precision,20::int,0::int, '':text)`);
  console.log('MULTI', JSON.stringify(r2));
  const r3=await sql.unsafe(`select title, relevance_score from homlo_search_public_jobs(''::text, '':text, '':text,'':text,'':text,'':text,null::numeric,null::numeric,'':text,'recommended'::text,null::double precision,null::double precision,20::int,0::int, '':text)`);
  console.log('EMPTY', JSON.stringify(r3));
  const b=await sql.unsafe(`select count(*)::int as n from homlo_search_public_jobs(''::text, '':text,'':text,'':text,'':text,'':text,null::numeric,null::numeric,'':text,'recommended'::text,null::double precision,null::double precision,20::int,0::int, '11.5,104.8,11.7,105.1'::text)`);
  console.log('BBOX', JSON.stringify(b));
 }catch(e){console.log('FAIL', String(e&&e.message||e));}
 await sql.end({timeout:2});
})();
