const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',out=path.resolve('docs/v10/fieldwork');
const fixture=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#1d2926;color:#e8ddba;font:14px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}figure{position:relative;margin:0;overflow:hidden}figure img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}figcaption{position:absolute;bottom:0;left:0;right:0;padding:15px 12px 5px;background:linear-gradient(transparent,#202b25b3);letter-spacing:.06em}</style><main></main><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import {createStations} from '/src/v10/stations.js';import {sites,createSurveyWorld,ground,riverX,riverWidth} from '/src/v10/geography.js';
import {postOffsets,postWidth} from '/src/v10/post-layout.js';import {createFieldReading} from '/src/v10/field-reading.js';
window.captureStations=async()=>{
  const scene=new T.Scene();scene.background=new T.Color(0xa8b5ad);scene.fog=new T.FogExp2(0xa8b5ad,.027);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,300,false);
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const camera=new T.PerspectiveCamera(41,480/300,.1,50),light=new T.DirectionalLight(0xffdca5,2.3);light.castShadow=true;
  Object.assign(light.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:39});light.shadow.mapSize.set(768,768);light.shadow.normalBias=.015;
  scene.add(light,light.target,new T.HemisphereLight(0xedf4dc,0x777668,1.4));
  const world=createSurveyWorld(),{groups,update,dispose,ready}=createStations(scene,world);await ready;
  const tex=await new T.TextureLoader().loadAsync('/assets/v5/ground/aerial_grass_rock_diff_1k.webp');
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(11,11);
  const flat=new T.PlaneGeometry(72,110,120,170);flat.rotateX(-Math.PI/2);flat.translate(0,0,-14);
  const coords=flat.attributes.position;
  for(let i=0;i<coords.count;i++)coords.setY(i,ground(coords.getX(i),coords.getZ(i)));flat.computeVertexNormals();
  const earth=new T.Mesh(flat,new T.MeshStandardMaterial({map:tex,roughness:.95,color:0xd6d4b0}));earth.receiveShadow=true;scene.add(earth);
  const waterGeom=new T.PlaneGeometry(72,110,1,1);waterGeom.rotateX(-Math.PI/2);const water=new T.Mesh(waterGeom,new T.MeshStandardMaterial({color:0x647d73,roughness:.3}));water.position.set(0,.014,-14);scene.add(water);
  const target=new T.Vector3(0,0,0);const findings=[];let t=1,firstOpaque=false,deckFromAbove=false,underRaftSwimmable=false;
  for(let i=0;i<sites.length;i++){
    const [x,z]=sites[i],before=world.perches.length,start=performance.now();
    target.set(x,ground(x,z),z);
    update(t+=.1,i,target);const buildMs=performance.now()-start;
    if(i===0)firstOpaque=groups[0].children.every(o=>o.material.opacity===1&&!o.material.transparent&&!o.material.alphaHash);
    for(let j=0;j<10;j++)update(t+=.15,i,target);
    const g=groups[i],future=groups.slice(i+1).some(s=>s.visible);await g.userData.assetReady;
    if(i===1){
      const [deck,raft]=world.surfaces.slice(-2);
      const dx=(deck.minX+deck.maxX)/2,dz=(deck.minZ+deck.maxZ)/2,rx=(raft.minX+raft.maxX)/2,rz=(raft.minZ+raft.maxZ)/2;
      const full=world.sample(new T.Vector3(dx,3,dz));deckFromAbove=Math.abs(full.groundHeight-deck.heightAt(dx,dz))<.0001&&full.waterDepth===0;
      const below=world.sample(new T.Vector3(rx,-1,rz));underRaftSwimmable=below.waterDepth>.3&&below.groundHeight<-.35;
    }
    const minClear=Math.min(...world.colliders.map(c=>Math.hypot(c.x-x,c.z-z)-c.radius));
    let finite=true,triangles=0;g.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;triangles+=(o.geometry.index?.count||pos.count)/3;
      if(!pos.array.every(Number.isFinite)||!o.geometry.attributes.normal.array.every(Number.isFinite))finite=false;});
    const viewX=x+(i===1?2:i===2?2.1:i===8?2.12:0),viewZ=z+(i===1?-1.8:i===2?-1.9:i===8?-4.16:-2.1),h=Math.max(.15,ground(viewX,viewZ));
    camera.position.set(viewX+(i===1?-5.4:3.2),h+(i===8?6.35:3.2),viewZ+(i===1?4.4:i===8?7.8:6.3));camera.lookAt(viewX,h+(i===8?.10:.67),viewZ);
    light.position.set(viewX-6,h+12,viewZ+8);light.target.position.set(viewX,h,viewZ);renderer.render(scene,camera);
    const img=document.createElement('img');img.src=renderer.domElement.toDataURL('image/jpeg',.89);await img.decode();
    const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=g.name;figure.append(img,caption);document.querySelector('main').append(figure);
    findings.push({name:g.name,batches:g.children.length,triangles,buildMs:Math.round(buildMs*10)/10,finite,minCenterClearance:+minClear.toFixed(3),perches:world.perches.length-before,future});
  }
  const reconstruction=new T.Scene(),columns=[];
  createFieldReading(reconstruction,()=>{});
  reconstruction.traverse(o=>{const p=o.geometry?.parameters;if(o.isMesh&&o.geometry.type==='BoxGeometry'&&p.width===postWidth&&p.depth===postWidth&&p.height===1)columns.push(o);});
  const joinedSockets=postOffsets.filter(([ox,oz])=>{
    const x=sites[8][0]+ox,z=sites[8][1]+oz,soil=ground(x,z);
    const floor=world.sample(new T.Vector3(x,soil+.8,z)).groundHeight;
    return columns.some(o=>Math.hypot(o.position.x-x,o.position.z-z)<.00001)&&Math.abs(floor-soil-.026)<.0001;
  }).length;
  update(t+=.1,9,new T.Vector3(250,0,250));const allCulled=groups.every(g=>!g.visible);
  update(t+=.1,0,new T.Vector3(sites[0][0],2,sites[0][1]));const resetGates=world.perches.length===1&&world.surfaces.length===1&&groups.slice(1).every(g=>!g.visible);
  dispose();const removed=world.colliders.length+world.perches.length+world.surfaces.length===0;
  renderer.dispose();return {findings,joinedSockets,allCulled,firstOpaque,deckFromAbove,underRaftSwimmable,resetGates,removed};
};</script></html>`;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||(fs.existsSync(edge)?edge:undefined),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:750}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.route('**/station-check',r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto(base+'/station-check',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof window.captureStations==='function');const result=await page.evaluate(()=>window.captureStations());
    await page.locator('main').screenshot({path:path.join(out,'map-landmarks.jpg'),quality:88});result.errors=errors;
    fs.writeFileSync(path.join(out,'map-landmarks.json'),JSON.stringify(result,null,2));
    assert.deepEqual(errors,[]);assert.equal(result.findings.length,9);assert.equal(result.joinedSockets,9);
    for(const key of ['allCulled','firstOpaque','deckFromAbove','underRaftSwimmable','resetGates','removed'])assert.equal(result[key],true,key);
    for(const f of result.findings){assert.ok(f.finite&&f.minCenterClearance>=1.2&&f.batches>=2&&f.batches<=10&&f.perches>0&&!f.future,JSON.stringify(f));}
    console.log(result.findings.map(f=>f.name+' '+f.batches+' draws / '+f.triangles+' tris').join('\n'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
