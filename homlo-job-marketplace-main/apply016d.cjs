require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 let ok=false;
 try{
  await sql.unsafe("create or replace function public.test_foo_zz() returns int language sql as $$ select 1 $$;");
  console.log('MINIMAL FN OK');
  const r=await sql.unsafe("select public.test_foo_zz()");
  console.log('CALL OK', JSON.stringify(r));
  ok=true;
 }catch(e){console.log('MIN FAIL', String(e&&e.message||e));}
 try{ await sql.unsafe("drop function if exists public.test_foo_zz();"); }catch(e){}
 await sql.end({timeout:2});
})();
