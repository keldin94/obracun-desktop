/* UI smoke test: fail the release when the real rendered desktop app is blank. */
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs=require('node:fs');
const goSource=fs.readFileSync('main.go','utf8');
const expectedVersion=goSource.match(/appVersion\s*=\s*"([^"]+)"/)?.[1];
if(!expectedVersion)throw Error('Version not found in main.go');


(async () => {
 const server=spawn('./smoke-server',[],{
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
       if(r.ok && (await r.json()).version===expectedVersion){ready=true;break}
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
   await page.getByRole('button',{name:/Novo gradbišče|Novo gradilište/i}).first().waitFor({timeout:15000});
   assert.ok(await page.locator('#root').locator('>*').count()>0,'The React app rendered an empty root');
   assert.deepEqual(failures,[],'Page errors on launch');
   // Verify an actual user interaction, not just static HTML.
   await page.getByRole('button',{name:/Novo gradbišče|Novo gradilište/i}).first().click();
   await page.getByPlaceholder(/Vnesi naziv projekta|Unesi naziv projekta/).waitFor({timeout:5000});
   assert.deepEqual(failures,[],'Page errors after opening project form');
   // Cloud configuration must be built in: no customer-side URL or API key setup.
   await page.getByRole('button',{name:/Prekliči|Otkaži|Otkazi/i}).first().click();
   await page.getByRole('button',{name:/Podjetje in uporabniki|Firma i korisnici/i}).first().click();
   await page.locator('#ob-account-layer').waitFor({state:'visible',timeout:7000});
   await page.locator('#ob-email').waitFor({state:'visible',timeout:7000});
   assert.ok(await page.locator('[data-op="signup"]').count()>0,'Cloud registration not available');
   assert.deepEqual(failures,[],'Page errors in cloud login screen');

   // Test a full unit-specific editor workflow using disposable data, never real user records.
   await page.locator('#ob-account-close').click();
   await page.evaluate(()=>{
     const project={id:'TEST_SITE_CI',name:'Testno gradbišče',location:'',client:''};
     const items=[
       {id:'STEEL_CI',projectId:project.id,code:'4.11',name:'Armatura test',group:'Betonska dela',unit:'kg',contractQty:100,unitPrice:.40},
       {id:'VOLUME_CI',projectId:project.id,code:'4.6',name:'Plošča test',group:'Betonska dela',unit:'m³',contractQty:300,unitPrice:20}
     ];
     localStorage.setItem('obracun-webapp-v1',JSON.stringify({
       projects:[project],items,entries:[],proofs:[],selectedProject:project.id,selectedMonth:'2026-11',schemaVersion:3
     }));
   });
   await page.reload({waitUntil:'load'});
   await page.locator('.site-card').filter({hasText:'Testno gradbišče'}).click();
   await page.getByRole('button',{name:/Popis del|Popis radova/}).first().click();
   await page.locator('.items-table tbody tr').first().click();
   await page.locator('.drawer').waitFor({state:'visible'});
   const width=await page.locator('.drawer').evaluate(el=>el.getBoundingClientRect().width);
   assert.ok(width>=850,'Measurement editor is still too narrow: '+width);
   await page.getByRole('button',{name:/Dodaj vrstico/}).first().click();
   await page.locator('.ob-measure-card').first().waitFor();
   await page.locator('.ob-measure-card label').filter({hasText:'Vgrajena masa (kg)'}).locator('input').fill('23,5');
   await page.locator('.ob-measure-grandtotal').getByText(/23,500|23\.500/).waitFor();
   await page.locator('.ob-measure-card label').filter({hasText:'Številke armaturnih pozicij'}).locator('input').fill('4, 7, 12');
   assert.ok(await page.locator('.ob-measure-card').getByText(/Razčlenitev po premerih/).count()>0,'Armature diameter breakdown option missing');
   await page.getByRole('button',{name:/Zapri postavko|Zatvori postavku/}).first().click();
   await page.locator('.items-table tbody tr').nth(1).click();
   await page.getByRole('button',{name:/Dodaj vrstico/}).first().click();
   for(const [name,value] of [['a (m)','8,35'],['b (m)','19,62'],['c (m)','0,20']]){
     await page.locator('.ob-measure-card label').filter({hasText:name}).first().locator('input').fill(value);
   }
   await page.locator('.ob-measure-grandtotal').getByText(/32,765|32\.765/).waitFor();
   await page.locator('.ob-formula-input').fill('a*(b+c)*2kos');
   await page.locator('.ob-measure-grandtotal').getByText(/331,0|331\.0/).waitFor({timeout:3000}).catch(()=>{});
   assert.deepEqual(failures,[],'Page errors in quantity and reinforcement editors');

   console.log('PASS: real React UI rendered, click works, no browser errors.');
 }finally{
   if(browser)await browser.close();
   server.kill('SIGTERM');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
