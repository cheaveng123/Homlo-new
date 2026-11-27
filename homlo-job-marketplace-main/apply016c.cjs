const fs=require('fs');
require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 try{
  // Extract just the CREATE OR REPLACE FUNCTION ... $$; statement
  const body=fs.readFileSync('backend/database/migrations/016_job_search.sql','utf8');
  const m=body.match(/create or replace function[\s\S]*?\$\$;/i);
  console.log('found fn block chars:', m?m[0].length:-1);
  await sql.unsafe(m[0]);
  console.log('FUNCTION CREATE OK');
 }catch(e){console.log('FAIL FULL:', String(e&&e.message||e));}
 finally{await sql.end({timeout:2});}
})();
