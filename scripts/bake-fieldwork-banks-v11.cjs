const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const url=(process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197')+'/__bake-field-banks';
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<script type=module>import * as T from "/node_modules/three/build/three.module.js";import {buildBanks} from "/src/v10/fieldwork-river.js";window.libs={T,buildBanks};</script>'}));
  await page.goto(url);await page.waitForFunction(()=>window.libs);
  await page.evaluate(()=>{
   const {T,buildBanks}=window.libs,s=new T.Scene(),renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(1848,1596);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
   const textures=new Map();const texture=url=>{if(!textures.has(url)){const tex=new T.TextureLoader().load(url);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;textures.set(url,tex);}return textures.get(url);};
   const sun=new T.DirectionalLight(0xffde9c,2.35);sun.position.set(-9,13,7);s.add(sun,new T.HemisphereLight(0xf7e7c5,0x5b705f,1.35));const fill=new T.DirectionalLight(0x91bbb0,.45);fill.position.set(9,5,-7);s.add(fill);
   const occluder=new T.Mesh(new T.PlaneGeometry(90,120),new T.MeshBasicMaterial({colorWrite:false,depthWrite:true}));occluder.rotation.x=-Math.PI/2;occluder.position.set(0,.005,-17);occluder.renderOrder=-9;s.add(occluder);
   buildBanks({scene:s,texture,software:false});
   const camera=new T.OrthographicCamera(-22,22,19,-19,.05,150),target=new T.Vector3(0,0,-17);
   camera.position.copy(target).add(new T.Vector3(1.75,8.05,11.8).normalize().multiplyScalar(50));camera.lookAt(target);camera.updateMatrixWorld();
   window.capture=()=>{renderer.render(s,camera);return renderer.domElement.toDataURL('image/webp',.90).split(',')[1];};
  });
  await page.waitForLoadState('networkidle');const data=await page.evaluate(()=>window.capture());
  fs.writeFileSync('public/assets/v10/fieldwork-riverbank-lod.webp',Buffer.from(data,'base64'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
