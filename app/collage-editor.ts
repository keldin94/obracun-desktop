/* Modern, compact collage editor. First TypeScript module in the gradual React migration.
 * Geometry is stored on existing item/proof records, so older records stay valid.
 */
declare const React:any;
type Box={x:number;y:number;w:number;h:number;page?:number};
type Proof={id:string;filename:string;caption?:string;mime?:string;month?:string;billingHalf?:number;rotation?:number;createdAt?:string;collageOrder?:number;collageBox?:Box;imageWidth?:number;imageHeight?:number};
type Tile={proof:Proof;box:Box};
type WorkspaceProps={
 item:any;proofs:Proof[];entries:any[];project:any;month:string;half:number;
 onChangeItem:(patch:any)=>void;onChangeProof:(id:string,patch:any)=>void;
 onReorder:(ids:string[])=>void;onUpload:()=>void;onOpen:(p:Proof)=>void;onDelete:(p:Proof)=>void;
 getFile:(id:string)=>Promise<Blob|null>;fileToDataUrl:(file:Blob)=>Promise<string>;stageAspect?:number;
};
const h=React.createElement;
const root:any=window as any;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const imageOnly=(p:Proof)=>String(p.mime||'').startsWith('image/');
const label=(p:Proof)=>p.caption||p.filename||'Skica';
function ImageWorkspace({item,proofs,entries,project,month,half,onChangeItem,onChangeProof,onReorder,onUpload,onOpen,onDelete,getFile,fileToDataUrl,stageAspect}:WorkspaceProps){
 const periodProofs=proofs.filter(p=>(!p.month||p.month===month)&&
  (root.OBR_PERIODS.frequency(project)===1||!p.billingHalf||Number(p.billingHalf)===half));
 const pictures=periodProofs.filter(imageOnly);
 const other=periodProofs.filter(p=>!imageOnly(p));
 const [selected,setSelected]=React.useState<string>('');
 const [activePage,setActivePage]=React.useState<number>(0);
 const [urls,setUrls]=React.useState<Record<string,string>>({});
 const [localBoxes,setLocalBoxes]=React.useState<Record<string,Box>>({});
 const localRef=React.useRef<Record<string,Box>>({});
 const stageRef=React.useRef<HTMLDivElement|null>(null);
 const moving=React.useRef<any>(null);
 const sourceId=React.useRef<string>('');
 const rowCount=entries.filter(e=>e.itemId===item.id&&root.OBR_PERIODS.belongs(e,project,month,half))
  .reduce((n,e)=>n+(e.measurements?.length||1),0);
 const layout=root.OBR_COLLAGE_LAYOUT.planImages(pictures,item,rowCount);
 const pages:Tile[][]=[layout.main,...layout.appendices];
 const page=Math.min(activePage,pages.length-1);
 const tiles=pages[Math.max(0,page)]||[];
 const chosen=pictures.find(p=>p.id===selected)||pictures[0];
 const mode=item.collageMode||'auto';
 React.useEffect(()=>{
  let alive=true;const values:Record<string,string>={};
  Promise.all(pictures.map(async p=>{
   try{
    const file=await getFile(p.id);
    if(file&&alive){
     let uri=await fileToDataUrl(file);
     if(root.OBR_ENGINEERING.rotateImageData)uri=await root.OBR_ENGINEERING.rotateImageData(uri,p.rotation||0);
     if(alive)values[p.id]=uri;
    }
   }catch{}
  })).then(()=>{if(alive)setUrls(values)});
  return ()=>{alive=false};
 },[pictures.map(p=>p.id+':'+(p.rotation||0)).join('|')]);
 const chooseMode=(next:string)=>{
  if(next==='custom'&&mode!=='custom'){
   for(const [index,list] of pages.entries()){
    list.forEach(t=>onChangeProof(t.proof.id,{collageBox:{...t.box,page:index+1}}));
   }
  }
  onChangeItem({collageMode:next});
  setLocalBoxes({});localRef.current={};
 };
 const boxFor=(t:Tile):Box=>localBoxes[t.proof.id]||t.box;
 const changeBox=(p:Proof,patch:Partial<Box>)=>{
  const old=p.collageBox||pages.flat().find(t=>t.proof.id===p.id)?.box||{x:0,y:0,w:50,h:50};
  const next=root.OBR_COLLAGE_LAYOUT.bounds({...old,...patch});
  onChangeProof(p.id,{collageBox:{...next,page:Number(p.collageBox?.page)||1}});
 };
 const onPointerDown=(e:any,t:Tile,resize:boolean)=>{
  if(mode!=='custom'||!stageRef.current)return;
  e.preventDefault();e.stopPropagation();setSelected(t.proof.id);
  const b=stageRef.current.getBoundingClientRect();
  moving.current={id:t.proof.id,resize,startX:e.clientX,startY:e.clientY,
   width:b.width,height:b.height,original:{...boxFor(t)},page:page+1};
  e.currentTarget.setPointerCapture?.(e.pointerId);
 };
 const onPointerMove=(e:any)=>{
  const move=moving.current;if(!move)return;
  const dx=(e.clientX-move.startX)/move.width*100,dy=(e.clientY-move.startY)/move.height*100;
  let next:Box;
  if(move.resize){
   next={...move.original,w:clamp(Math.round((move.original.w+dx)*2)/2,12,100-move.original.x),
    h:clamp(Math.round((move.original.h+dy)*2)/2,12,100-move.original.y)};
  }else{
   next={...move.original,x:clamp(Math.round((move.original.x+dx)*2)/2,0,100-move.original.w),
    y:clamp(Math.round((move.original.y+dy)*2)/2,0,100-move.original.h)};
  }
  localRef.current={...localRef.current,[move.id]:next};
  setLocalBoxes(localRef.current);
 };
 const onPointerUp=()=>{
  const move=moving.current;if(!move)return;
  const next=localRef.current[move.id];
  moving.current=null;
  if(next)onChangeProof(move.id,{collageBox:{...next,page:move.page}});
  localRef.current={};setLocalBoxes({});
 };
 const options:[string,string][]=[
  ['auto','Samodejno'],['grid','Mreža'],['stack','Vodoravne skice'],
  ['hero','Velika + manjše'],['mosaic','Mešani kolaž'],['custom','Uredi sam']];
 return h('section',{className:'ob-collage-workspace'},
  h('div',{className:'ob-collage-head'},
   h('div',null,h('strong',null,'Skice in priloge'),
    h('small',null,String(pictures.length)+' slik · '+String(other.length)+' drugih prilog')),
   h('button',{className:'ob-compact-action',type:'button',onClick:onUpload},'＋ Dodaj skice')),
  h('div',{className:'ob-image-gallery'},
   pictures.map((p,i)=>h('button',{type:'button',key:p.id,draggable:true,
      className:'ob-sketch-tile'+(chosen?.id===p.id?' is-selected':''),
      onClick:()=>setSelected(p.id),
      onDragStart:(e:any)=>{sourceId.current=p.id;e.dataTransfer.effectAllowed='move'},
      onDragOver:(e:any)=>e.preventDefault(),
      onDrop:(e:any)=>{e.preventDefault();const from=sourceId.current;
       if(!from||from===p.id)return;const ids=pictures.map(x=>x.id);
       const old=ids.indexOf(from),next=ids.indexOf(p.id);
       if(old<0||next<0)return;ids.splice(old,1);ids.splice(next,0,from);
       onReorder(ids);sourceId.current='';},
      title:'Povleci za spremembo vrstnega reda'},
      urls[p.id]?h('img',{src:urls[p.id],alt:''}):h('span',{className:'ob-image-placeholder'},'▧'),
      h('span',{className:'ob-thumb-name'},String(i+1)+'. '+label(p)))),
   !pictures.length&&h('p',{className:'ob-muted'},'Dodaj fotografije ali skice. Vse bodo prikazane v galeriji.')),
  h('div',{className:'ob-layout-toolbar'},
   h('label',null,'Razporeditev',
     h('select',{value:mode,onChange:(e:any)=>chooseMode(e.target.value)},
       ...options.map(([value,name])=>h('option',{key:value,value},name)))),
   h('label',{className:'ob-fit-check'},
     h('input',{type:'checkbox',checked:item.collageFit!==false,
       onChange:(e:any)=>onChangeItem({collageFit:e.target.checked})}),
     'Prilagodi na eno stran'),
   h('span',{className:'ob-layout-hint'},'Povleci sličice za vrstni red. V načinu »Uredi sam« premikaj in spreminjaj velikost.')),
  h('div',{className:'ob-page-tabs'},
    ...pages.map((list,i)=>h('button',{type:'button',key:i,
      className:i===page?'is-active':'',onClick:()=>setActivePage(i)},
      i===0?'Glavni list':'Priloga '+i,' · ',list.length))),
  h('div',{className:'ob-collage-stage',ref:stageRef,
      style:{aspectRatio:stageAspect||0.85},
      onPointerMove,onPointerUp,onPointerCancel:onPointerUp},
    tiles.map(t=>{
     const b=boxFor(t),p=t.proof;
     return h('div',{key:p.id,className:'ob-stage-tile'+(chosen?.id===p.id?' is-selected':''),
       onClick:()=>setSelected(p.id),
       onPointerDown:(e:any)=>onPointerDown(e,t,false),
       style:{left:b.x+'%',top:b.y+'%',width:b.w+'%',height:b.h+'%',
        cursor:mode==='custom'?'move':'pointer'}},
       h('div',{className:'ob-stage-content'},
        urls[p.id]?h('img',{src:urls[p.id],alt:label(p)}):h('span',null,label(p)),
        h('small',{className:'ob-sketch-caption'},h('span',null,label(p)))),
       mode==='custom'&&h('span',{className:'ob-resize-handle',
         onPointerDown:(e:any)=>onPointerDown(e,t,true),'aria-label':'Spremeni velikost'}));
    }),
    !tiles.length&&h('div',{className:'ob-stage-empty'},'Skice bodo prikazane tukaj')),
  chosen&&h('div',{className:'ob-sketch-inspector'},
    h('div',{className:'ob-inspector-head'},h('strong',null,'Izbrana skica'),
      h('div',null,
       h('button',{type:'button',className:'ob-icon-action',onClick:()=>onOpen(chosen),title:'Odpri original'},'↗'),
       h('button',{type:'button',className:'ob-icon-action',onClick:()=>onDelete(chosen),title:'Odstrani'},'×'))),
    h('label',{className:'ob-caption-field'},'Naziv',
      h('input',{value:chosen.caption??chosen.filename,onChange:(e:any)=>onChangeProof(chosen.id,{caption:e.target.value})})),
    h('label',null,'Rotacija',
      h('select',{value:chosen.rotation||0,onChange:(e:any)=>onChangeProof(chosen.id,{rotation:Number(e.target.value)})},
       ...[0,90,180,270].map(n=>h('option',{key:n,value:n},String(n)+'°')))),
    mode==='custom'&&h('label',null,'Stran',
      h('select',{value:Number(chosen.collageBox?.page)||1,onChange:(e:any)=>{
        const t=pages.flat().find(x=>x.proof.id===chosen.id);
        onChangeProof(chosen.id,{collageBox:{...(t?.box||{x:0,y:0,w:50,h:50}),page:Number(e.target.value)}});
      }},...Array.from({length:Math.max(3,pages.length+1)},(_,i)=>
        h('option',{value:i+1,key:i},i===0?'Glavni list':'Priloga '+i)))),
    mode==='custom'&&h('label',null,'Širina (%)',
       h('input',{type:'number',min:12,max:100,value:chosen.collageBox?.w??50,
          onChange:(e:any)=>changeBox(chosen,{w:Number(e.target.value)})}))),
  other.length>0&&h('div',{className:'ob-other-files'},
   h('strong',null,'Drugi dokumenti'),
   ...other.map(p=>h('div',{key:p.id},
      h('button',{type:'button',onClick:()=>onOpen(p)},label(p)),
      h('button',{type:'button',onClick:()=>onDelete(p),title:'Odstrani'},'×')))),
  layout.appendices.length>0&&h('p',{className:'ob-appendix-hint'},
    'Dodatne skice ('+layout.appendices.reduce((n,a)=>n+a.length,0)+') bodo na prilogah. Glavni obračunski list ostane nespremenjen.')
 );
}
type PreviewProps={item:any;project:any;items:any[];entries:any[];proofs:any[];month:string;half:number;
 getFile:(id:string)=>Promise<Blob|null>;fileToDataUrl:(blob:Blob)=>Promise<string>;onPrint:()=>void;
 onLayoutAspect?:(ratio:number)=>void;};
