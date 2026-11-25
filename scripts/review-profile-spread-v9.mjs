import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
const bytes=fs.readFileSync('public/assets/shuoyu.glb'),size=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+size).toString());data.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete data.images;delete data.textures;delete data.samplers;
function strip(o){for(const k of Object.keys(o))if(/texture/i.test(k))delete o[k];else if(o[k]&&typeof o[k]==='object')strip(o[k]);}data.materials.forEach(strip);
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(data),''),idle=gltf.animations.find(c=>c.name==='IdleBreath'),blink=gltf.animations.find(c=>c.name==='Blink'),glide=gltf.animations.find(c=>c.name==='Glide'),wing=/Wing|Flight|Primary|TailFan/;
const spread=new T.AnimationClip('PreviewSpread',glide.duration,glide.tracks.filter(t=>wing.test(t.name)).map(t=>t.clone()));
const report={at:new Date().toISOString(),assetHash:crypto.createHash('sha256').update(bytes).digest('hex'),mainHash:crypto.createHash('sha256').update(fs.readFileSync('src/v2/main.js')).digest('hex'),method:'Actual high GLB and Three AnimationMixer. Real skinned wing vertices, no textures/renderer. Same mask, weight and fadeIn as main makePreview. Four base combinations; each sampled at 0,1/60,.35,1,2s after button.',clips:{idleTracks:idle.tracks.length,blinkTracks:blink.tracks.length,spreadTracks:spread.tracks.length,idleOverlap:idle.tracks.filter(t=>spread.tracks.some(g=>g.name===t.name)).map(t=>t.name),blinkOverlap:blink.tracks.filter(t=>spread.tracks.some(g=>g.name===t.name)).map(t=>t.name)},cases:[]};
for(const mode of ['idle-only','glide-only','profile-current','filtered-breath-candidate']){
 const model=clone(gltf.scene),mixer=new T.AnimationMixer(model),meshes=[];
 model.traverse(m=>{if(!m.isSkinnedMesh)return;const indices=[];for(let i=0;i<m.geometry.attributes.position.count;i++){const si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight;let onWing=false;for(let j=0;j<4;j++)if(sw.getComponent(i,j)>.001&&/Wing|Flight|Primary/.test(m.skeleton.bones[si.getComponent(i,j)]?.name))onWing=true;if(onWing)indices.push(i);}if(indices.length)meshes.push({mesh:m,indices});});
 if(mode==='idle-only'||mode==='profile-current')mixer.clipAction(idle).play();
 if(mode==='filtered-breath-candidate')mixer.clipAction(new T.AnimationClip('BreathOnly',idle.duration,idle.tracks.filter(t=>t.name.endsWith('Breast.scale')).map(t=>t.clone()))).play();
 if(mode!=='glide-only')mixer.clipAction(blink).play();mixer.update(2);
 let action=null;if(mode!=='idle-only'){action=mixer.clipAction(spread);action.reset().setEffectiveWeight(1).fadeIn(.35).play();}
 const entry={mode,buttonImmediate:action?{weight:action.weight,effective:action.getEffectiveWeight()}:null,samples:[]};report.cases.push(entry);let previous=0;
 for(const time of [0,1/60,.35,1,2]){
  mixer.update(time-previous);previous=time;model.updateMatrixWorld(true);const box=new T.Box3(),p=new T.Vector3();let vertices=0;
  for(const {mesh,indices} of meshes)for(const i of indices){mesh.getVertexPosition(i,p);mesh.localToWorld(p);box.expandByPoint(p);vertices++;}
  const tips={};model.traverse(n=>{if(n.isBone&&/Flight|Primary/.test(n.name))tips[n.name]=n.getWorldPosition(new T.Vector3()).toArray();});
  entry.samples.push({time,weight:action?.weight??null,effective:action?.getEffectiveWeight()??null,wingVertices:vertices,wingBounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray()},tipBones:tips});
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);
}
fs.mkdirSync('docs/v9/character/review',{recursive:true});fs.writeFileSync('docs/v9/character/review/profile-spread-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify({clips:report.clips,cases:report.cases.map(c=>({mode:c.mode,buttonImmediate:c.buttonImmediate,samples:c.samples.map(s=>({time:s.time,weight:s.weight,effective:s.effective,width:s.wingBounds.size[0],height:s.wingBounds.size[1]}))}))},null,2));
