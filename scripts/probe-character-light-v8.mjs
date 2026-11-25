import {createServer} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='docs/v8/character/lighting-probe';await fs.mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),server:{port:5197,strictPort:true,host:'127.0.0.1'},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1}),report={at:new Date().toISOString(),method:'Frozen V7 GLB/runtime, identical fixed pose and unchanged lamps/exposure. Candidate material overrides only. Local look-development, not whole-game performance.',errors:[],samples:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/assets/shuoyu.glb',r=>r.fulfill({contentType:'model/gltf-binary',path:'docs/v8/baseline/dist/assets/shuoyu.glb'}));
await page.route('**/__character-light-v8',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#28332f"></body>'}));
try{
 await page.goto('http://127.0.0.1:5197/__character-light-v8');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const load=GLTFLoader.prototype.loadAsync;GLTFLoader.prototype.loadAsync=function(url){return load.call(this,url.replace('/assets/','/docs/v8/baseline/dist/assets/'));};
  const {createCharacter}=await import('/docs/v8/baseline/src/v2/character.js');const character=await createCharacter();
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;document.body.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(33,innerWidth/innerHeight,.01,30);camera.position.set(1.65,1.02,-2.65);camera.lookAt(0,.65,.02);scene.add(character.group);
  const key=new T.DirectionalLight('#ffe5b6',4.1),hemi=new T.HemisphereLight('#c6d7db','#29382a',.68),fill=new T.DirectionalLight('#b3d1df',.65);fill.position.set(6,7,-9);scene.add(key,hemi,fill);
  const{HDRLoader}=await import('/node_modules/three/examples/jsm/loaders/HDRLoader.js');const hdr=await new HDRLoader().loadAsync('/assets/environment/forest-light-512.hdr');hdr.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=.60;scene.environmentRotation.y=.72;pmrem.dispose();hdr.dispose();
  for(let i=0;i<120;i++)character.update(1/60,i/60,{mode:'grounded',speed:0});
  const original=new Map();character.group.traverse(n=>{if(n.material)original.set(n.material,{color:n.material.color.clone(),roughness:n.material.roughness,metalness:n.material.metalness,sheen:n.material.sheen,anisotropy:n.material.anisotropy,normalScale:n.material.normalScale?.clone(),envMapIntensity:n.material.envMapIntensity});});
  window.probe={T,character,renderer,scene,camera,key,hemi,fill,original};
 });
 for(const view of ['three-quarter','back'])for(const light of ['front','top','backlit','shade','wet'])for(const variant of ['baseline','sheen','normals','balanced']){
  const result=await page.evaluate(({view,light,variant})=>{
   const{T,character,renderer,scene,camera,key,hemi,fill,original}=window.probe;
   // Hold the exact bone/morph pose across every material candidate. Advancing
   // idle time here would confound highlight-area comparisons with head motion.
   for(const[m,p]of original){m.color.copy(p.color);m.roughness=p.roughness;m.metalness=p.metalness;m.envMapIntensity=p.envMapIntensity;if(m.isMeshPhysicalMaterial){m.sheen=p.sheen;m.anisotropy=p.anisotropy;}if(p.normalScale)m.normalScale.copy(p.normalScale);
    if(/feather|down/i.test(m.name)){
     if(variant==='sheen'||variant==='balanced')m.sheen*=.52;
     if(variant==='normals'||variant==='balanced'){m.normalScale?.multiplyScalar(.55);if(m.anisotropy)m.anisotropy=.25;}
     if(variant==='balanced'){m.metalness=0;m.roughness=Math.max(.77,m.roughness);m.envMapIntensity=.78;}
     if(light==='wet'){m.color.multiplyScalar(.85);m.roughness=Math.max(variant==='balanced'?.48:.30,m.roughness*.43);if(m.isMeshPhysicalMaterial)m.sheen*=.22;}
    }
   }
   camera.position.set(...(view==='back'?[.18,1.1,2.8]:[1.65,1.02,-2.65]));camera.lookAt(0,.65,.02);
   const pos={front:[-2,4,-3],top:[0,8,0],backlit:[1,2,3],shade:[-2,4,-3],wet:[-2,4,-3]}[light];key.position.set(...pos);key.intensity=light==='shade'?.55:4.1;hemi.intensity=.68;scene.environmentIntensity=.60;renderer.render(scene,camera);
   const gl=renderer.getContext(),pixels=new Uint8Array(innerWidth*innerHeight*4);gl.readPixels(0,0,innerWidth,innerHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const values=[];let white=0,bright=0,saturated=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>245){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],l=(.2126*r+.7152*g+.0722*b)/255;values.push(l);if(r>235&&g>235&&b>235)white++;if(l>.85)bright++;if(Math.max(r,g,b)>250)saturated++;}values.sort((a,b)=>a-b);
   return{view,light,variant,pixels:values.length,whiteFraction:white/values.length,brightFraction:bright/values.length,saturatedChannelFraction:saturated/values.length,median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],gl:gl.getError()};
  },{view,light,variant});
  report.samples.push(result);await page.screenshot({path:`${out}/${view}-${light}-${variant}.png`});
 }
 assert.deepEqual(report.errors,[]);assert.ok(report.samples.every(s=>s.gl===0));console.log(JSON.stringify(report.samples.map(({view,light,variant,brightFraction,p95})=>({view,light,variant,brightFraction,p95})),null,2));
}finally{await browser.close();await server.close();await fs.writeFile(out+'/results.json',JSON.stringify(report,null,2));}
