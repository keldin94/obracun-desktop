/* User-owned handwritten signature for "Sestavil" on construction measurement sheets.
 * Stored per project as transparent PNG data URL. Never signs for other parties.
 */
(function(){
 'use strict';
 function SignaturePad({value,onChange}){
  const h=React.createElement,ref=React.useRef(null),drawing=React.useRef(false);
  React.useEffect(()=>{
   const canvas=ref.current,ctx=canvas?.getContext('2d');
   if(!ctx)return;
   ctx.clearRect(0,0,canvas.width,canvas.height);
   if(typeof value==='string'&&value.startsWith('data:image/png;base64,')){
    const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=value;
   }
  },[]);
  function point(e){const c=ref.current,r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
  function down(e){
   e.preventDefault();drawing.current=true;
   const c=ref.current,ctx=c.getContext('2d'),p=point(e);
   try{c.setPointerCapture(e.pointerId)}catch{}
   ctx.strokeStyle='#1648bd';ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.lineCap='round';
   ctx.beginPath();ctx.moveTo(p.x,p.y);
   ctx.lineTo(p.x+.25,p.y+.25);ctx.stroke();
  }
  function move(e){
   if(!drawing.current)return;
   e.preventDefault();const p=point(e),ctx=ref.current.getContext('2d');
   ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  function up(e){
   if(!drawing.current)return;drawing.current=false;
   const canvas=ref.current,ctx=canvas?.getContext('2d');ctx?.closePath();
   if(canvas)onChange(canvas.toDataURL('image/png'));
  }
  function clear(){
   const c=ref.current;c?.getContext('2d')?.clearRect(0,0,c.width,c.height);onChange('');
  }
  return h('div',{className:'ob-sign-pad'},
   h('div',{className:'ob-sign-pad-toolbar'},
    h('div',null,h('strong',null,'Lastnoročni podpis (neobvezno)'),
      h('small',null,'Z modrim pisalom ali miško se podpiši samo v svojem imenu. Podpis bo dodan na vsako stran obračunskega lista.')),
    h('button',{type:'button',className:'btn btn-outline',onClick:clear},'Izbriši podpis')),
   h('canvas',{ref,width:720,height:180,role:'img','aria-label':'Površina za podpis',
     onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:up})
  );
 }
 window.OBR_SignaturePad=SignaturePad;
})();
