/* Period-aware A4 reports: chronological rows, stable list numbers, dynamic columns. */
(function(root){
'use strict';
const E=root.OBR_ENGINEERING,P=root.OBR_PERIODS,esc=E.esc,num=E.num,money=E.money;
const filled=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
const dimensions=['a','b','c','h','d','q','r','t','kos'];
function sortRows(rows){return [...(rows||[])].sort((a,b)=>{
 const x=Number(a._seq),y=Number(b._seq),ax=filled(a._seq),by=filled(b._seq);
 return ax&&by?x-y:ax?1:by?-1:0;
});}
function linesFor(entries){
 return [...entries].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||
 String(a.createdAt||'').localeCompare(String(b.createdAt||''))).flatMap(e=>
  (e.measurements?.length?sortRows(e.measurements):[null]).map((row,j)=>({entry:e,row,j})));
}
function visibleKeys(lines){
 return dimensions.filter(k=>lines.some(({row})=>row&&filled(row[k])&&(k!=='kos'||row.mode!=='rebar')));
}
function numericFormula(calc){
 return String(calc.numericExpression||calc.expression||'').replace(/\*/g,' × ').replace(/\//g,' ÷ ')
  .replace(/\^/g,' ^ ').replace(/(\d)\.(\d)/g,'$1,$2').replace(/-/g,'−');
}
function tableOf(lines,all,unit){
 const cols=visibleKeys(all),w=cols.length*6.4,remaining=Math.max(18,58-w);
 const sizes=[9,15,...cols.map(()=>6.4),remaining,18];
 const head='<colgroup>'+sizes.map(n=>'<col style="width:'+n+'%">').join('')+'</colgroup>';
 const header='<thead><tr><th>Oznaka</th><th>Opis / lokacija</th>'+cols.map(k=>'<th>'+esc(k)+(k==='kos'?'':' (m)')+'</th>').join('')+
 '<th>Izračun</th><th>Količina</th></tr></thead>';
 const body=lines.map(({entry:e,row,j})=>{
  const calc=row?E.calcRow(row):null;
  const label=row?.label||e.place||e.description||String.fromCharCode(65+(Number(j)||0));
  const notes=row?[
    row.material?'Material: '+row.material:'',
    row.rebarPositions?'Pozicije armature: '+row.rebarPositions:'',
    row.rebarCategory?'Skupina: '+row.rebarCategory:'',
    ...(row.diameterBreakdown||[]).filter(x=>filled(x.kg)).map(x=>'Ø'+(x.fi||'—')+': '+x.kg+' kg')
  ].filter(Boolean).join(' · '):'';
  const formula=row?numericFormula(calc):String(e.expression||'').replace(/\*/g,' × ');
  const result=row?calc.result:E.n(e.quantity);
  return '<tr><td>'+esc(label)+'</td><td>'+esc(e.place||e.description||'')+(notes?'<small>'+esc(notes)+'</small>':'')+'</td>'+
   cols.map(k=>'<td class="number">'+(row&&filled(row[k])?esc(row[k]):'')+'</td>').join('')+
   '<td class="formula">'+esc(formula)+(formula?' = '+num(result,2):'')+'</td><td class="number"><b>'+num(result,2)+' '+esc(unit)+'</b></td></tr>';
 }).join('');
 return '<table class="measure">'+head+header+'<tbody>'+(body||'<tr><td colspan="'+(cols.length+4)+'">V tem obdobju ni izmer.</td></tr>')+'</tbody></table>';
}
function signatures(project){
 const good=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(project.preparedSignature||'')&&project.preparedSignature.length<1500000;
 const signed=good?'<img class="ink" src="'+project.preparedSignature+'" alt="Podpis sestavljavca"/>':'';
 function block(t,name,img){return '<div class="sign"><b>'+esc(t)+'</b><div class="sign-line">'+(img||'')+'<span>'+esc(name||'')+'</span></div><small>Ime in priimek, podpis</small></div>'}
 return '<div class="signatures">'+block('Sestavil',project.preparedBy,signed)+block('Naročnik',project.clientRepresentative,'')+block('Izvajalec',project.contractorManager,'')+'</div>';
}

function renderCollage(tiles,imageCache){
 if(!tiles.length)return '';
 const figures=tiles.map(({proof:p,box:b})=>{
  const src=imageCache[p.id],title=esc(p.caption||p.filename||'Skica');
  if(!src)return '<div class="collage-cell" style="left:'+b.x+'%;top:'+b.y+'%;width:'+b.w+'%;height:'+b.h+'%"><small>Priloga: '+title+'</small></div>';
  return '<figure class="collage-cell" style="left:'+b.x+'%;top:'+b.y+'%;width:'+b.w+'%;height:'+b.h+'%"><img src="'+src+'" alt="'+title+'"/><figcaption>'+title+'</figcaption></figure>';
 }).join('');
 return '<div class="collage-box">'+figures+'</div>';
}
const css='<style>'+
'@page{size:A4 portrait;margin:7mm 7mm 7mm 20mm}*{box-sizing:border-box}body{font:10px/1.3 Arial,sans-serif;color:#1b2835;background:#dce4ed;margin:0}'+
'.page{background:white;width:210mm;min-height:297mm;margin:0 auto 16px;padding:7mm 7mm 7mm 20mm;page-break-after:always;break-after:page}.page:last-child{break-after:auto;page-break-after:auto}'+
'.book-head{font-weight:bold;text-align:center;margin-bottom:6px;font-size:12px}.top,.bar,.measure{width:100%;border-collapse:collapse;table-layout:fixed}'+
'.top td,.bar td{border:1px solid #283541;padding:4px 5px;vertical-align:top;word-wrap:break-word}.top strong{display:block;font-size:10px}.th,.bar small{display:block;font-size:8px;color:#607084}'+
'.bar td{font-size:9px}.parties{font-size:8px;color:#556b7d;margin:4px 0 6px}.notes{margin-top:4px;color:#536478;font-size:8px;white-space:pre-wrap}'+
'.ledger{display:grid;grid-template-columns:minmax(0,1fr) 17mm 17mm;border:1px solid #263644}.main{min-width:0;padding:5px 6px;display:flex;flex-direction:column;gap:6px}'+
'.side{border-left:1px solid #263644;text-align:center}.side h3{font-size:8px;background:#edf1f4;padding:7px 2px;border-bottom:1px solid #263644;margin:0}.side b{display:block;margin:15px 1px 0;font-size:9px}.side small{display:block;font-size:7px;color:#64768a;margin-top:9px}'+
'.ledger-title{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #8ca0b0;font-size:9px;font-weight:bold;padding:5px 0}.ledger-title span:last-child{text-align:right}'+
'.measure th,.measure td{border-bottom:1px solid #dce5ee;padding:5px 3px;vertical-align:top;font-size:8px}.measure th{background:#edf1f5;overflow-wrap:anywhere;text-align:left}'+
'.measure .number{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.measure .formula{overflow-wrap:anywhere;word-break:break-word}.measure small{display:block;color:#5b6e80;font-size:7px;margin-top:2px}'+
'.subtotal{border-top:0;text-align:right;margin-top:auto;padding:6px 0;font-weight:bold}.subtotal b{margin-left:12px}'+
'.collage-box{position:relative;width:100%;flex:1 1 auto;min-height:30mm;overflow:hidden;margin-top:5px}.collage-cell{position:absolute;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:#fff;padding:1mm}.collage-cell img{display:block;object-fit:contain;width:100%;height:calc(100% - 11px);min-height:0}.collage-cell figcaption{flex:0 0 11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:7px;color:#536478}.collage-cell small{font-size:8px;color:#607084}.attachment-note{font:italic 8px/1.3 Arial,sans-serif;color:#536478;padding:2mm 0 0}.page.appendix{height:297mm;min-height:297mm;display:flex;flex-direction:column}.appendix-meta{font-size:9px;color:#566b7e;border-bottom:1px solid #ced9e4;padding:3mm 0 4mm}.appendix-title{font-size:13px;font-weight:700;text-align:center}.appendix-body{min-height:0;flex:1 1 auto;display:flex;flex-direction:column;border:1px solid #d6e0ea;margin-top:5mm;padding:4mm}.appendix-body .collage-box{min-height:0;margin:0;flex:1 1 auto}.appendix-footer{text-align:center;font-size:8px;color:#637587;margin-top:3mm}'+
'.signatures{display:flex;border:1px solid #293542;margin-top:6mm;min-height:25mm}.sign{width:33.333%;padding:5px;border-right:1px solid #293542;text-align:center;display:flex;flex-direction:column;justify-content:space-between}.sign:last-child{border:0}'+
'.sign b{font-size:9px}.sign small{font-size:7px;color:#657687}.sign-line{height:13mm;border-bottom:1px dotted #adb8c3;display:flex;align-items:flex-end;justify-content:center;position:relative}.sign-line span{font-size:9px}.ink{max-width:90%;max-height:12mm;object-fit:contain;position:absolute;bottom:2px;left:5%}'+
'.cover h1{font-size:22px;margin-bottom:10mm}.cover h2{font-size:15px}.cover table{border-collapse:collapse;width:100%;margin-top:9mm}.cover th,.cover td{padding:6px;border:1px solid #cbd5e1}.cover th{background:#eef3f6}'+
'@media screen{body{padding:14px}.page{box-shadow:0 3px 16px #182b3d30}}@media print{body{padding:0;background:white}.page{margin:0;width:auto;min-height:0;padding:0;page-break-after:always;break-after:page}.page:last-child{break-after:auto;page-break-after:auto}}'+
/* Physical A4 preview reserves 20mm for binding and 7mm on the other edges. */
'.page.sheet{display:flex;flex-direction:column;width:210mm;height:297mm;min-height:297mm;padding:7mm 7mm 7mm 20mm;overflow:visible}'+
'.page.sheet .book-head,.page.sheet .top,.page.sheet .bar,.page.sheet .parties{flex:0 0 auto}'+
'.page.sheet .ledger{flex:1 1 auto;min-height:0;align-self:stretch}'+
'.page.sheet .main{min-height:0}'+
'.page.sheet .subtotal{margin-top:auto}'+
'.page.sheet .signatures{flex:0 0 25mm;height:25mm;min-height:25mm;margin-top:0;border-top:0}'+
'@media print{.page.sheet,.page.appendix{width:183mm;height:283mm;min-height:283mm;padding:0;margin:0;break-inside:avoid;page-break-inside:avoid}'+
'.page.sheet .ledger{flex:1 1 auto;min-height:0}.page.sheet .signatures{flex:0 0 25mm}}'+
'</style>';
async function buildReport({project,items,entries,proofs,month,half=1,groups=[],selectedIds=[],includeEmpty=false,includeSummary=true,companyName='',getFile,fileToDataUrl}){
 if(!project?.id)throw Error('Izberi gradbišče.');
 const included=new Set(selectedIds),setGroups=new Set(groups);
 const chosen=(items||[]).filter(it=>it.projectId===project.id&&(!included.size||included.has(it.id))&&(!setGroups.size||setGroups.has(it.group)));
 const selected=chosen.filter(it=>includeEmpty||(entries||[]).some(e=>e.itemId===it.id&&P.belongs(e,project,month,half)));
 if(!selected.length)throw Error('Za izbrano obdobje ni izmer. Izberi tudi prazne liste.');
 const currentLabel=P.label(project,month,half),old=P.previous(project,month,half);
 const previousLabel=P.label(project,old.month,old.half);
 const allItems=(items||[]).filter(it=>it.projectId===project.id);
 let sheets='',summary='',total=0;
 for(const it of selected){
  const entriesOf=(entries||[]).filter(e=>e.itemId===it.id);
  const current=entriesOf.filter(e=>P.belongs(e,project,month,half));
  const previous=entriesOf.filter(e=>P.before(e,project,month,half)).reduce((t,e)=>t+E.n(e.quantity),0);
  const value=current.reduce((t,e)=>t+E.n(e.quantity),0),cum=previous+value;
  total+=value*E.n(it.unitPrice);
  summary+='<tr><td>'+esc(it.code)+'</td><td>'+esc(it.name)+'</td><td>'+esc(it.group)+'</td><td>'+esc(it.unit)+'</td><td>'+num(value)+'</td><td>'+money(value*E.n(it.unitPrice))+'</td></tr>';
  const pr=(proofs||[]).filter(p=>p.itemId===it.id&&(!p.month||p.month===month)&&
     (P.frequency(project)===1||!p.billingHalf||Number(p.billingHalf)===Number(half)));
  const planned=P.planPages(current,[]),allLines=linesFor(current);
  const collage=root.OBR_COLLAGE_LAYOUT.planImages(pr,it,allLines.length);
  const otherProofs=pr.filter(p=>!String(p.mime||'').startsWith('image/'));
  const imageCache={};
  for(const file of pr.filter(p=>String(p.mime||'').startsWith('image/'))){
   try{
    const f=await getFile(file.id);if(!f)continue;
    let uri=await fileToDataUrl(f);
    if(E.rotateImageData)uri=await E.rotateImageData(uri,file.rotation||0);
    imageCache[file.id]=uri;
   }catch{}
  }
  const bookNo=P.listPosition(it,allItems);
  for(let i=0;i<planned.length;i++){
   const page=planned[i],isLast=i===planned.length-1;
   const pictures=i===0?renderCollage(collage.main,imageCache):'';
   sheets+='<section class="page sheet" data-item="'+esc(it.id)+'" data-list="'+bookNo+'" data-page="'+(i+1)+'">'+
    '<div class="book-head">OBRAČUNSKI LIST št. '+bookNo+' · Stran '+(i+1)+'</div>'+
    '<table class="top"><tr><td style="width:25%"><span class="th">Objekt</span><strong>'+esc(project.name)+'</strong>'+esc(project.location||'')+
    '<div class="notes">Obračunski načrt: '+esc(project.planRef||'—')+'</div></td>'+
    '<td style="width:51%"><span class="th">Opis del – Postavka</span><strong>'+esc(it.code+' '+it.name)+'</strong>'+
    (it.notes?'<div class="notes">'+esc(it.notes)+'</div>':'')+'</td>'+
    '<td style="width:24%"><span class="th">Predračunska postavka</span><strong>'+esc(it.group)+'</strong>'+esc(it.code)+
    '<div class="notes">Stroškovno mesto: '+esc(project.costCenter||'—')+'</div></td></tr></table>'+
    '<table class="bar"><tr><td><small>Priloge</small>'+pr.length+'</td><td><small>Enota mere</small><b>'+esc(it.unit)+'</b></td>'+
    '<td><small>Predračunska količina</small><b>'+num(it.contractQty)+' '+esc(it.unit)+'</b></td>'+
    '<td><small>Cena na enoto</small><b>'+money(it.unitPrice)+'</b></td>'+
    '<td><small>Obračun: '+esc(currentLabel)+'</small><b>'+num(value)+' '+esc(it.unit)+'</b></td>'+
    '<td><small>Skupna</small><b>'+num(cum)+' '+esc(it.unit)+'</b></td></tr></table>'+
    '<div class="parties">Naročnik: '+esc(project.client||'—')+' &nbsp; | &nbsp; Izvajalec: '+esc(project.contractor||companyName||'—')+' &nbsp; | &nbsp; Obračun za obdobje: <strong>'+esc(currentLabel)+'</strong></div>'+
    '<div class="ledger"><div class="main">'+
    '<div class="ledger-title"><span>Skice, izmere, izračuni</span><span>Prenos: '+esc(previousLabel)+' · '+num(previous)+' '+esc(it.unit)+'</span></div>'+
    tableOf(page.rows,allLines,it.unit)+pictures+
    (i===0&&collage.appendices.length?'<div class="attachment-note">Dodatne skice so prikazane v prilogah k temu obračunskemu listu.</div>':'')+
    (i===0&&otherProofs.length?'<div class="attachment-note">Druge priloge (PDF): '+esc(otherProofs.map(p=>p.caption||p.filename).join(', '))+'</div>':'')+
    (isLast?'<div class="subtotal">Mesečna: <b>'+num(value)+' '+esc(it.unit)+'</b></div>':'')+
    '</div><div class="side"><h3>Mesečna</h3><b>'+num(value)+'<br/>'+esc(it.unit)+'</b><small>Obračun:<br/>'+esc(currentLabel)+'</small></div>'+
    '<div class="side"><h3>Skupna</h3><b>'+num(cum)+'<br/>'+esc(it.unit)+'</b><small>Prejšnje: '+num(previous)+'</small></div></div>'+
    signatures(project)+'</section>';
  }
  for(let a=0;a<collage.appendices.length;a++){
   const tiles=collage.appendices[a];
   sheets+='<section class="page appendix" data-item="'+esc(it.id)+'" data-appendix="'+(a+1)+'">'+
    '<div class="appendix-title">PRILOGA K OBRAČUNSKEMU LISTU št. '+bookNo+' · Stran '+(a+1)+'</div>'+
    '<div class="appendix-meta">'+esc(project.name)+' · '+esc(it.code+' '+it.name)+' · '+esc(currentLabel)+'</div>'+
    '<div class="appendix-body">'+renderCollage(tiles,imageCache)+'</div>'+
    '<div class="appendix-footer">Priloga k obračunskemu listu št. '+bookNo+' — ni samostojen obračunski list.</div>'+
    '</section>';
  }
 }
 const cover=includeSummary?'<section class="page cover"><h1>KNJIGA OBRAČUNSKIH IZMER</h1><h2>'+esc(project.name)+'</h2>'+
  '<p>Obračun: '+esc(currentLabel)+'</p><table><thead><tr><th>Šifra</th><th>Postavka</th><th>Skupina</th><th>EM</th><th>Mesečna</th><th>Vrednost</th></tr></thead>'+
  '<tbody>'+summary+'</tbody></table><h2>Skupaj za obdobje: '+money(total)+'</h2></section>':'';
 return '<!doctype html><html lang="sl"><head><meta charset="utf-8">'+css+'</head><body>'+cover+sheets+'</body></html>';
}
E.buildReport=buildReport;
E.reportVisibleKeys=visibleKeys;
E.reportSortedRows=sortRows;
})(typeof window!=='undefined'?window:globalThis);
