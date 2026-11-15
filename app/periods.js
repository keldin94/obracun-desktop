/* Monthly/half-month billing periods for independent construction sites.
 * All stored dates remain ISO YYYY-MM-DD and original entry IDs are preserved.
 * Legacy records do not need migration; e.date determines the period when available.
 */
(function(root){
 'use strict';
 const MONTHS=['Januar','Februar','Marec','April','Maj','Junij','Julij','Avgust','September','Oktober','November','December'];
 const SHORT=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Avg','Sep','Okt','Nov','Dec'];
 function frequency(project){return Number(project?.billingFrequency)===2?2:1}
 function monthIndex(month){const [y,m]=String(month||'').split('-').map(Number);return y*12+(m-1)}
 function monthFromIndex(idx){const y=Math.floor(idx/12),m=(idx%12+12)%12+1;return y+'-'+String(m).padStart(2,'0')}
 function fromDate(date,project){
  const month=String(date||'').slice(0,7);
  const day=Number(String(date||'').slice(8,10));
  return {month,half:frequency(project)===2&&day>15?2:1};
 }
 function period(project,month,half=1){return {month:String(month||'').slice(0,7),half:frequency(project)===2&&Number(half)===2?2:1}}
 function index(project,month,half=1){return monthIndex(month)*frequency(project)+(frequency(project)===2?Number(half)===2?1:0:0)}
 function previous(project,month,half=1){const p=period(project,month,half);return p.half===2?{month:p.month,half:1}:{month:monthFromIndex(monthIndex(p.month)-1),half:frequency(project)===2?2:1}}
 function entryMoment(entry,project){
  const date=String(entry.date||'');
  const month=String(entry.month||date.slice(0,7)).slice(0,7);
  if(frequency(project)===1)return {month,half:1};
  const half=Number(entry.billingHalf)||Number(entry.periodHalf);
  if(half===1||half===2)return {month,half};
  if(/^\d{4}-\d\d-\d\d$/.test(date)&&date.slice(0,7)===month)return {month,half:Number(date.slice(8,10))>15?2:1};
  return {month,half:1};
 }
 function belongs(entry,project,month,half=1){const e=entryMoment(entry,project),p=period(project,month,half);return e.month===p.month&&e.half===p.half}
 function until(entry,project,month,half=1){const e=entryMoment(entry,project),p=period(project,month,half);return index(project,e.month,e.half)<=index(project,p.month,p.half)}
 function before(entry,project,month,half=1){const e=entryMoment(entry,project),p=period(project,month,half);return index(project,e.month,e.half)<index(project,p.month,p.half)}
 function label(project,month,half=1,short=false){
  const [year,m]=String(month||'').split('-').map(Number);
  if(!year||m<1||m>12)return month;
  const title=(short?SHORT:MONTHS)[m-1]+" '"+String(year).slice(-2);
  return frequency(project)===2?title+'/'+(Number(half)===2?2:1):title;
 }
 function firstDate(month,half=1){return month+'-'+(Number(half)===2?'16':'01')}
 function listPosition(item,items){
  const list=(items||[]).filter(x=>x.projectId===item.projectId);
  const idx=list.findIndex(x=>x.id===item.id);
  return idx>=0?idx+1:1;
 }
 // Stable estimate follows report chunking; full output page count belongs to the same helper.
 function planPages(entries,proofs){
  const rows=(entries||[]).flatMap(e=>(e.measurements?.length?e.measurements:[e]).map(row=>({entry:e,row})));
  const images=(proofs||[]).filter(p=>String(p.mime||'').startsWith('image/'));
  const other=(proofs||[]).filter(p=>!String(p.mime||'').startsWith('image/'));
  const pageList=[];let ri=0,pi=0;
  while(ri<rows.length||pi<images.length||!pageList.length){
   // Keep printable content readable; a few large drawings reduce table capacity.
   const futureImages=Math.min(images.length-pi,2);
   const maxRows=futureImages?9:20;
   const sectionRows=rows.slice(ri,ri+maxRows);ri+=sectionRows.length;
   let count=Math.min(images.length-pi,sectionRows.length>6?1:2);
   if(rows.length===0)count=Math.min(images.length-pi,2);
   if(count===0&&ri>=rows.length&&pi<images.length)count=1;
   const sectionImages=images.slice(pi,pi+count);pi+=count;
   pageList.push({rows:sectionRows,images:sectionImages,others:pageList.length===0?other:[]});
  }
  return pageList;
 }
 root.OBR_PERIODS={frequency,monthIndex,monthFromIndex,fromDate,period,index,previous,entryMoment,belongs,until,before,label,firstDate,listPosition,planPages};
})(typeof window!=='undefined'?window:globalThis);
