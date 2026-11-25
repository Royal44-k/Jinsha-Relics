import {createServer} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/v9/character/motion-review';await fs.mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),server:{port:5197,strictPort:true,host:'127.0.0.1'},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1080}}),report={at:new Date().toISOString(),method:'Actual exported high/low GLB and production pose. Isolated fixed illumination, exact frame time. Synthetic .29m branch for readable grip; live-world branch tests are separate.',errors:[],samples:[]};page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.route('**/__motion',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5197/__motion');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createCharacter}=await import('/src/v2/character.js'),scene=new T.Scene();scene.background=new T.Color('#29302e');
  const camera=new T.PerspectiveCamera(31,innerWidth/innerHeight,.01,30),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight('#e0e7e4','#827c70',1.35));const key=new T.DirectionalLight('#fff1d9',2.5);key.position.set(-2,3,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2});key.shadow.bias=-.00015;key.shadow.normalBias=.01;scene.add(key);const rim=new T.DirectionalLight('#d3e1df',.85);rim.position.set(1,2,3);scene.add(rim);
  const floor=new T.Mesh(new T.CircleGeometry(5,96),new T.MeshStandardMaterial({color:'#414843',roughness:.93}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const branch=new T.Mesh(new T.CylinderGeometry(.29,.29,3,24,1),new T.MeshStandardMaterial({color:'#554535',roughness:.94}));branch.rotation.z=Math.PI/2;branch.position.y=-.29;branch.castShadow=branch.receiveShadow=true;scene.add(branch);
  window.motionReview={T,scene,camera,renderer,createCharacter,floor,branch,character:null};
 });
 const cases=[
  {id:'flinch-grounded',mode:'grounded',speed:0,view:'three-quarter',flinch:true},
  {id:'flinch-air',mode:'flying',speed:4.5,view:'three-quarter',flinch:true},
  ...[0,1,2].flatMap(level=>['three-quarter','back'].map(view=>({id:'growth-'+level+'-'+view,mode:'grounded',speed:0,view,level}))),
  {id:'walk-stance',mode:'grounded',speed:2.2,phase:.15,view:'side'},
  {id:'quick-stance',mode:'grounded',speed:3.9,phase:.15,view:'side'},
  {id:'quick-swing',mode:'grounded',speed:3.9,phase:.78,view:'side'},
  {id:'dash-ground',mode:'grounded',speed:9.6,dash:true,view:'three-quarter'},
  {id:'cruise-upstroke',mode:'flying',speed:4.5,cruise:true,phase:.12,view:'three-quarter'},
  {id:'cruise-downstroke',mode:'flying',speed:4.5,cruise:true,phase:.60,view:'three-quarter'},
  {id:'dash-air',mode:'flying',speed:11.2,dash:true,view:'back'},
  {id:'glide-back',mode:'gliding',speed:4.5,view:'back'},
  {id:'perch-approach',mode:'flying',speed:1.5,approach:true,view:'three-quarter'},
  {id:'perch-settled',mode:'perched',speed:0,view:'three-quarter'},
  {id:'perch-back',mode:'perched',speed:0,view:'back'},
  {id:'perch-feet',mode:'perched',speed:0,view:'feet'},
  {id:'perch-feet-lod1',mode:'perched',speed:0,view:'feet',lod:1},
  {id:'swim-side',mode:'swimming',speed:1.9,view:'side'},
  {id:'dive-side',mode:'diving',speed:2.4,view:'side'},
 ];
 for(const sample of cases){
  const stats=await page.evaluate(async sample=>{
   const p=window.motionReview;p.character?.dispose();const c=await p.createCharacter({lod:sample.lod||0});p.character=c;p.scene.add(c.group);const state={mode:sample.mode,speed:sample.dash?2.2:sample.speed,cruise:!!sample.cruise,perchApproach:sample.approach?'review':null,wingbeat:['flying','rising'].includes(sample.mode)?1:0,sampleGround:()=>0,growth:{level:sample.level||0}};
   for(let i=0;i<240;i++){if(sample.mode==='grounded')c.group.position.z-=state.speed/120;c.update(1/120,i/120,state);}
   if(sample.phase!==undefined){for(let i=0;i<240;i++){if(sample.mode==='grounded')c.group.position.z-=state.speed/240;c.update(1/240,i/240,state);const phase=sample.mode==='grounded'?c.group.userData.motion.phase:c.getWingbeat().phase;if(Math.abs(phase-sample.phase)<.013)break;}}
   if(sample.dash){for(let i=0;i<15;i++)c.update(1/120,i/120,{...state,speed:sample.speed,dashing:true,dashProgress:i/(120*.24),dashX:0,dashZ:-1});}
   if(sample.flinch){c.trigger('Flinch');for(let i=0;i<15;i++)c.update(1/120,i/120,state);}
   c.group.position.set(0,0,0);p.floor.position.y=sample.mode==='grounded'?-.005:-.75;p.branch.visible=sample.mode==='perched';p.camera.position.set(...({side:[2.9,.95,.25],back:[-.04,.9,2.7],feet:[.44,.21,-.65],'three-quarter':[1.65,1.05,-2.7]}[sample.view]));p.camera.lookAt(...(sample.view==='feet'?[0,.11,-.02]:[0,.66,.06]));p.renderer.render(p.scene,p.camera);
   return{gl:p.renderer.getContext().getError(),motion:c.group.userData.motion,feet:c.getFootContacts().map(f=>({side:f.side,planted:f.planted,position:f.position.toArray()})),drawCalls:p.renderer.info.render.calls};
  },sample);report.samples.push({...sample,...stats});await page.screenshot({path:`${out}/${sample.id}.png`});
 }
 assert.deepEqual(report.errors,[]);assert.ok(report.samples.every(s=>s.gl===0));console.log(JSON.stringify({samples:report.samples.length,errors:report.errors},null,2));
}finally{await browser.close();await server.close();await fs.writeFile(`${out}/results.json`,JSON.stringify(report,null,2));}

