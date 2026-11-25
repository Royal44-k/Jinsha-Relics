import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// Reproducible local asset build. Uses the installed Edge browser for WebGL/export.
const root=process.cwd();
const out=path.join(root,'public/assets');
const reportDir=path.join(root,'docs/v7/character');
await fs.mkdir(out,{recursive:true});
const server=await createServer({root,server:{port:5197,strictPort:true,host:'127.0.0.1'},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
const pageErrors=[];page.on('pageerror',e=>{pageErrors.push(e.message);console.error('PAGE ERROR',e.message);});
await page.route('http://127.0.0.1:5197/__character',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#132b29"><script type="module">window.ready=true</script></body></html>'}));
try {
  await page.goto('http://127.0.0.1:5197/__character');
  for(const detail of [1,.58]){
    const data=await page.evaluate(async detail=>{
      const {buildShuoyu}=await import('/scripts/build-shuoyu.source.js');
      const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
      const model=buildShuoyu({detail});
      const binary=await new GLTFExporter().parseAsync(model,{binary:true,animations:model.animations});
      let text='';const bytes=new Uint8Array(binary);for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));const textures={};if(detail===1)model.traverse(n=>{if(n.material)for(const key of ['map','normalMap']){const tex=n.material[key];if(tex?.image?.toDataURL)textures[tex.name]=tex.image.toDataURL('image/png').split(',')[1];}});return {binary:btoa(text),textures};
    },detail);
    const filename=detail===1?'shuoyu.glb':'shuoyu.lod1.glb';
    await fs.writeFile(path.join(out,filename),Buffer.from(data.binary,'base64'));
    for(const [name,png]of Object.entries(data.textures))await fs.writeFile(path.join(out,`shuoyu.${name}.png`),Buffer.from(png,'base64'));
    console.log('Exported',filename,Buffer.from(data.binary,'base64').byteLength);
  }
  const stats=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createCharacter}=await import('/src/v2/character.js');
    const character=await createCharacter();
    const scene=new T.Scene();scene.background=new T.Color('#29302e');scene.fog=new T.Fog('#29302e',4,11);
    const camera=new T.PerspectiveCamera(31,innerWidth/innerHeight,.01,30);camera.position.set(1.65,1.05,-2.7);camera.lookAt(0,.68,.06);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#e0e7e4','#827c70',1.8));
    const key=new T.DirectionalLight('#fff1d9',2.5);key.position.set(-2,3,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.bias=-.00015;key.shadow.normalBias=.015;scene.add(key);
    const rim=new T.DirectionalLight('#d3e1df',1.7);rim.position.set(1,2,3);scene.add(rim);
    const floor=new T.Mesh(new T.CircleGeometry(5,96),new T.MeshStandardMaterial({color:'#414843',roughness:.93}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.01;scene.add(floor);
    scene.add(character.group);character.update(1/60,0,{});renderer.render(scene,camera);
    const stats={meshes:0,skinnedMeshes:0,triangles:0,vertices:0,bones:0,animations:character.group.userData.animations,drawCalls:renderer.info.render.calls,feathers:null,normalizedSkinWeights:true};
    character.group.traverse(n=>{if(n.isMesh){stats.meshes++;stats.triangles+=n.geometry.index?n.geometry.index.count/3:n.geometry.attributes.position.count/3;stats.vertices+=n.geometry.attributes.position.count;if(n.isSkinnedMesh){stats.skinnedMeshes++;stats.bones=Math.max(stats.bones,n.skeleton.bones.length);const w=n.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>1e-5)stats.normalizedSkinWeights=false;}}if(n.userData.feathers)stats.feathers=n.userData.feathers;});
    const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');stats.renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    const bounds=new T.Box3().setFromObject(character.group);stats.bounds={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray()};
    window.preview={character,scene,camera,renderer,T};return stats;
  });
  await page.screenshot({path:path.join(reportDir,'character-asset-three-quarter.png')});
  await page.evaluate(()=>{const{camera,renderer,scene}=window.preview;camera.position.set(-.04,.9,2.5);camera.lookAt(0,.65,.1);renderer.render(scene,camera);});
  await page.screenshot({path:path.join(reportDir,'character-asset-back.png')});
  await page.evaluate(()=>{const{camera,renderer,scene}=window.preview;camera.position.set(.72,1.0,-1.25);camera.lookAt(0,.91,-.13);renderer.render(scene,camera);});
  await page.screenshot({path:path.join(reportDir,'character-asset-face.png')});
  const motion=await page.evaluate(()=>{const{character,renderer,scene,camera}=window.preview;camera.position.set(1.4,1.2,-2.3);camera.lookAt(0,.65,.1);let moved=false,previous=null;for(let i=0;i<180;i++){character.update(1/60,i/60,{speed:2,gliding:i>100,listening:false});const bone=character.group.getObjectByName('LegL');if(previous&&Math.abs(previous-bone.quaternion.x)>.001)moved=true;previous=bone.quaternion.x;}renderer.render(scene,camera);return {legMotion:moved,finiteMatrices:character.group.children.every(n=>n.matrixWorld.elements.every(Number.isFinite))};});
  await page.screenshot({path:path.join(reportDir,'character-asset-glide.png')});
  const blink=await page.evaluate(()=>{const{character,renderer,scene,camera}=window.preview;camera.position.set(.72,1,-1.25);camera.lookAt(0,.91,-.13);let max=0;for(let i=0;i<340;i++){character.update(1/60,i/60,{speed:0,gliding:false});const influence=character.group.getObjectByName('Eyelids').morphTargetInfluences[0];max=Math.max(max,influence);if(influence>.98){renderer.render(scene,camera);break;}}return max;});
  await page.screenshot({path:path.join(reportDir,'character-asset-blink.png')});
  const lod1=await page.evaluate(async()=>{const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/shuoyu.lod1.glb');let triangles=0;gltf.scene.traverse(n=>{if(n.isMesh)triangles+=n.geometry.index.count/3;});return {triangles,animations:gltf.animations.length};});
  Object.assign(stats,{lod1,animationVerification:{...motion,blinkMorphPeak:blink},pageErrors,date:new Date().toISOString(),method:'Imported exported GLB, checked normalized skin weights, animated real AnimationMixer, rendered in headless Edge'});
  if(pageErrors.length||!motion.legMotion||!motion.finiteMatrices||!stats.normalizedSkinWeights||blink<.98)throw new Error('Character verification failed');
  await fs.writeFile(path.join(reportDir,'character-asset-verification.json'),JSON.stringify(stats,null,2));
  console.log(JSON.stringify(stats,null,2));
} finally {await browser.close();await server.close();}



