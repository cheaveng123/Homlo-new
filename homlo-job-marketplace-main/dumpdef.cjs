require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 try{
  const r=await sql.unsafe(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='homlo_search_public_jobs'`);
  const def=r[0].def;
  const lines=def.split('\n');
  console.log('total lines', lines.length);
  // print lines around 'return query' and the 'as $$' openers
  lines.forEach((l,i)=>{ if(/return query|\$\$|as \$|format\(/i.test(l)) console.log(i+1, JSON.stringify(l.slice(0,80))); });
 }catch(e){console.log('FAIL', String(e&&e.message||e));}
 await sql.end({timeout:2});
})();
