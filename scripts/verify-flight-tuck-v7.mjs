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
if(process.argv.includes('--search')){
 const character=await createCharacter();for(let i=0;i<180;i++)character.update(1/60,i/60,{mode:'gliding',speed:4});
 const rest={};for(const s of ['L','R'])for(const b of ['Leg','Hock','Foot'])rest[b+s]=character.group.getObjectByName(b+s).quaternion.clone();const rows=[];
 for(const leg of [-.60,-.85,-1.05])for(const hock of [-.4,-.2,0])for(const foot of [-1.4,-1.7]){
  for(const s of ['L','R'])for(const [b,v]of [['Leg',leg],['Hock',hock],['Foot',foot]])character.group.getObjectByName(b+s).quaternion.copy(rest[b+s]).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),v));
  character.group.getObjectByName('Shuoyu_skin').morphTargetInfluences.fill(.5);rows.push({leg,hock,foot,...measure(character)});
 }
 await fs.writeFile('docs/v7/character/flight-tuck-search.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.filter(r=>r.bodyInside===0&&r.tailDistance>.02),null,2));character.dispose();
}else{
 const report={at:new Date().toISOString(),cases:[],transitions:[]};
 for(const mode of ['grounded','rising','flying','gliding','falling','perched'])for(const speed of [0,2,4,5.4]){
  const character=await createCharacter();for(let i=0;i<180;i++)character.update(1/60,i/60,{mode,speed,sampleGround:()=>0});report.cases.push({lod:0,mode,speed,...measure(character)});character.dispose();
 }
 for(const[mode,speed]of[['flying',4],['gliding',5.4],['falling',4]]){const character=await createCharacter({lod:1});for(let i=0;i<180;i++)character.update(1/60,i/60,{mode,speed});report.cases.push({lod:1,mode,speed,...measure(character)});character.dispose();}
 for(const fps of[30,60,120]){
  const character=await createCharacter();let frame=0,bodyInside=0,finite=true;
  for(const mode of['rising','flying','gliding','falling','grounded','perched']){
   for(let i=0;i<fps;i++){character.update(1/fps,frame++/fps,{mode,speed:mode==='grounded'||mode==='perched'?0:4,sampleGround:()=>0});character.group.updateMatrixWorld(true);character.group.traverse(n=>{if(n.isBone)finite&&=n.matrixWorld.elements.every(Number.isFinite);});if(i%Math.round(fps/6)===0)bodyInside+=measure(character,false).bodyInside;}
   report.transitions.push({fps,mode,finite,bodyInside,tuck:character.group.userData.motion.flightTuck});
  }
  for(let i=0;i<fps;i++)character.update(1/fps,frame++/fps,{mode:'gliding',speed:4});
  const pose={};character.group.traverse(n=>{if(n.isBone)pose[n.name]=[...n.position,...n.quaternion,...n.scale];});const tuck=character.group.userData.motion.flightTuck;let pauseDelta=0;
  for(let i=0;i<120;i++)character.update(0,100+i,{mode:'falling',speed:0});character.group.traverse(n=>{if(n.isBone){const next=[...n.position,...n.quaternion,...n.scale];next.forEach((v,i)=>pauseDelta=Math.max(pauseDelta,Math.abs(v-pose[n.name][i])));}});
  report.transitions.push({fps,mode:'paused',pauseDelta,tuckDelta:Math.abs(tuck-character.group.userData.motion.flightTuck)});character.dispose();
 }
 await fs.writeFile('docs/v7/character/flight-tuck-verification.json',JSON.stringify(report,null,2));
 assert.ok(report.cases.every(c=>c.finite&&c.bodyInside===0),'Stable foot pose enters the body hull');
 assert.ok(report.cases.filter(c=>['flying','gliding'].includes(c.mode)&&c.speed>=4).every(c=>c.tuck>.98&&c.feetMin[1]>.18&&c.feetMin[2]>.20&&c.tailDistance>.025),'Fast flight feet must stay aft of the belly and clear of actual tail triangles');
 assert.ok(report.cases.filter(c=>!['flying','gliding'].includes(c.mode)).every(c=>c.tuck===0),'Non-cruise modes must extend');
 assert.ok(report.transitions.every(c=>c.mode==='paused'?c.pauseDelta===0&&c.tuckDelta===0:c.finite&&c.bodyInside===0),'Transition or pause pose failed');
 console.log(JSON.stringify({stableCases:report.cases.length,transitionCases:report.transitions.length,minHighSpeedTailClearance:Math.min(...report.cases.filter(c=>['flying','gliding'].includes(c.mode)&&c.speed>=4).map(c=>c.tailDistance)),bodyInside:Math.max(...report.cases.map(c=>c.bodyInside)),pauseDelta:Math.max(...report.transitions.filter(c=>c.mode==='paused').map(c=>c.pauseDelta))},null,2));
}