function LivePreview({item,project,items,entries,proofs,month,half,getFile,fileToDataUrl,onPrint,onLayoutAspect}:PreviewProps){
 const [html,setHtml]=React.useState<string>('');
 const [problem,setProblem]=React.useState<string>('');
 const [scale,setScale]=React.useState<number>(0.58);
 React.useEffect(()=>{
  let active=true;
  const timeout=setTimeout(async()=>{
   try{
    const report=await root.OBR_ENGINEERING.buildReport({
      project,items,entries,proofs,month,half,selectedIds:[item.id],includeEmpty:true,
      includeSummary:false,getFile,fileToDataUrl});
    if(active){setHtml(report);setProblem('')}
   }catch(e:any){if(active)setProblem(e?.message||'Predogled ni na voljo')}
  },220);
  return ()=>{active=false;clearTimeout(timeout)};
 },[item,project,items,entries,proofs,month,half]);
 return h('aside',{className:'ob-live-rail'},
  h('div',{className:'ob-live-toolbar'},
   h('div',null,h('strong',null,'A4 · Predogled v živo'),h('small',null,'Prikaz je enak tiskanju')),
   h('button',{type:'button',className:'ob-compact-action',onClick:onPrint},'Predogled / PDF')),
  h('div',{className:'ob-live-controls'},
   h('button',{type:'button',onClick:()=>setScale(clamp(Number((scale-.08).toFixed(2)),.3,.8))},'−'),
   h('span',null,Math.round(scale*100)+' %'),
   h('button',{type:'button',onClick:()=>setScale(clamp(Number((scale+.08).toFixed(2)),.3,.8))},'+')),
  problem&&h('p',{className:'ob-muted'},problem),
  h('div',{className:'ob-live-paper-scroll'},
    h('div',{className:'ob-live-paper',style:{width:(794*scale)+'px',height:(1123*scale)+'px'}},
      h('iframe',{title:'Predogled obračunskega lista A4',
       onLoad:(e:any)=>{
        const box=e.currentTarget?.contentDocument?.querySelector('.page.sheet .collage-box')?.getBoundingClientRect();
        if(box&&box.width>0&&box.height>0)onLayoutAspect?.(Math.round(box.width/box.height*10000)/10000);
       },
       srcDoc:html?html.replace('</head>','<style>@media screen{body{padding:0!important}.page{margin:0!important;box-shadow:none!important}}</style></head>'):'<p style="font:12px Arial;padding:20px">Pripravljam predogled...</p>',
       style:{width:'794px',height:'1123px',transform:'scale('+scale+')',transformOrigin:'top left',
        border:0,background:'#fff',pointerEvents:'none'}}))));
}
root.OBR_COLLAGE={ImageWorkspace,LivePreview};
