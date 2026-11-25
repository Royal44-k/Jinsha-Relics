import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const bytes=await fs.readFile('public/assets/shuoyu.glb'),jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+jsonLength).toString('base64');delete json.images;delete json.textures;delete json.samplers;
function stripTextures(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')stripTextures(object[key]);}}json.materials.forEach(stripTextures);
let lowJSON=null;GLTFLoader.prototype.loadAsync=async function(url){if(url.includes('.lod1.')){if(!lowJSON){const low=await fs.readFile('public/assets/shuoyu.lod1.glb'),size=low.readUInt32LE(12),data=JSON.parse(low.subarray(20,20+size).toString());data.buffers[0].uri='data:application/octet-stream;base64,'+low.subarray(28+size).toString('base64');delete data.images;delete data.textures;delete data.samplers;data.materials.forEach(stripTextures);lowJSON=JSON.stringify(data);}return this.parseAsync(lowJSON,'');}return this.parseAsync(JSON.stringify(json),'');};
const{createCharacter}=await import('../src/v2/character.js');
function measure(character,checkTail=true){
 const root=character.group,mesh=root.getObjectByName('Shuoyu_skin'),breast=root.getObjectByName('Breast'),plumage=root.getObjectByName('Shuoyu_plumage'),point=new T.Vector3(),bodyPoint=new T.Vector3(),bind=mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(breast)].clone().invert(),bodyInverse=breast.matrixWorld.clone().invert();
 root.updateMatrixWorld(true);bodyInverse.copy(breast.matrixWorld).invert();
 const feet=new T.Box3(),points=[];let bodyInside=0,finite=true;
 const footIndices=['L','R'].map(s=>mesh.skeleton.bones.indexOf(root.getObjectByName('Foot'+s)));
 for(let i=0;i<mesh.geometry.attributes.position.count;i++)if(footIndices.includes(mesh.geometry.attributes.skinIndex.getX(i))){
  mesh.getVertexPosition(i,point);mesh.localToWorld(point);finite&&=point.toArray().every(Number.isFinite);bodyPoint.copy(point).applyMatrix4(bodyInverse).applyMatrix4(bind);feet.expandByPoint(bodyPoint);points.push(point.clone());
  const yn=(bodyPoint.y-.53)/.282;if(Math.abs(yn)<1){const rr=Math.sqrt(1-yn*yn),taper=.91-.18*yn+.06*Math.sin(Math.acos(yn)*2),rx=rr*.205*taper+.004,rz=rr*.184+.004,zc=.052+.04*yn;if((bodyPoint.x/rx)**2+((bodyPoint.z-zc)/rz)**2<1)bodyInside++;}
 }
 // Tail triangles in the exported skin; nearest-surface distance includes
 // vane interiors, unlike a check against only the seven feather centre lines.
 if(!checkTail)return{finite,bodyInside,feetMin:feet.min.toArray(),feetMax:feet.max.toArray(),tuck:root.userData.motion.flightTuck??0};
 const tailIndices=plumage.skeleton.bones.map((b,i)=>/^Tail/.test(b.name)?i:-1).filter(i=>i>=0),g=plumage.geometry,tailVertices=new Map(),triangles=[],tri=new T.Triangle(),closest=new T.Vector3();
 for(let i=0;i<g.attributes.position.count;i++)if(tailIndices.includes(g.attributes.skinIndex.getX(i))){plumage.getVertexPosition(i,point);plumage.localToWorld(point);tailVertices.set(i,point.clone());}
 for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.every(id=>tailVertices.has(id)))triangles.push(ids.map(id=>tailVertices.get(id)));}
 let tailDistance=Infinity;for(const p of points)for(const vertices of triangles){tri.set(...vertices);tri.closestPointToPoint(p,closest);tailDistance=Math.min(tailDistance,closest.distanceTo(p));}
 return{finite,bodyInside,tailDistance,feetMin:feet.min.toArray(),feetMax:feet.max.toArray(),tuck:root.userData.motion.flightTuck??0};
}
const report={at:new Date().toISOString(),method:'Production character with actual high/low GLB; CPU textures omitted only. Real skinned foot vertices tested.',cases:[],pauses:[],wingbeats:[]};
for(const lod of [0,1])for(const mode of ['grounded','flying','diving'])for(const fps of [30,60,120]){
 const c=await createCharacter({lod}),speed=mode==='grounded'?9.6:mode==='flying'?11.2:5.4;let finite=true,footContacts=0,bodyInside=0,maxDashPose=0;
 for(let i=0;i<120;i++)c.update(1/60,i/60,{mode,speed:2.2,wingbeat:1,sampleGround:()=>0});
 for(let i=0;i<Math.ceil(fps*.24);i++){
  const progress=i/(fps*.24);c.group.position.z-=speed/fps;c.update(1/fps,i/fps,{mode,speed,dashing:true,dashProgress:progress,dashX:0,dashZ:-1,wingbeat:1,sampleGround:()=>0});
  c.group.updateMatrixWorld(true);c.group.traverse(n=>{if(n.isBone)finite&&=n.matrixWorld.elements.every(Number.isFinite);});footContacts+=c.getFootContacts().filter(p=>p.planted).length;maxDashPose=Math.max(maxDashPose,c.group.userData.motion.dashPose);bodyInside=Math.max(bodyInside,measure(c,false).bodyInside);
 }
 const pose=[];c.group.traverse(n=>{if(n.isBone)pose.push(...n.position,...n.quaternion,...n.scale);});const dashPose=c.group.userData.motion.dashPose;for(let i=0;i<60;i++)c.update(0,i,{mode:'grounded',speed:0,dashing:false});const after=[];c.group.traverse(n=>{if(n.isBone)after.push(...n.position,...n.quaternion,...n.scale);});const pauseDelta=Math.max(...pose.map((v,i)=>Math.abs(v-after[i])));report.pauses.push({lod,mode,fps,pauseDelta,dashPoseDelta:Math.abs(dashPose-c.group.userData.motion.dashPose)});
 for(let i=0;i<120;i++)c.update(1/60,i/60,{mode:'grounded',speed:2.2,dashing:false,sampleGround:()=>0});report.cases.push({lod,mode,fps,finite,footContacts,maxDashPose,bodyInside,recoveredDashPose:c.group.userData.motion.dashPose});c.dispose();
}
for(const fps of [30,60,120])for(const cruise of [false,true]){
 const c=await createCharacter();for(let i=0;i<fps*2;i++)c.update(1/fps,i/fps,{mode:'flying',speed:4.5,wingbeat:1,cruise});const start=c.getWingbeat().count;
 for(let i=0;i<fps*4;i++)c.update(1/fps,i/fps,{mode:'flying',speed:4.5,wingbeat:1,cruise});report.wingbeats.push({fps,cruise,count:c.getWingbeat().count-start});c.dispose();
}
report.hitches=[];
for(const fps of [4,30,60,120]){
 const c=await createCharacter();for(let i=0;i<180;i++)c.update(1/60,i/60,{mode:'flying',speed:4.5,wingbeat:1});const before={...c.getWingbeat()};for(let i=0;i<fps*6;i++)c.update(1/fps,i/fps,{mode:'flying',speed:4.5,wingbeat:1});const after=c.getWingbeat(),expected=Math.floor(before.phase+6*4.9+.5)-Math.floor(before.phase+.5);report.hitches.push({fps,actual:after.count-before.count,expected});c.dispose();
}
await fs.mkdir('docs/v8/character',{recursive:true});await fs.writeFile('docs/v8/character/actions-cpu.json',JSON.stringify(report,null,2));
assert.ok(report.cases.every(r=>r.finite&&r.footContacts===0&&r.maxDashPose>.5&&r.recoveredDashPose<1e-5),'Dash must animate without false grounded footsteps and settle after release');
assert.ok(report.cases.every(r=>r.bodyInside===0),'Real skinned toes must not penetrate the torso during dash poses');
assert.ok(report.pauses.every(r=>r.pauseDelta===0&&r.dashPoseDelta===0),'Paused action pose must hold exactly');
assert.ok(report.wingbeats.filter(r=>r.cruise).every(r=>r.count>=15&&r.count<=18),'Cruise wingbeat should stay bounded across frame rates');
assert.ok(report.hitches.every(r=>r.actual===r.expected),'Render hitches must not discard character animation time or downstrokes');
console.log(JSON.stringify({cases:report.cases.length,pauses:report.pauses.length,maximumBodyIntersection:Math.max(...report.cases.map(r=>r.bodyInside)),wingbeats:report.wingbeats,hitches:report.hitches},null,2));
