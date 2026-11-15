/* Geometry for A4 image collages; independent of project data and React. */
(function(root){
'use strict';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
function bounds(raw){
 const x=clamp(raw?.x,0,90),y=clamp(raw?.y,0,90);
 return {x,y,w:clamp(raw?.w||50,12,100-x),h:clamp(raw?.h||50,12,100-y)};
}
function template(count,mode='auto',images=[]){
 if(!count)return [];
 const n=Math.min(count,6),cells=[];
 const put=(x,y,w,h)=>cells.push({x,y,w,h});
 const aspect=img=>(Number(img?.imageWidth)||1)/(Number(img?.imageHeight)||1);
 if(n===1){put(0,0,100,100);return cells}
 if(n===2){
  const stacked=mode==='stack'||(mode==='auto'&&images.length===2&&images.every(i=>aspect(i)>1.35));
  if(stacked){put(0,0,100,49);put(0,51,100,49)}
  else {put(0,0,49,100);put(51,0,49,100)}
  return cells;
 }
 if(n===3){
  if(mode==='stack'||(mode==='auto'&&aspect(images[0])>1.4)){
   put(0,0,100,51);put(0,53,49,47);put(51,53,49,47);
  }else{
   put(0,0,59,100);put(61,0,39,49);put(61,51,39,49);
  }
  return cells;
 }
 if(n===4){
  if(mode==='hero'||mode==='mosaic'){
   put(0,0,59,65);put(61,0,39,65);put(0,67,49,33);put(51,67,49,33);
  }else for(let i=0;i<4;i++)put((i%2)*51,Math.floor(i/2)*51,49,49);
  return cells;
 }
 if(n===5){
  put(0,0,49,100);
  for(let i=1;i<5;i++)put(51+((i-1)%2)*25,Math.floor((i-1)/2)*51,23,49);
  return cells;
 }
 for(let i=0;i<6;i++)put((i%3)*34,Math.floor(i/3)*51,32,49);
 return cells;
}
function planImages(files,item={},rowCount=0){
 const images=(files||[]).filter(p=>String(p.mime||'').startsWith('image/'))
  .sort((a,b)=>(Number(a.collageOrder)||0)-(Number(b.collageOrder)||0)||
    String(a.createdAt||'').localeCompare(String(b.createdAt||''))||
    String(a.id).localeCompare(String(b.id)));
 const mode=item.collageMode||'auto',fit=item.collageFit!==false;
 const maxMain=Math.min(6,rowCount>=13?0:rowCount>=9?2:rowCount>=5?4:6,fit?6:2);
 const main=[],overflow=[],extraPages=new Map();
 images.forEach((proof,i)=>{
  const requested=mode==='custom'?Number(proof.collageBox?.page):0;
  if(requested>=2){const p=Math.min(99,Math.floor(requested));if(!extraPages.has(p))extraPages.set(p,[]);extraPages.get(p).push(proof);}
  else if(main.length<maxMain && (requested===1||!requested))main.push(proof);
  else overflow.push(proof);
 });
 const positioned=(list,custom)=>{
  const defaults=template(list.length,custom?'auto':mode,list);
  return list.map((proof,i)=>({proof,box:custom&&proof.collageBox?bounds(proof.collageBox):defaults[i]}));
 };
 const appendices=[];
 const out=overflow.slice();
 for(const [,onPage] of [...extraPages].sort(([a],[b])=>a-b)){appendices.push(positioned(onPage.slice(0,6),mode==='custom'));out.push(...onPage.slice(6));}
 while(out.length)appendices.push(positioned(out.splice(0,6),mode==='custom'));
 return {main:positioned(main,mode==='custom'),appendices,allImages:images,mode,fit};
}
root.OBR_COLLAGE_LAYOUT={bounds,template,planImages};
})(typeof window!=='undefined'?window:globalThis);
