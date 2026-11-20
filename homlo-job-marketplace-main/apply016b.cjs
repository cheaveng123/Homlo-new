const fs=require('fs');
require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
(async()=>{
 try{
  const body=fs.readFileSync('backend/database/migrations/016_job_search.sql','utf8');
  await sql.unsafe(body);
  console.log('APPLY OK');
 }catch(e){console.log('FAIL FULL:', String(e && e.message||e));}
 finally{await sql.end({timeout:2});}
})();
