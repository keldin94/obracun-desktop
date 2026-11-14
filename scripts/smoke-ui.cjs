/* UI smoke test: fail the release when the real rendered desktop app is blank. */
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
 const server=spawn('go',['run','.'],{
   env:{...process.env,OBRACUN_TEST_NO_WINDOW:'1'},
   stdio:['ignore','pipe','pipe']
 });
 let logs='';
 server.stdout.on('data',b=>{logs+=b.toString()});
 server.stderr.on('data',b=>{logs+=b.toString()});
 let browser;
 try {
   let ready=false;
   for(let i=0;i<120;i++){
     if(server.exitCode!==null)throw Error('Server terminated: '+logs);
     try {
       const r=await fetch('http://127.0.0.1:17861/api/health');
       if(r.ok && (await r.json()).version==='0.3.2'){ready=true;break}
     }catch{}
     await new Promise(resolve=>setTimeout(resolve,500));
   }
   assert.ok(ready,'Desktop server not responding: '+logs);
   browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
   const page=await browser.newPage();
   const failures=[];
   page.on('pageerror',e=>failures.push(String(e.stack||e)));
   page.on('console',m=>{if(m.type()==='error')failures.push('console: '+m.text())});
   const result=await page.goto('http://127.0.0.1:17861/',{waitUntil:'load'});
   assert.equal(result.status(),200);
   await page.getByRole('button',{name:/Novo gradilište/i}).first().waitFor({timeout:15000});
   assert.ok(await page.locator('#root').locator('>*').count()>0,'The React app rendered an empty root');
   assert.deepEqual(failures,[],'Page errors on launch');
   // Verify an actual user interaction, not just static HTML.
   await page.getByRole('button',{name:/Novo gradilište/i}).first().click();
   await page.getByPlaceholder(/Unesi naziv projekta/).waitFor({timeout:5000});
   assert.deepEqual(failures,[],'Page errors after opening project form');
   console.log('PASS: real React UI rendered, click works, no browser errors.');
 }finally{
   if(browser)await browser.close();
   server.kill('SIGTERM');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
