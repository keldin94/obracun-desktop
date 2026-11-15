// Check public connectivity and that anonymous clients cannot read OBRAČUN data.
// No test users are created and no customer data is read.
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const cfg=JSON.parse(readFileSync('app/cloud-config.json','utf8'));
assert.match(cfg.url,/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
assert.match(cfg.publishableKey,/^sb_publishable_/);
const check=async (path)=>fetch(cfg.url+path,{
 headers:{apikey:cfg.publishableKey},
 signal:AbortSignal.timeout(12000)
});
(async()=>{
 const settings=await check('/auth/v1/settings');
 assert.equal(settings.status,200,'Supabase Auth settings not reachable ('+settings.status+')');
 for(const table of ['obracun_companies','obracun_sites','obracun_members','obracun_site_grants']){
   const res=await check('/rest/v1/'+table+'?select=*');
   assert.ok(res.status===401||res.status===403,
     'Anonymous read was not blocked for '+table+' (status '+res.status+')');
 }
 console.log('Cloud endpoint reachable; anonymous reads blocked by database permissions.');
})().catch(e=>{console.error(e);process.exitCode=1});
