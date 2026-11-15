/* Unit-specific quantity editor: preserves legacy row data and PDF calculations. */
(function(){
'use strict';
const h=React.createElement;
const E=window.OBR_ENGINEERING;
function isSteel(unit){return String(unit||'').toLowerCase()==='kg'}
function isArea(unit){return ['m²','m2'].includes(String(unit||'').toLowerCase())}
function isVolume(unit){return ['m³','m3'].includes(String(unit||'').toLowerCase())}
function isPieces(unit){return ['kos','kom','kom.','pcs'].includes(String(unit||'').toLowerCase())}
const simpleSelect=(value,onChange,choices)=>h('select',{value,onChange},...choices.map(([v,l])=>h('option',{key:v,value:v},l)));
function MeasurementRows({form,setForm,unit}){
 const rows=Array.isArray(form.measurements)?form.measurements:[];
 const inputs=React.useRef({});
 const unitType=isSteel(unit)?'steel':isVolume(unit)?'volume':isArea(unit)?'area':isPieces(unit)?'pieces':'other';
 const update=next=>setForm({...form,measurements:next,expression:E.mathExpression(next)});
 const patch=(i,changes)=>update(rows.map((r,j)=>i===j?{...r,...changes}:r));
 const erase=i=>update(rows.filter((_,j)=>j!==i));
 const defaultMode={steel:'rebar',volume:'cubic',area:'area',pieces:'pieces',other:'length'};
 const newRow=()=>({
    label:'',mode:defaultMode[unitType],sign:'+',kos:'1',a:'',b:'',c:'',h:'',d:'',
    q:'',r:'',t:'',direct:'',openings:'',formula:'',material:'',
    rebarPositions:'',rebarCategory:'',diameterBreakdown:[],extraVariables:{}
 });
 const add=()=>update([...rows,newRow()]);
 const fld=(row,i,key,label,opt={})=>h('label',{key,className:'measure-field',
    style:{minWidth:opt.width||'112px',flex:opt.flex||'1 1 105px'}},
   h('small',null,label),
   h('input',{value:row[key]??'',placeholder:opt.placeholder||'—',
     inputMode:opt.text?'text':'decimal',onChange:e=>patch(i,{[key]:e.target.value})}));
 const variable=(row,i,key)=>fld(row,i,key+'',key+' (m)',{width:'85px'});
 const formulaInput=(row,i)=>{
   const key='ob-formula-'+i;
   const insert=token=>{
    const node=inputs.current[key],existing=String(row.formula||'');
    const start=node?.selectionStart??existing.length,end=node?.selectionEnd??existing.length;
    patch(i,{formula:existing.slice(0,start)+token+existing.slice(end)});
    requestAnimationFrame(()=>{const input=inputs.current[key];if(input){input.focus();input.setSelectionRange(start+token.length,start+token.length)}});
   };
   const extras=Object.entries(row.extraVariables||{});
   const keys=['a','b','c','h','d','q','r','t','kos',...extras.map(x=>x[0])].filter(k=>row[k]!==undefined||k==='kos'||extras.some(x=>x[0]===k));
   const used=[...new Set(keys)];
   const formula=String(row.formula||'');
   const val=E.calcRow(row),valid=E.isValidRow(row);
   return h('div',{className:'ob-formula-box'},
     h('div',{className:'ob-formula-heading'},h('b',null,'Poljubna formula'),h('span',null,'Izberi spremenljivke in računske znake')),
     h('input',{ref:el=>{inputs.current[key]=el},value:formula,
       onChange:e=>patch(i,{formula:e.target.value}),spellCheck:false,
       placeholder:'Primer: a × (b + c) × kos − q',
       'aria-label':'Poljubna formula',className:'ob-formula-input'}),
     h('div',{className:'ob-keyboard'},
       ...used.map(v=>h('button',{key:v,type:'button',className:'ob-formula-key ob-var-key',
         onMouseDown:e=>e.preventDefault(),onClick:()=>insert(v)},v)),
       ...[['×','*'],['÷','/'],['+','+'],['−','-'],['(', '('],[')',')'],['x²','^2'],['xʸ','^'],['=','=']].map(([symbol,value])=>
          h('button',{key:symbol,type:'button',className:'ob-formula-key',
            onMouseDown:e=>e.preventDefault(),onClick:()=>value==='='?inputs.current[key]?.blur():insert(value)},symbol))),
     h('div',{className:'ob-formula-status'},
       h('span',null,formula?(valid?'Izračun: '+val.expression:(val.error||'Preveri formulo')):'Uporabljena bo običajna formula'),
       h('strong',null,valid?E.num(val.result,3)+' '+unit:'— '+unit)));
 };
 const extras=(row,i)=>{
   const change=(from,to,value)=>{
    const old={...(row.extraVariables||{})};
    delete old[from]; if(to)old[to]=value;
    patch(i,{extraVariables:old});
   };
   const addExtra=()=>{
    const alphabet='efgijklmnopsuvwyz';
    const name=[...alphabet].find(k=>row[k]===undefined&&!Object.hasOwn(row.extraVariables||{},k));
    if(name)patch(i,{extraVariables:{...(row.extraVariables||{}),[name]:''}});
   };
   return h('div',{className:'ob-extra-vars'},
     ...Object.entries(row.extraVariables||{}).map(([name,value])=>
      h('label',{key:name,className:'ob-extra-field'},
       h('input',{value:name,'aria-label':'Ime spremenljivke',onChange:e=>change(name,e.target.value.replace(/[^a-z_]/gi,'').toLowerCase(),value)}),
       h('span',null,'='),
       h('input',{value,inputMode:'decimal',placeholder:'Vrednost',onChange:e=>change(name,name,e.target.value)}),
       h('button',{type:'button',onClick:()=>change(name,'',value),'aria-label':'Odstrani spremenljivko'},'×'))),
     h('button',{type:'button',className:'btn btn-outline',onClick:addExtra},'+ Dodaj spremenljivko'));
 };
 const steel=(row,i)=>{
   const oldMode=row.mode==='weight';
   const bands=row.diameterBreakdown||[];
   const updateBand=(j,changes)=>patch(i,{diameterBreakdown:bands.map((b,k)=>j===k?{...b,...changes}:b)});
   const allBand=bands.reduce((n,b)=>n+(parseFloat(String(b.kg||'0').replace(',','.'))||0),0);
   const check=row.direct!==''&&bands.length>0&&Math.abs((parseFloat(String(row.direct).replace(',','.'))||0)-allBand)>0.001;
   return h('div',{className:'ob-type-specific'},
      oldMode&&h('div',{className:'ob-legacy-warning'},
       'Starejši izračun a × kos je ohranjen.',
       h('button',{type:'button',className:'btn btn-outline',onClick:()=>patch(i,{mode:'rebar',direct:String(E.calcRow(row).result),formula:''})},'Pretvori v enostaven vnos kg')),
      oldMode? h('div',{className:'ob-field-row'},fld(row,i,'a','Masa na kos (kg)'),fld(row,i,'kos','Število kosov')):
       h('div',{className:'ob-field-row'},
        fld(row,i,'direct','Vgrajena masa (kg)',{width:'175px',placeholder:'npr. 975,50'}),
        fld(row,i,'rebarPositions','Številke armaturnih pozicij',{text:true,width:'200px',placeholder:'npr. 2, 5, 8–12'}),
        h('label',{className:'measure-field',style:{flex:'1 1 175px'}},h('small',null,'Razred / skupina armature'),
         simpleSelect(row.rebarCategory||'',e=>patch(i,{rebarCategory:e.target.value}),
           [['','Vse palice skupaj'],['do12','Do vključno Ø12'],['od14','Od Ø14'],['custom','Druga skupina']]))),
      h('div',{className:'ob-rebar-head'},
        h('b',null,'Razčlenitev po premerih (neobvezno)'),
        h('button',{type:'button',className:'btn btn-outline',onClick:()=>patch(i,{diameterBreakdown:[...bands,{fi:'12',kg:''}]})},'+ Dodaj premer')),
      bands.map((b,j)=>h('div',{key:j,className:'ob-field-row'},
       h('label',{className:'measure-field'},h('small',null,'Premer Ø'),
         simpleSelect(b.fi||'12',e=>updateBand(j,{fi:e.target.value}),[['6','Ø6'],['8','Ø8'],['10','Ø10'],['12','Ø12'],['14','Ø14'],['16','Ø16'],['18','Ø18'],['20','Ø20'],['22','Ø22'],['25','Ø25'],['28','Ø28'],['32','Ø32']])),
       h('label',{className:'measure-field'},h('small',null,'Masa (kg)'),
        h('input',{value:b.kg??'',inputMode:'decimal',onChange:e=>updateBand(j,{kg:e.target.value})})),
       h('button',{type:'button',className:'btn btn-outline',onClick:()=>patch(i,{diameterBreakdown:bands.filter((_,k)=>k!==j)})},'Odstrani'))),
      bands.length>0&&h('p',{className:check?'ob-field-error':'ob-muted'},'Vsota po premerih: '+E.num(allBand,3)+' kg'+(check?' — razlikuje se od skupne mase.':''))
   );
 };
 const rowEditor=(row,i)=>{
  const steelMode=unitType==='steel';
  const valid=E.isValidRow(row),calculated=E.calcRow(row);
  return h('article',{key:i,className:'ob-measure-card'},
    h('header',{className:'ob-row-head'},
      fld(row,i,'label','Oznaka / ime dela',{text:true,width:'245px',placeholder:'A, B ali Stena v osi H1'}),
      h('label',{className:'measure-field ob-sign-field'},h('small',null,'Predznak'),
       simpleSelect(row.sign||'+',e=>patch(i,{sign:e.target.value}),[['+','+ Prištej'],['-','− Odštej']])),
      h('button',{type:'button',className:'btn btn-outline',onClick:()=>erase(i)},'Odstrani vrstico')),
    steelMode?steel(row,i):
      h('div',{className:'ob-type-specific'},
       unitType==='volume'&&h('label',{className:'measure-field',style:{maxWidth:310}},h('small',null,'Standardna formula'),
        simpleSelect(row.mode||'cubic',e=>patch(i,{mode:e.target.value}),
          [['cubic','a × b × c × kos'],['volume','a × b × h × kos'],['thickness','a × b × d × kos'],['manual','Ročno vnesena količina']])),
       h('div',{className:'ob-field-row'},
        ...(row.mode==='manual'?[fld(row,i,'direct','Količina')]:
          unitType==='volume'?[fld(row,i,'a','a (m)'),fld(row,i,'b','b (m)'),fld(row,i,'c','c (m)'),...(row.mode==='volume'?[fld(row,i,'h','h (m)')]:[]),...(row.mode==='thickness'?[fld(row,i,'d','d (m)')]:[]),fld(row,i,'kos','Število kosov')]:
          unitType==='area'?[fld(row,i,'a','a (m)'),fld(row,i,'b','b (m)'),fld(row,i,'kos','Število kosov')]:
          unitType==='pieces'?[fld(row,i,'kos','Število kosov')]:
          [fld(row,i,'a','a'),fld(row,i,'kos','Število kosov')]),
        !steelMode&&fld(row,i,'openings','Odbitki (v enotah '+unit+')')),
       unitType==='other'&&h('div',{className:'ob-muted'},'Po potrebi uporabi poljubno formulo.'),
       unitType!=='pieces'&&h('div',{className:'ob-field-row'},fld(row,i,'material','Material / oznaka',{text:true,width:'200px'}))),
    !steelMode&&h('details',{className:'ob-advanced'},
      h('summary',null,'Dodatne mere, spremenljivke in formula'),
      h('div',{className:'ob-field-row'},...['a','b','c','h','d','q','r','t'].filter(k=>!((unitType==='volume'&&['a','b','c'].includes(k))||(unitType==='area'&&['a','b'].includes(k)))).map(k=>variable(row,i,k))),
      extras(row,i)),
    (steelMode? h('details',{className:'ob-advanced'},
        h('summary',null,'Dodatna formula (neobvezno)'),extras(row,i),formulaInput(row,i)):
      formulaInput(row,i)),
    h('footer',{className:'ob-row-total'},
      h('span',null,valid?(calculated.expression||'Izračunano'):(calculated.error||'Vnesi zahtevane mere')),
      h('strong',null,valid?E.num(calculated.result,3)+' '+unit:'— '+unit)));
 };
 return h('section',{className:'ob-measure-editor'},
    h('header',{className:'ob-measure-top'},
      h('div',null,h('h3',null,unitType==='steel'?'Obračun armature (kg)':unitType==='volume'?'Prostornina (m³)':unitType==='area'?'Površina (m²)':unitType==='pieces'?'Število kosov':'Obračun količin'),
       h('p',null,'Vsaka vrstica ima svojo oznako, mere in obračun. Formula bo prikazana tudi na obračunskem listu.')),
      h('button',{type:'button',className:'btn btn-primary',onClick:add},'+ Dodaj vrstico')),
    rows.map(rowEditor),
    rows.length>0&&h('div',{className:'ob-measure-grandtotal'},
      h('span',null,'SKUPAJ ZA TO IZMERO'),
      h('strong',null,rows.every(E.isValidRow)?E.num(E.calcRows(rows),3)+' '+unit:'Preveri vnos')),
    rows.length>0&&h('button',{type:'button',className:'text-action',onClick:()=>update([])},'Preklopi na preprost ročni izraz'));
}
window.OBR_MeasurementRows=MeasurementRows;
})();
