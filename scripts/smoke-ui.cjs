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
   assert.ok(await page.getByRole('combobox').filter({has:page.locator('option[value="2"]')}).count()>=1,
       'Project billing frequency missing');
   assert.ok(await page.locator('canvas[aria-label="Površina za podpis"]').count()===1,'Signature pad not visible');
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
   assert.equal(await page.locator('.ob-measure-card').count(),1,'A blank row must already be open');
   await page.locator('.ob-measure-card').first().waitFor();
   await page.locator('.ob-measure-card label').filter({hasText:'Vgrajena masa (kg)'}).locator('input').fill('23,5');
   await page.locator('.ob-measure-grandtotal').getByText(/23,500|23\.500/).waitFor();
   await page.getByRole('button',{name:/Dodaj vrstico/}).first().click();
   assert.equal(await page.locator('.ob-measure-card').count(),2);
   assert.equal(await page.locator('.ob-measure-card.ob-collapsed').count(),1,'Old row should collapse');
   const folded=page.locator('.ob-measure-card.ob-collapsed');
   assert.equal(await folded.locator('.ob-expanded-row').count(),0,'Collapsed row still shows input fields or formula');
   assert.equal(await folded.locator('input').count(),0,'Collapsed row must not render any inputs');
   assert.equal(await folded.getByRole('button',{name:/Odstrani vrstico/}).count(),1,'Remove button must remain visible on collapsed row');
   const foldedBounds=await folded.boundingBox();
   assert.ok(foldedBounds.height<75,'Collapsed row is not a single compact line: '+foldedBounds.height);
   await page.locator('.ob-measure-card.ob-expanded').getByRole('button',{name:/Odstrani vrstico/}).click();
   assert.equal(await page.locator('.ob-measure-card.ob-expanded').count(),1,'Remaining row should reopen after deleting the active row');
   await page.locator('.ob-measure-grandtotal').getByText(/23,500|23\.500/).waitFor();
   await page.locator('.ob-measure-card label').filter({hasText:'Številke armaturnih pozicij'}).locator('input').fill('4, 7, 12');
   assert.ok(await page.locator('.ob-measure-card').getByText(/Razčlenitev po premerih/).count()>0,'Armature diameter breakdown option missing');
   await page.getByRole('button',{name:/Zapri postavko|Zatvori postavku/}).first().click();
   await page.locator('.items-table tbody tr').nth(1).click();
   assert.equal(await page.locator('.ob-measure-card').count(),1,'New m³ item should already have an open row');
   for(const [name,value] of [['a (m)','8,35'],['b (m)','19,62'],['c (m)','0,20']]){
     await page.locator('.ob-measure-card label').filter({hasText:name}).first().locator('input').fill(value);
   }
   await page.locator('.ob-measure-grandtotal').getByText(/32,765|32\.765/).waitFor();
   await page.locator('.ob-formula-input').fill('a*(b+c)*2kos');
   await page.locator('.ob-measure-grandtotal').getByText(/330,994/).waitFor({timeout:5000});
   assert.deepEqual(failures,[],'Page errors in quantity and reinforcement editors');

   await page.getByRole('button',{name:/Shrani izmero|Spremi izmjeru/}).first().click();
   await page.locator('.drawer').waitFor({state:'detached',timeout:7000});
   assert.equal(await page.locator('.items-table').count(),1,'After save should return to popis');
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('obracun-webapp-v1')));
   assert.ok(saved.entries.length===1,'The measurement must be stored');
   assert.ok(Math.abs(saved.entries[0].quantity-330.994)<0.00001,'Stored quantity mismatch');
   await page.locator('.items-table tbody tr').nth(1).click();
   await page.getByRole('button',{name:/Izvozi ta list|Izvezi ovaj list/}).click();
   await page.getByText('Dodaj druge postavke v isti PDF').waitFor({timeout:5000});
   assert.ok(await page.locator('.ob-export-choice').count()>=2,'Missing selectable other sheets');
   assert.deepEqual(failures,[],'Errors after saving and opening PDF selection');

   // A4 proof: empty and populated measurement sheets must retain the full-height work box
   // and the signature block at the bottom in both preview and print media.
   const makeSheet=async (itemId,includeEmpty)=>page.evaluate(async ({itemId,includeEmpty})=>{
     const state=JSON.parse(localStorage.getItem('obracun-webapp-v1'));
     return window.OBR_ENGINEERING.buildReport({
       project:state.projects[0],items:state.items,entries:state.entries,proofs:[],
       month:'2026-11',selectedIds:[itemId],includeSummary:false,includeEmpty,
       getFile:async()=>null,fileToDataUrl:async()=>null
     });
   },{itemId,includeEmpty});
   const printPage=await browser.newPage({viewport:{width:1600,height:1200}});
   try{
     const measureLayout=()=>printPage.evaluate(()=>{
       const page=document.querySelector('.page.sheet');
       const ledger=document.querySelector('.page.sheet .ledger');
       const signatures=document.querySelector('.page.sheet .signatures');
       const p=page.getBoundingClientRect(),l=ledger.getBoundingClientRect(),s=signatures.getBoundingClientRect();
       return {
         pageHeight:p.height,ledgerHeight:l.height,signaturesHeight:s.height,
         signatureBottomGap:p.bottom-s.bottom,workToSignatureGap:s.top-l.bottom,
         leftBindingMargin:l.left-p.left,rightPaperMargin:p.right-l.right,
         signatureTopBorder:parseFloat(getComputedStyle(signatures).borderTopWidth),
         monthSubtotalTopBorder:parseFloat(getComputedStyle(document.querySelector('.page.sheet .subtotal')).borderTopWidth),
         overflow:page.scrollHeight-page.clientHeight
       };
     });
     const withData=await makeSheet('VOLUME_CI',false);
     await printPage.setContent(withData,{waitUntil:'load'});
     const populated=await measureLayout();
     assert.ok(populated.ledgerHeight>550,'Work box must occupy most of the printable page: '+JSON.stringify(populated));
     assert.ok(Math.abs(populated.signatureBottomGap-(7*96/25.4))<3,'Preview must show 7mm bottom paper margin: '+JSON.stringify(populated));
     assert.ok(Math.abs(populated.leftBindingMargin-(20*96/25.4))<3,'Preview lacks 20mm filing/binding margin: '+JSON.stringify(populated));
     assert.ok(Math.abs(populated.rightPaperMargin-(7*96/25.4))<3,'Preview lacks 7mm right margin: '+JSON.stringify(populated));
     assert.ok(populated.signatureTopBorder===0 && populated.monthSubtotalTopBorder===0,
       'Duplicate line at the end of measurement work area: '+JSON.stringify(populated));
     assert.ok(populated.workToSignatureGap>=0 && populated.workToSignatureGap<20,'Excess gap between work area and signature: '+JSON.stringify(populated));
     assert.ok(populated.overflow<=3,'Sheet content spills beyond A4: '+JSON.stringify(populated));
     await printPage.emulateMedia({media:'print'});
     const printGeometry=await measureLayout();
     assert.ok(Math.abs(printGeometry.signatureBottomGap)<3 && Math.abs(populated.ledgerHeight-printGeometry.ledgerHeight)<4,
       'Screen and print content geometry disagree: '+JSON.stringify({populated,printGeometry}));
     assert.ok(Math.abs(printGeometry.leftBindingMargin)<3 && Math.abs(printGeometry.rightPaperMargin)<3,
       'Print content should not have a second, duplicate margin: '+JSON.stringify(printGeometry));
     assert.ok(Math.abs(populated.pageHeight-297*96/25.4)<3 &&
       Math.abs(printGeometry.pageHeight-283*96/25.4)<3,
       'Expected A4 preview size and 283mm printable height: '+JSON.stringify({populated,printGeometry}));
     const pdf=await printPage.pdf({preferCSSPageSize:true,printBackground:true});
     assert.ok(pdf.subarray(0,5).toString()==='%PDF-','Printed PDF was not produced');
     await printPage.emulateMedia({media:'screen'});
     const withoutData=await makeSheet('STEEL_CI',true);
     await printPage.setContent(withoutData,{waitUntil:'load'});
     const empty=await measureLayout();
     assert.ok(Math.abs(populated.ledgerHeight-empty.ledgerHeight)<4,'Empty sheet lost its full-height work area: '+JSON.stringify({populated,empty}));
     assert.ok(Math.abs(empty.signatureBottomGap-populated.signatureBottomGap)<3,
       'Signatures moved on an empty sheet: '+JSON.stringify(empty));
   }finally{
     await printPage.close();
   }
   assert.deepEqual(failures,[],'Page errors during full-height A4 and collapsed-row tests');
   console.log('PASS: compact rows with persistent remove; full-height A4 with anchored signatures in screen and print.');

   console.log('PASS: real React UI rendered, click works, no browser errors.');
 }finally{
   if(browser)await browser.close();
   server.kill('SIGTERM');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
