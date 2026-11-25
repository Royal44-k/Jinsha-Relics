import{chromium}from'playwright';
import fs from'node:fs/promises';
import crypto from'node:crypto';
const out='public/assets/v9';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:480,height:480},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/__growth-cards',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:transparent"></body>'}));
const report={at:new Date().toISOString(),method:'Production exported Shuoyu GLB and character runtime, identical neutral three-quarter camera/lamps, transparent WebGL canvas, no floor, bloom, DOF or image generation.',assets:[]};
try{
 await page.goto('http://127.0.0.1:5186/__growth-cards');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createCharacter}=await import('/src/v2/character.js');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(29,1,.01,20),renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(2);renderer.setSize(480,480);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.appendChild(renderer.domElement);
  camera.position.set(1.72,1.02,-2.30);camera.lookAt(0,.66,.06);
  scene.add(new T.HemisphereLight('#d8e9e7','#746b54',1.65));
  const key=new T.DirectionalLight('#fff1d7',2.55);key.position.set(-2.3,3.3,-3);scene.add(key);
  const rim=new T.DirectionalLight('#c2e3e3',1.25);rim.position.set(2,2.2,3);scene.add(rim);
  window.cards={T,createCharacter,scene,camera,renderer,character:null};
 });
 for(const level of[0,1,2]){
  const pose=await page.evaluate(async level=>{const p=window.cards;p.character?.dispose();const c=await p.createCharacter();p.character=c;p.scene.add(c.group);for(let i=0;i<120;i++)c.update(1/60,i/60,{mode:'grounded',speed:0,growth:{level}});p.renderer.render(p.scene,p.camera);return{growth:c.getGrowth(),drawCalls:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles,gl:p.renderer.getContext().getError()};},level);
  const file=`${out}/growth-${level}.png`;await page.screenshot({path:file,omitBackground:true});const bytes=await fs.readFile(file);report.assets.push({level,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...pose});
 }
 report.errors=errors;if(errors.length||report.assets.some(a=>a.gl))throw new Error('Growth card render failed');
 const glb=await fs.readFile('public/assets/shuoyu.glb');report.modelSha256=crypto.createHash('sha256').update(glb).digest('hex');
 await fs.writeFile('docs/v9/character/growth-card-renders.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
