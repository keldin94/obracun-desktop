const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
global.window=global;
require('../engineering.js');
const E=global.OBR_ENGINEERING;

test('Prestranek AB slab: raw sum rounds to 33,47 m³, not 33,48',()=>{
 const rows=[{label:'A',mode:'volume',a:'8,35',b:'19,62',h:'0,20',kos:'1'},{label:'B',mode:'volume',a:'0,20',b:'17,67',h:'0,20',kos:'1'}];
 assert.equal(E.calcRows(rows).toFixed(2),'33.47');
});
test('Reinforcing anchorage: 5 holes x 43 cm = 215 cm',()=>assert.equal(E.calcRows([{mode:'weight',a:'43',kos:'5'}]),215));
test('Area deductions use negative rows',()=>assert.equal(E.calcRows([{mode:'area',a:8,b:10},{mode:'area',a:2,b:3,sign:'-'}]),74));
test('Recognize real groups and reject explanatory paragraphs',()=>{
 assert.equal(E.heading('4. BETONSKA DELA','4.','em','0,00','0,00'),'Betonska dela');
 assert.equal(E.heading('5. TESARSKA DELA','5.','em','0','0'),'Tesarska dela');
 assert.equal(E.groupForPosition({code:'4.11.2',group:'Komplet z vsemi potrebnimi dodatnimi deli in materiali.',name:'Armaturne mreže'}),'Betonska dela');
});
test('Excel one sheet: two sections, exclude header/notes/zero quantity and price',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 const source=`const IMPORT_UNITS=new Set(['m³','m²','kg','kos','cm','em']); const window={OBR_ENGINEERING:eng}; function uid(){return 'test';} \n${section('function readSource(rows,baseRow,config,field){','function parsedPositions(rows,config,projectId,sheet,fileName){')}\n${section('function parsedPositions(rows,config,projectId,sheet,fileName){','function detectMappingRobust(rows){')}\nthis.output=parsedPositions(rows,config,'P1','GRADBENA DELA','test.xlsx')`;
 const rows=[['Code','Name','Unit','Qty','Price'],['4.','4. BETONSKA DELA','em',0,0],['4.6','AB plošča','m³','96,38','24,00'],['','Pri betoniranju upoštevati prevoze','',0,0],['5.','5. TESARSKA DELA','em',0,0],['5.3','Opaž AB plošče','m²','2,59','8,00']];
 const config={startRow:1,endRow:rows.length,map:{code:0,name:1,unit:2,qty:3,price:4,group:''},overrides:{},sources:{},defaultGroup:'Gradbena dela',includeEmpty:false};
 const context={eng:E,rows,config};vm.runInNewContext(source,context);const output=context.output;
 assert.equal(output.length,2);assert.equal(output[0].group,'Betonska dela');assert.equal(output[1].group,'Tesarska dela');
});
test('PDF contains required fields and month Nov 2026',async()=>{
 const project={id:'P',name:'DOZIDAVA K OŠ PRESTRANEK'},item={id:'I',projectId:'P',code:'4.6',name:'AB plošča',group:'Betonska dela',unit:'m³',contractQty:96.38,unitPrice:24};
 const q=E.calcRows([{mode:'volume',a:8.35,b:19.62,h:0.2,kos:1},{mode:'volume',a:0.2,b:17.67,h:0.2,kos:1}]);
 const html=await E.buildReport({project,items:[item],entries:[{itemId:'I',month:'2026-11',quantity:q,measurements:[{mode:'volume',a:8.35,b:19.62,h:0.2,kos:1}]}],proofs:[],month:'2026-11',groups:['Betonska dela'],getFile:async()=>null,fileToDataUrl:async()=>null});
 for(const field of ['Predračunska količina','Cena na enoto','Obračunska količina','NOVEMBAR','NAROČNIK','IZVAJALEC','33,47']){
  assert.ok(html.toUpperCase().includes(field.toUpperCase()),field);
 }
});

test('Slobodna formula koristi postojeće dimenzije i kos bez ponovnog upisivanja',()=>{
 const row={a:'8,35',b:'19,62',c:'0,20',kos:'1',formula:'a*x(b+c)x2kos'};
 const calc=E.evaluateVariables(row.formula,row);
 assert.equal(calc.value,8.35*(19.62+.2)*2);
 assert.equal(E.isValidRow(row),true);
 assert.equal(E.calcRow(row).result,calc.value);
 assert.match(E.calcRow(row).expression,/8\.35/);
});
test('Dodatna slova, odbici i armatura rade bez izvršavanja koda',()=>{
 const row={a:'5',kos:'1',q:'2',extraVariables:{e:'3'},formula:'a*(q+e)*kos',openings:'5',rebarPositions:'4, 5, 6'};
 assert.equal(E.calcRow(row).result,20);
 assert.equal(E.isValidRow(row),true);
 assert.equal(E.isValidRow({...row,formula:'a+unknown'}),false);
 assert.equal(E.isValidRow({...row,formula:'a/0'}),false);
 assert.equal(E.isValidRow({...row,formula:'alert(1)'}),false);
});
test('PDF sadrži odvojene Mesečna/Skupna kolone, opombe i oznake armature',async()=>{
 const project={id:'P',name:'Prestranek',client:'Glavni izvajalec'};
 const item={id:'I',projectId:'P',name:'Armatura',code:'4.11.1',notes:'Plošča nad pritličjem',group:'Betonska dela',unit:'kg',contractQty:2000,unitPrice:.45};
 const entries=[
  {itemId:'I',month:'2026-10',quantity:45},
  {itemId:'I',month:'2026-11',quantity:90,place:'Plošča',measurements:[{mode:'weight',a:'30',kos:'3',rebarPositions:'2, 5, 8'}]}
 ];
 const html=await E.buildReport({project,items:[item],entries,proofs:[],month:'2026-11',groups:['Betonska dela'],includeSummary:false,companyName:'Firma d.o.o.',getFile:async()=>null,fileToDataUrl:async()=>null});
 for(const t of ['ledger-month','ledger-cumulative','Mesečna','Skupna','135,00','90,00','Plošča nad pritličjem','Poz. armature','Firma d.o.o.']){
  assert.ok(html.includes(t),'Missing '+t);
 }
});
