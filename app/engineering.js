/* OBRAČUN Engineering v0.3 — dimension rows, bill sections, and A4 measurement sheets.
   No server dependencies. Pure calculations keep full precision until display. */
(function () {
'use strict';
const GROUPS=['Betonska dela','Tesarska dela','Zidarska dela','Zemeljska dela','Rušitvena dela','Pripravljalna dela','Hidroizolacije','Fasaderska dela','Krovska dela','Kleparska dela','Ključavničarska dela','Stavbno pohištvo','Strojne inštalacije','Elektroinštalacije','Obrtniška dela','Ostala dela'];
const SECTION_HINTS={4:'Betonska dela',5:'Tesarska dela',6:'Zidarska dela'};
const n = v => {if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');s=s.replace(/[^\d.\-+]/g,'');const x=Number(s);return Number.isFinite(x)?x:0;};
const num=(v,d=2)=>new Intl.NumberFormat('sl-SI',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v)||0);
const money=v=>num(v,2)+' €';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s=>String(s||'').replace(/\s+/g,' ').trim();
const norm = s=>normalize(s).toLocaleLowerCase('sl-SI');
function groupFromHeading(str){
  const s=norm(str).replace(/^\s*(?:[a-z]\.|\d+(?:[.,]\d+)*[.])\s*/, '');
  if(/betonsk|armiranobetonsk/.test(s) && /del|radov|dela/.test(s))return 'Betonska dela';
  if(/tesarsk|opažersk|opazersk/.test(s) && /del|radov|dela/.test(s))return 'Tesarska dela';
  if(/zidarsk/.test(s))return 'Zidarska dela';
  if(/zemeljsk|izkop/.test(s) && /del|radov|dela/.test(s))return 'Zemeljska dela';
  if(/rušit|rušen|rusit/.test(s))return 'Rušitvena dela';
  if(/pripravljal/.test(s))return 'Pripravljalna dela';
  if(/hidroizolacij/.test(s))return 'Hidroizolacije';
  if(/fasadersk/.test(s))return 'Fasaderska dela';
  if(/krovsk/.test(s))return 'Krovska dela';
  if(/kleparsk/.test(s))return 'Kleparska dela';
  if(/ključavničarsk|kljucavnicarsk/.test(s))return 'Ključavničarska dela';
  if(/stavbno pohištv/.test(s))return 'Stavbno pohištvo';
  if(/strojn.*inštal|strojn.*instal/.test(s))return 'Strojne inštalacije';
  if(/elektro.*inštal|elektro.*instal/.test(s))return 'Elektroinštalacije';
  if(/obrtnišk/.test(s))return 'Obrtniška dela';
  if(/ostala dela|razna dela/.test(s))return 'Ostala dela';
  return null;
}
function heading(name,code,unit,qty,price){
  const raw=normalize(name);
  const titled=raw.replace(/^\d+(?:[.,]\d+)*[.]\s*/,'');
  const strict=groupFromHeading(titled);
  const upperLetters=titled.replace(/[^\p{L}]/gu,'');
  const uppercase=upperLetters.length>=5 && upperLetters===upperLetters.toLocaleUpperCase('sl-SI');
  const sectionCode=/^\d+[.]?$/.test(normalize(code))||/^\d+[.]\s/.test(raw);
  const noNumbers=n(qty)===0&&n(price)===0;
  const noUnit=!unit||!['m','m1','m2','m3','m²','m³','kg','t','kom','kos','h','ur','kpl','paušal','cm'].includes(norm(unit));
  return (strict&&(noNumbers||sectionCode||uppercase)) ? strict : ((uppercase&&sectionCode&&noNumbers&&noUnit)?'':null);
}
function groupForPosition({code='',name='',group='',fallback='Ostala dela',sectionMap={}}={}){
  const input=normalize(group);
  const known=GROUPS.find(x=>norm(x)===norm(input));if(known)return known;
  const section=String(code).trim().match(/^(\d+)[.]/)?.[1];
  if(section && sectionMap[section])return sectionMap[section];
  if(section && SECTION_HINTS[section] && (!input||input.length>55||/komplet|upoštevati|nabava|vgradnja|sist|transport|gradbenih|obstoječ/i.test(input)))return SECTION_HINTS[section];
  const title=groupFromHeading(input);if(title)return title;
  if(input.length<=40 && !/[.;]/.test(input)&& !/^(pri|komplet|upoštev|nabava|dobava|vgradnja|sist|načrt|transport)/i.test(input))return input;
  if(section&&SECTION_HINTS[section])return SECTION_HINTS[section];
  const desc=norm(name);
  if(/opaž|opaž|opaz|šalov|tesar/.test(desc))return 'Tesarska dela';
  if(/beton|armatur|sidranje|diamantno vrtanje/.test(desc))return 'Betonska dela';
  if(/zidanje|zidars/.test(desc))return 'Zidarska dela';
  return GROUPS.includes(fallback)?fallback:'Ostala dela';
}
// Safe calculator for expressions containing measurements (no eval / Function).
// Allows +, -, *, /, brackets and variables such as a,b,c,h,d,q,r,t,kos.
function evaluateVariables(expression, row={}) {
 const vars={};
 for(const key of ['a','b','c','h','d','q','r','t','kos']){
  const raw=key==='kos' && (row.kos===''||row.kos==null)?'1':row[key];
  if(raw!=='' && raw!==undefined && raw!==null){
   if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(String(raw).trim()))throw Error('Neispravna dimenzija: '+key);
   vars[key]=Number(String(raw).replace(',','.'));
  }
 }
 for(const [key,raw] of Object.entries(row.extraVariables||{})){
  const k=key.trim().toLowerCase();
  if(!/^[a-z_][a-z0-9_]{0,11}$/.test(k)||k==='x'||k==='kos')throw Error('Neispravna dodatna varijabla: '+key);
  if(raw!=='' && raw!=null){
   if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(String(raw).trim()))throw Error('Neispravna vrijednost varijable '+key);
   vars[k]=Number(String(raw).replace(',','.'));
  }
 }
 let src=String(expression||'').trim();
 if(!src||src.length>320)throw Error('Upiši formulu do 320 znakova');
 // x/X is a multiplication symbol in construction notation; 2kos = 2 * kos.
 src=src.replace(/[×·∙xX]/g,'*').replace(/(\d),(\d)/g,'$1.$2').replace(/\s+/g,'')
   .replace(/(\d)([a-zA-Z_])/g,'$1*$2').replace(/([a-zA-Z0-9_])\(/g,'$1*(')
   .replace(/\)([a-zA-Z0-9_(])/g,')*$1').replace(/\*{2,}/g,'*');
 let at=0,tokens=[],match;
 const token=/\d+(?:\.\d+)?|[a-zA-Z_][a-zA-Z0-9_]*|[()+*/-]/y;
 while(at<src.length){
  token.lastIndex=at;match=token.exec(src);
  if(!match||match.index!==at)throw Error('Neispravan znak u formuli: '+src.slice(at,at+3));
  tokens.push(match[0]);if(tokens.length>150)throw Error('Formula je preduga');at=token.lastIndex;
 }
 if(!tokens.length)throw Error('Prazna formula');
 let k=0;const peek=()=>tokens[k];const take=x=>peek()===x?(k++,true):false;
 function atom(){
  if(take('+'))return atom();
  if(take('-'))return -atom();
  if(take('(')){const v=sum();if(!take(')'))throw Error('Nedostaje zatvorena zagrada');return v;}
  const t=tokens[k++];
  if(!t)throw Error('Nedostaje broj ili varijabla');
  if(/^\d/.test(t))return Number(t);
  if(/^[a-zA-Z_]/.test(t)){
    const key=t.toLowerCase();if(!Object.hasOwn(vars,key))throw Error('Upiši vrijednost varijable: '+t);
    return vars[key];
  }
  throw Error('Neispravan izraz blizu '+t);
 }
 function product(){
  let v=atom();
  while(peek()==='*'||peek()==='/'){
   const op=tokens[k++],r=atom();
   if(op==='/'&&r===0)throw Error('Dijeljenje nulom');
   v=op==='*'?v*r:v/r;
  }return v;
 }
 function sum(){
  let v=product();
  while(peek()==='+'||peek()==='-'){
   const op=tokens[k++],r=product();v=op==='+'?v+r:v-r;
  }return v;
 }
 const value=sum();
 if(k<tokens.length||!Number.isFinite(value))throw Error('Neispravna formula');
 const numeric=src.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,t=>String(vars[t.toLowerCase()]??t));
 return {value,numeric,variables:vars,normalized:src};
}
function isValidRow(row){
 if(String(row.formula||'').trim()){
   try{evaluateVariables(row.formula,row);return true}catch{return false}
 }
 const modes={volume:['a','b','h'],cubic:['a','b','c'],area:['a','b'],wall:['a','h'],thickness:['a','b','d'],length:['a'],pieces:['kos'],weight:['a','kos'],manual:['direct']};
 return (modes[row.mode||'volume']||modes.volume).every(key=>/^[-+]?\d+(?:[.,]\d+)?$/.test(String(row[key]??'').trim()));
}
function calcRow(row) {
 const mode=row.mode||'volume',custom=String(row.formula||'').trim();
 const count=(row.kos===undefined||row.kos==='')?1:n(row.kos);
 const dims={a:n(row.a),b:n(row.b),c:n(row.c),h:n(row.h),d:n(row.d)};
 const templates={volume:['a','b','h'],cubic:['a','b','c'],area:['a','b'],wall:['a','h'],thickness:['a','b','d'],length:['a'],pieces:['kos'],weight:['a','kos'],manual:[]};
 let result,expression,numericExpression,issue='';
 if(custom){
  try{
   const evaluated=evaluateVariables(custom,row);
   result=evaluated.value;
   expression=custom+' = '+evaluated.numeric;
   numericExpression=evaluated.numeric;
  }catch(e){issue=e.message;result=NaN;expression=custom;numericExpression='0'}
 }else{
  const vars=(templates[mode]||templates.volume).slice();
  const parts=vars.map(v=>v==='kos'?count:dims[v]);
  if(mode!=='pieces'&&mode!=='weight'&&mode!=='manual')parts.push(count);
  result=mode==='manual'?n(row.direct):parts.reduce((a,b)=>a*b,1);
  if(mode!=='manual' && !vars.length)result=0;
  expression=mode==='manual'?String(n(row.direct)):parts.map(x=>String(x)).join(' × ');
  numericExpression=mode==='manual'?String(n(row.direct)):parts.join('*');
 }
 const openings=n(row.openings);if(openings){result-=openings;expression+=' − '+openings;numericExpression+='-('+openings+')'}
 const negative=(row.sign||'+')==='-';
 if(negative){result=-result;expression='− ('+expression+')';numericExpression='-('+numericExpression+')'}
 return {result,expression,numericExpression,label:normalize(row.label||row.place||''),error:issue};
}
function calcRows(rows){return (rows||[]).reduce((sum,row)=>sum+calcRow(row).result,0)}
function mathExpression(rows){return (rows||[]).map(r=>{const c=calcRow(r);return c.numericExpression||'0'}).join(' + ')||''}
function renderEntryRow(e,unit){
 const rows=e.measurements||[];
 if(!rows.length)return `<tr><td>${esc(e.place||'')}</td><td>${esc(e.description||'')}</td><td colspan="7" class="formula-cell">${esc(e.expression||'')}</td><td class="right"><b>${num(e.quantity)} ${esc(unit)}</b></td></tr>`;
 return rows.map((r,j)=>{const c=calcRow(r);return `<tr><td>${esc(r.label||String.fromCharCode(65+j))}</td><td>${esc(e.place||e.description||'')}${r.material?'<small class="muted">'+esc(r.material)+'</small>':''}</td>`+
   ['a','b','c','h','d'].map(k=>`<td class="right">${r[k]!==undefined&&r[k]!==''?esc(String(r[k])):'—'}</td>`).join('')+
   `<td class="right">${esc(String(r.kos||'1'))}</td><td class="formula-cell">${esc(c.expression)}</td><td class="right"><b>${num(c.result)} ${esc(unit)}</b></td></tr>`}).join('');
}
async function buildReport({project,items,entries,proofs,month,groups,selectedIds,includeEmpty=false,includeSummary=true,getFile,fileToDataUrl}){
 const itemSet=new Set(selectedIds||[]),groupSet=new Set(groups||[]);
 const selected=(items||[]).filter(it=>it.projectId===project.id &&(!groupSet.size||groupSet.has(it.group))&&(!itemSet.size||itemSet.has(it.id))).filter(it=>includeEmpty||(entries||[]).some(e=>e.itemId===it.id&&e.month===month));
 if(!selected.length)throw Error('U izabranom mjesecu nema obračunskih unosa za odabrane postavke. Uključi „Ispis praznih listova“ ako želiš sve.');
 const monthTitle=new Intl.DateTimeFormat('bs-BA',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));
 const dateLabel=monthTitle.charAt(0).toUpperCase()+monthTitle.slice(1);
 let pages='',summaryRows='',total=0;
 const css=`<style>
 @page { size:A4 portrait; margin:12mm 12mm 12mm 12mm; }
 *{box-sizing:border-box}body{margin:0;color:#151d27;background:white;font:10px/1.3 Arial,sans-serif}
 h1,h2,h3,p{margin:0}.page{page-break-after:always;break-after:page;min-height:264mm;display:flex;flex-direction:column}
 .page:last-child{page-break-after:auto;break-after:auto}.book-head{text-align:center;font-weight:bold;font-size:13px;margin-bottom:6px}
 .top-grid{width:100%;table-layout:fixed;border-collapse:collapse;border:1.2px solid #1f2937}
 .top-grid td{border:1px solid #232a35;vertical-align:top;padding:4px 6px;word-wrap:break-word}
 .top-grid .th{font-size:9px;color:#54616d;display:block}.top-grid strong{display:block;font-size:10px}
 .account-bar{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:0}
 .account-bar td{border:1px solid #273244;padding:4px 5px;vertical-align:top}
 .account-bar small{display:block;color:#566576;font-size:8px}.account-bar b{font-size:10px}
 .sec-head{margin-top:9px;font-size:10px;font-weight:bold;display:flex;justify-content:space-between;border-bottom:1px solid #9aa7b3;padding-bottom:3px}
 .measure{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}
 .measure th,.measure td{border-bottom:1px solid #e3e8ed;padding:5px 3px;vertical-align:top}
 .measure th{background:#eff3f7;color:#293b4d;text-align:left;font-size:8px}.measure td{font-size:9px}
 .measure .right{text-align:right;white-space:nowrap}.measure .formula-cell{word-break:break-word;font-size:8px}
 .subtotals{display:flex;justify-content:flex-end;margin:8px 0 7px}.subtotals>div{min-width:43%;border-top:1px solid #233;text-align:right;padding:6px}
 .subtotals b{margin-left:20px}.proofs{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;padding-top:7px}
 figure{margin:0;flex:1 1 45%;max-width:100%;break-inside:avoid;page-break-inside:avoid}
 figure img{display:block;margin:0 auto;max-width:100%;max-height:105mm;object-fit:contain;border:1px solid #d8dee6}
 figcaption{font-size:8px;color:#485a70;text-align:center;padding-top:3px;max-height:22px;overflow:hidden}
 .attachments{margin-top:7px;font-size:8px;color:#546475}.attachments em{font-style:normal;color:#7a5540}
 .spacer{flex:1 1 auto;min-height:12px}.foot-total{text-align:right;padding:8px 0 15px;font-weight:bold}
 .signatures{display:flex;border:1px solid #29323e;min-height:58px}.signature{width:33.333%;text-align:center;border-right:1px solid #29323e;padding:7px 5px;display:flex;flex-direction:column;justify-content:space-between}.signature:last-child{border-right:0}.signature .sub{font-size:8px}.signature .line{border-bottom:1px dotted #999;margin:10px 7px 1px}.signature small{color:#617182;font-size:8px}
 .cover h1{font-size:25px;margin:8mm 0 3mm}.cover h2{font-size:16px;margin:4mm 0}.cover .period{font-weight:700;font-size:14px;margin:5mm 0}.cover .recap{width:100%;border-collapse:collapse;margin-top:10mm}
 .cover .recap th,.cover .recap td{padding:7px;border:1px solid #d6dde4;text-align:left}.cover .recap th{background:#e6eef3}.cover .recap td:last-child{text-align:right}
 .muted{color:#57697d}.annex{font-size:9px;display:inline-block;background:#edf4f1;padding:3px 5px;margin-top:4px}
 @media screen {body{background:#d8e0e8;padding:20px}.page{background:white;width:210mm;padding:12mm;margin:0 auto 14px;box-shadow:0 6px 20px #33445530;min-height:297mm}}
 @media print{body{margin:0;padding:0;background:white}.page{min-height:270mm;padding:0;box-shadow:none;width:auto;margin:0}figure img{max-height:97mm}}
 </style>`;
 for(let i=0;i<selected.length;i++){
  const it=selected[i],all=(entries||[]).filter(e=>e.itemId===it.id&&e.month<=month),current=all.filter(e=>e.month===month),before=all.filter(e=>e.month<month).reduce((a,e)=>a+n(e.quantity),0);
  const value=current.reduce((a,e)=>a+n(e.quantity),0),cumul=before+value;total+=value*n(it.unitPrice);
  summaryRows+=`<tr><td>${esc(it.code)}</td><td>${esc(it.name)}</td><td>${esc(it.group)}</td><td>${esc(it.unit)}</td><td>${num(value)}</td><td>${money(value*n(it.unitPrice))}</td></tr>`;
  const attachments=(proofs||[]).filter(p=>p.itemId===it.id&&(!p.month||p.month===month));
  let imageHTML='',remaining=[];
  for(const p of attachments){
   if(!(p.mime||'').startsWith('image/')){remaining.push(p.filename);continue}
   try{const file=await getFile(p.id);if(file){let url=await fileToDataUrl(file);imageHTML+=`<figure><img src="${url}" alt="${esc(p.filename)}"/><figcaption>${esc(p.caption||p.filename)}</figcaption></figure>`}else remaining.push(p.filename)}catch{remaining.push(p.filename)}
  }
  const tableRows=current.flatMap(e=>renderEntryRow(e,it.unit)).join('');
  const annex=it.origin==='annex'||it.annexName?`<div class="annex">Aneks / dodatna dela: ${esc(it.annexName||'Dodatno delo')}</div>`:'';
  pages+=`<section class="page sheet">
   <div class="book-head">OBRAČUNSKI LIST št. ${i+1} &nbsp; · &nbsp; ${esc(dateLabel)}</div>
   <table class="top-grid"><tr><td style="width:25%"><span class="th">Objekt</span><strong>${esc(project.name)}</strong><span class="muted">${esc(project.location||'')}</span><div class="muted">Obračunski načrt: ${esc(project.planRef||'—')}</div></td>
    <td style="width:51%"><span class="th">Opis del – Postavka</span><strong>${esc(it.code)} ${esc(it.name)}</strong>${annex}</td>
    <td style="width:24%"><span class="th">Predračunska postavka</span><strong>${esc(it.group)}</strong><span>${esc(it.code)}</span><div class="muted">Stroškovno mesto: ${esc(project.costCenter||'—')}</div></td></tr></table>
   <table class="account-bar"><tr><td><small>Priloga</small>${attachments.length} priloga</td><td><small>Enota mere</small><b>${esc(it.unit)}</b></td>
     <td><small>Predračunska količina</small><b>${num(it.contractQty)} ${esc(it.unit)}</b></td><td><small>Cena na enoto</small><b>${money(it.unitPrice)}</b></td>
     <td><small>Obračunska količina – mesečna</small><b>${num(value)} ${esc(it.unit)}</b></td><td><small>Skupna</small><b>${num(cumul)} ${esc(it.unit)}</b></td></tr></table>
   <div class="muted" style="font-size:8px;margin-top:3px">Naročnik: ${esc(project.client||"—")} &nbsp; | &nbsp; Izvajalec: ${esc(project.contractor||"—")}</div>
   <div class="sec-head"><span>Skice, izmere, izračuni</span><span>${esc(dateLabel)} · Prenos: ${num(before)} ${esc(it.unit)}</span></div>
   <table class="measure"><thead><tr><th style="width:7%">Poz.</th><th style="width:18%">Opis / lokacija</th><th>a (m)</th><th>b (m)</th><th>c (m)</th><th>h (m)</th><th>d (m)</th><th>kos</th><th style="width:24%">Izračun</th><th style="width:13%">Količina</th></tr></thead>
    <tbody>${tableRows||'<tr><td colspan="10">Za izabrani mjesec nema obračunskih unosa</td></tr>'}</tbody></table>
   <div class="subtotals"><div>Mesečna: <b>${num(value)} ${esc(it.unit)}</b><p>Skupna: <b>${num(cumul)} ${esc(it.unit)}</b></p></div></div>
   ${imageHTML?`<div class="sec-head">Skice in dokaznice</div><div class="proofs">${imageHTML}</div>`:''}
   ${remaining.length?`<div class="attachments"><em>PDF prilozi (nisu fizički spojeni u ispis):</em> ${esc(remaining.join(', '))}</div>`:''}
   <div class="spacer"></div><div class="foot-total">SKUPAJ: &nbsp; ${num(value)} ${esc(it.unit)}</div>
   <div class="signatures"><div class="signature"><div>Sestavil</div><div class="line">${esc(project.preparedBy||"")}</div><small>(ime in priimek, podpis)</small></div>
   <div class="signature"><div>NAROČNIK:<div class="sub">pooblaščenec</div></div><div class="line">${esc(project.clientRepresentative||"")}</div><small>(ime in priimek, podpis)</small></div>
   <div class="signature"><div>IZVAJALEC:<div class="sub">odgovorni vodja del</div></div><div class="line">${esc(project.contractorManager||"")}</div><small>(ime in priimek, podpis)</small></div></div></section>`;
 }
 let cover='';if(includeSummary){cover=`<section class="page cover"><h1>KNJIGA OBRAČUNSKIH IZMER</h1><h2>${esc(project.name)}</h2><p>${esc(project.location||'')}</p><p class="period">${esc(dateLabel)}</p>
  <p>Odabrani radovi: ${esc(groupSet.size?[...groupSet].join(', '):'Sve grupe')} · ${selected.length} postavki</p>
  <table class="recap"><thead><tr><th>Šifra</th><th>Postavka</th><th>Grupa</th><th>JM</th><th>Mesečno</th><th>Vrijednost</th></tr></thead><tbody>${summaryRows}</tbody></table>
  <h2>UKUPNO ZA MJESEC: ${money(total)}</h2><div class="spacer"></div><p class="muted">Obračunski period: ${esc(dateLabel)}. Izmjere su računane punom preciznošću, na ispisu zaokružene na dvije decimale.</p></section>`}
 return '<!doctype html><html lang="sl"><head><meta charset="utf-8">'+css+'</head><body>'+cover+pages+'</body></html>';
}
window.OBR_ENGINEERING={GROUPS,n,num,money,esc,groupFromHeading,groupForPosition,heading,evaluateVariables,isValidRow,calcRow,calcRows,mathExpression,buildReport};
})();