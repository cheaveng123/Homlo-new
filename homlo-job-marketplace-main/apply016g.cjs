require('dotenv').config();
const postgres=require('postgres');
const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:'require',max:1,idle_timeout:1,connect_timeout:20});
function call(q){
 // order: query,cat,loc,emp,arr,exp,smin,smax,posted,lat,lng,radius,sort,limit,offset,bbox
 const parts=[
   `'${q.replace(/'/g,"''")}'::text`, `''::text`,`''::text`,`''::text`,`''::text`,`''::text`,
   `null::numeric`,`null::numeric`,`''::text`,
   `null::double precision`,`null::double precision`,`null::double precision`,
   `'recommended'::text`, `20::int`, `0::int`, `''::text`
 ];
 return `select title, relevance_score from homlo_search_public_jobs(${parts.join(',')})`;
}
(async()=>{
 try{
  console.log('CASHIER', JSON.stringify(await sql.unsafe(call('cashier'))));
  console.log('MULTI', JSON.stringify(await sql.unsafe(call('English computer cashier'))));
  console.log('EMPTY', JSON.stringify(await sql.unsafe(call(''))));
  const b=await sql.unsafe(`select count(*)::int as n from homlo_search_public_jobs(''::text,''::text,''::text,''::text,''::text,''::text,null::numeric,null::numeric,''::text,null::double precision,null::double precision,null::double precision,'recommended'::text,20::int,0::int,'11.5,104.8,11.7,105.1'::text)`);
  console.log('BBOX', JSON.stringify(b));
 }catch(e){console.log('FAIL', String(e&&e.message||e));}
 await sql.end({timeout:2});
})();
