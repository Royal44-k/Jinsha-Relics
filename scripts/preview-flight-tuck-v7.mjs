import {createServer} from 'vite';
import{chromium}from'playwright';
import fs from'node:fs/promises';
const OUT='docs/v7/character/flight-tuck';await fs.mkdir(OUT,{recursive:true});
const server=await createServer({root:process.cwd(),server:{port:5199,strictPort:true,host:'127.0.0.1'},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('http://127.0.0.1:5199/__flight',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));await page.goto('http://127.0.0.1:5199/__flight');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createCharacter}=await import('/src/v2/character.js'),{createCharacter:createOld}=await import('/docs/v7/character/character-pre-tuck.js');
  const scene=new T.Scene();scene.background=new T.Color('#29302e');const camera=new T.PerspectiveCamera(31,innerWidth/innerHeight,.01,30);camera.position.set(1.65,1.05,-2.7);camera.lookAt(0,.68,.06);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight('#e0e7e4','#827c70',1.8));const key=new T.DirectionalLight('#fff1d9',2.5);key.position.set(-2,3,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2});key.shadow.bias=-.00015;key.shadow.normalBias=.015;scene.add(key);const rim=new T.DirectionalLight('#d3e1df',1.7);rim.position.set(1,2,3);scene.add(rim);
  const floor=new T.Mesh(new T.CircleGeometry(5,96),new T.MeshStandardMaterial({color:'#414843',roughness:.93}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
  const old=await createOld(),current=await createCharacter();scene.add(old.group,current.group);for(let i=0;i<180;i++)for(const c of[old,current])c.update(1/60,i/60,{mode:'gliding',speed:4});window.preview={old,current,scene,camera,renderer,T};
 });
 for(const view of['three-quarter','side','back'])for(const version of['old','current']){
  await page.evaluate(({view,version})=>{const{old,current,scene,camera,renderer}=window.preview;old.group.visible=version==='old';current.group.visible=version==='current';camera.position.set(...(view==='side'?[2.9,.95,.25]:view==='back'?[-.04,.9,2.5]:[1.65,1.05,-2.7]));camera.lookAt(0,.68,.06);renderer.render(scene,camera);},{view,version});await page.screenshot({path:`${OUT}/${version}-${view}.png`});
 }
 for(const mode of['rising','falling','grounded','perched']){await page.evaluate(mode=>{const{current,scene,camera,renderer}=window.preview;camera.position.set(1.65,1.05,-2.7);camera.lookAt(0,.68,.06);for(let i=0;i<120;i++)current.update(1/60,i/60,{mode,speed:mode==='grounded'||mode==='perched'?0:4,sampleGround:()=>0});renderer.render(scene,camera);},mode);await page.screenshot({path:`${OUT}/current-${mode}.png`});}
 const result=await page.evaluate(()=>({gl:window.preview.renderer.getContext().getError(),motion:window.preview.current.group.userData.motion}));await fs.writeFile(`${OUT}/visual-verification.json`,JSON.stringify({at:new Date().toISOString(),errors,...result},null,2));if(errors.length||result.gl)throw Error('Flight visual rendering failed');console.log(JSON.stringify({errors,gl:result.gl}));
}finally{await browser.close();await server.close();}

