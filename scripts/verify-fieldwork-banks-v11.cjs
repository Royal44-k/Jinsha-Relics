const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
   const p=await b.newPage(),base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',url=base+'/__check-projection';
   const fixture='<script type=module>import * as T from "/node_modules/three/build/three.module.js";import{buildBanks,bankProjection}from"/src/v10/fieldwork-river.js";window.libs={T,buildBanks,bankProjection};</script>';
   await p.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));await p.goto(url);await p.waitForFunction(()=>window.libs);
   const reports=await p.evaluate(async()=>{
     const {T,buildBanks,bankProjection}=window.libs;
     const original=new T.Scene(),projection=new T.Scene(),r=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(640,400);r.setClearColor(0,0);
     const points=[1.8,14,29],center=s=>1.22*Math.sin(s*.18)-.52*Math.cos(s*.33),breadth=s=>3.6+.44*Math.sin(s*.19+.3);
     const cr=new T.OrthographicCamera(-8.48,8.48,5.3,-5.3,.05,160);
     const depth=new T.Mesh(new T.PlaneGeometry(90,120),new T.MeshBasicMaterial({colorWrite:false}));depth.rotation.x=-Math.PI/2;depth.renderOrder=-9;depth.position.set(0,.005,-17);original.add(depth);
     const dummy=()=>new T.Texture();buildBanks({scene:original,texture:dummy,software:false});
     await bankProjection({closed:false},{scene:projection});const rect=document.createElement('canvas');rect.width=640;rect.height=400;const g=rect.getContext('2d',{willReadFrequently:true});
     function read(scene){r.render(scene,cr);g.clearRect(0,0,640,400);g.drawImage(r.domElement,0,0);return g.getImageData(0,0,640,400).data;}
     return points.map((s,i)=>{
       const x=center(s)+(i===1?-breadth(s)+.9:i===2?breadth(s)-.95:0),camX=center(s)*.48+x*.12;
       cr.position.set(camX+1.75,8.05,-s+9.4);cr.lookAt(camX,0,-s-2.4);cr.updateMatrixWorld();const a=read(original),b=read(projection);
       let intersection=0,union=0;for(let i=3;i<a.length;i+=4){const m=a[i]>127,n=b[i]>127;if(m||n)union++;if(m&&n)intersection++;}
       const mark=new T.Vector3(x,.03,-s).project(cr),px=Math.round((mark.x+1)*320),py=Math.round((1-mark.y)*200),idx=(py*640+px)*4+3;
       return {riverMeter:s,maskIoU:intersection/union,raftPixel:[px,py],waterInOriginal:a[idx]<128,waterInProjection:b[idx]<128};
     });
   });
   for(const row of reports){assert.ok(row.maskIoU>.985,JSON.stringify(row));assert.ok(row.waterInProjection&&row.waterInOriginal,JSON.stringify(row));}
   fs.writeFileSync('docs/v10/fieldwork/shoreline-registration-v11.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
