const test=require('node:test');
const assert=require('node:assert/strict');
global.window=global;
require('../collage-layout.js');
const L=global.OBR_COLLAGE_LAYOUT;
const img=(id,ratio=1)=>({id,filename:id+'.jpg',mime:'image/jpeg',imageWidth:ratio*100,imageHeight:100});
test('Mixed collages have nonidentical image sizes and remain inside the page',()=>{
 const placements=L.template(5,'mosaic');
 assert.equal(placements.length,5);
 assert.ok(placements[0].w>placements[1].w);
 for(const b of placements){
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=100&&b.y+b.h<=100);
 }
});
test('Fit to one page uses available space but spills extras into named appendices',()=>{
 const files=Array.from({length:9},(_,i)=>img('sketch-'+i));
 const p=L.planImages(files,{collageFit:true},2);
 assert.equal(p.main.length,6);
 assert.equal(p.appendices.length,1);
 assert.equal(p.appendices[0].length,3);
 assert.equal(p.allImages.length,9);
});
test('Many measurement rows take priority over sketches to preserve readable dimensions',()=>{
 const p=L.planImages([img('a'),img('b'),img('c')],{},20);
 assert.equal(p.main.length,0);
 assert.equal(p.appendices[0].length,3);
});
test('PDF files stay independent of the image collage',()=>{
 const p=L.planImages([img('a'),{id:'pdf',mime:'application/pdf',filename:'contract.pdf'}],{},2);
 assert.equal(p.allImages.length,1);
 assert.equal(p.main.length,1);
});
test('Manual custom placement preserves sizes, positions, and page selection',()=>{
 const files=[{...img('a'),collageBox:{x:7,y:9,w:63,h:70,page:1}},
 {...img('b'),collageBox:{x:5,y:0,w:90,h:90,page:2}}];
 const p=L.planImages(files,{collageMode:'custom',collageFit:true},2);
 assert.equal(p.main[0].box.w,63);
 assert.equal(p.main[0].box.x,7);
 assert.equal(p.appendices[0][0].proof.id,'b');
});
test('Automatic layout stacks two horizontal sketches',()=>{
 const p=L.template(2,'auto',[img('a',2),img('b',3)]);
 assert.equal(p[0].w,100);
 assert.ok(p[1].y>p[0].y);
});
