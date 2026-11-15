const test=require('node:test');
const assert=require('node:assert/strict');
global.window=global;
require('../engineering.js');
require('../periods.js');
require('../collage-layout.js');
require('../report-v2.js');
const E=global.OBR_ENGINEERING,P=global.OBR_PERIODS;
const project={id:'p',name:'Testno gradbišče',billingFrequency:2,
 preparedBy:'Sestavljavec',preparedSignature:'data:image/png;base64,iVBORw0KGgo='};
const items=[
 {id:'i1',projectId:'p',code:'4.1',name:'Prvo delo',group:'Betonska dela',unit:'m³',contractQty:40,unitPrice:20},
 {id:'i2',projectId:'p',code:'4.2',name:'Drugo delo',group:'Betonska dela',unit:'m³',contractQty:30,unitPrice:20},
 {id:'i3',projectId:'p',code:'4.3',name:'Tretje delo',group:'Betonska dela',unit:'m³',contractQty:10,unitPrice:20}
];
const entries=[
 {id:'old',projectId:'p',itemId:'i3',date:'2026-10-30',month:'2026-10',quantity:4,measurements:[{_seq:1,a:'2',b:'2',c:'1',kos:'1',mode:'cubic'}]},
 {id:'first',projectId:'p',itemId:'i3',date:'2026-11-10',month:'2026-11',quantity:6,measurements:[{_seq:1,a:'1',b:'3',c:'2',kos:'1',mode:'cubic'}]},
 {id:'second',projectId:'p',itemId:'i3',date:'2026-11-20',month:'2026-11',billingHalf:2,quantity:8,
 measurements:[{_seq:2,a:'3',b:'2',c:'2',kos:'1',mode:'cubic',label:'B'},{_seq:1,a:'1',b:'3',c:'1',kos:'1',mode:'cubic',label:'A'}]}
];
test('Period 1 and 2 of November split at the 15th; old data preserved',()=>{
 assert.equal(P.frequency({}),1);
 assert.equal(P.fromDate('2026-11-15',project).half,1);
 assert.equal(P.fromDate('2026-11-16',project).half,2);
 assert.equal(P.previous(project,'2026-11',1).month,'2026-10');
 assert.equal(P.previous(project,'2026-11',1).half,2);
 assert.equal(P.previous(project,'2026-11',2).month,'2026-11');
 assert.equal(P.previous(project,'2026-11',2).half,1);
 assert.equal(P.belongs(entries[1],project,'2026-11',1),true);
 assert.equal(P.belongs(entries[1],project,'2026-11',2),false);
 assert.equal(P.belongs(entries[2],project,'2026-11',2),true);
 assert.equal(P.before(entries[1],project,'2026-11',2),true);
 assert.equal(P.label(project,'2026-11',1),'November 2026/1');
 assert.equal(P.label({billingFrequency:1},'2026-11',1,true),'November 2026');
});
test('Original index from all popis items determines sheet number',()=>{
 assert.equal(P.listPosition(items[2],items),3);
 assert.equal(P.listPosition(items[1],items),2);
});
test('PDF for a single selected popis position keeps list no 3, labels, aligned dimension columns and signature',async()=>{
 const html=await E.buildReport({project,items,entries,proofs:[],month:'2026-11',half:2,
   groups:['Betonska dela'],selectedIds:['i3'],includeSummary:false,
   getFile:async()=>null,fileToDataUrl:async()=>null});
 assert.ok(html.includes('OBRAČUNSKI LIST št. 3 · Stran 1</div>'),html.slice(0,600));
 assert.ok(!html.includes('Stran 1 / 1'),'No total page count in sheet header');
 assert.ok(html.includes('Obračun: November 2026/2'),'Period label');
 assert.ok(html.includes('Prenos: November 2026/1'),'Previous period');
 assert.ok(html.includes('>14,00</')===false,'Quantity is tested with exact 8');
 assert.ok(html.includes('>8,00<'),'Current quantity');
 assert.ok(html.includes('>18,00<'),'Cumulative quantity');
 assert.ok(html.includes('>a (m)</th>')&&html.includes('>b (m)</th>')&&html.includes('>c (m)</th>'));
 assert.ok(!html.includes('>h (m)</th>'),'No undefined h column');
 assert.ok(html.includes('1 × 3 × 1 × 1')&&html.includes('3 × 2 × 2 × 1'),'Full numeric formulas for both rows');
 assert.ok(html.indexOf('1 × 3 × 1 × 1')<html.indexOf('3 × 2 × 2 × 1'),'Older row is first');
 assert.ok(html.includes('class="ink"'),'Blue signature included');
 assert.ok(html.includes('Obračun za obdobje: <strong>November 2026/2</strong>'),
    'Period must appear alongside Naročnik and Izvajalec');
 assert.ok(html.includes('@page{size:A4 portrait;margin:7mm 7mm 7mm 20mm}'),
    'A4 print must reserve 20mm on the binding edge and 7mm elsewhere');
 assert.ok(html.includes('width:183mm;height:283mm;min-height:283mm'),
    'Printable A4 content must match the new margin dimensions');
 assert.ok(html.includes('.page.sheet{display:flex;flex-direction:column;width:210mm;height:297mm'),
    'Preview must show the entire physical A4 paper');
 assert.ok(html.includes('.page.sheet .signatures{flex:0 0 25mm;height:25mm;min-height:25mm;margin-top:0;border-top:0}'),
    'Signature section must share only the ledger border at its top');

 assert.ok(!html.includes('SKUPAJ:')&&!html.includes('Skupna: <b>'),'No duplicate totals');
});
test('Print pages are deterministically split and individually numbered',async()=>{
 const many=Array.from({length:43},(_,j)=>({id:'id'+j,itemId:'i3',projectId:'p',
 date:'2026-11-20',month:'2026-11',billingHalf:2,quantity:1,
 measurements:[{_seq:1,a:'1',b:'1',c:'1',kos:'1',mode:'cubic'}]}));
 const html=await E.buildReport({project,items,entries:many,proofs:[],month:'2026-11',half:2,
   selectedIds:['i3'],includeSummary:false,getFile:async()=>null,fileToDataUrl:async()=>null});
 assert.ok(html.includes('Stran 1</div>')&&html.includes('Stran 2</div>')&&html.includes('Stran 3</div>'));
 assert.ok(!/Stran [1-9]+\s*\//.test(html),'Do not show total page count');
 assert.equal((html.match(/class="page sheet"/g)||[]).length,3);
});

test('Extra sketches become linked appendix pages instead of new invoice sheets',async()=>{
 const proofs=Array.from({length:8},(_,i)=>({
  id:'proof'+i,itemId:'i3',projectId:'p',month:'2026-11',billingHalf:2,
  filename:'Skica '+(i+1)+'.png',caption:'Skica '+(i+1),mime:'image/png',createdAt:'2026-11-22'
 }));
 const html=await E.buildReport({project,items,entries,proofs,month:'2026-11',half:2,
  selectedIds:['i3'],includeSummary:false,getFile:async()=>null,fileToDataUrl:async()=>null});
 assert.equal((html.match(/class="page sheet"/g)||[]).length,1);
 assert.equal((html.match(/class="page appendix"/g)||[]).length,1);
 assert.ok(html.includes('PRILOGA K OBRAČUNSKEMU LISTU št. 3 · Stran 1'));
 assert.ok(html.includes('Dodatne skice so prikazane v prilogah'));
});
