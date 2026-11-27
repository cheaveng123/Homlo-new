require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
function call(q){
 const parts=[`'${q.replace(/'/g,"''")}'::text`,`''::text`,`''::text`,`''::text`,`''::text`,`''::text`,`null::numeric`,`null::numeric`,`''::text`,`null::double precision`,`null::double precision`,`null::double precision`,`'recommended'::text`,`20::int`,`0::int`,`''::text`];
 return `select title, relevance_score from homlo_search_public_jobs(${parts.join(',')})`;
}
(async()=>{
 try{
  for (const q of ['job','phnom','Phnom Penh','english','Job 1']) {
    console.log('Q=', JSON.stringify(q), JSON.stringify(await sql.unsafe(call(q))));
  }
 }catch(e){console.log('FAIL', String(e&&e.message||e));}
 await sql.end({timeout:2});
})();
