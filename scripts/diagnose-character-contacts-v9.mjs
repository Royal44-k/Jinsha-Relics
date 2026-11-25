import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';

// CPU-only verification of the real exported geometry and production runtime.
// Textures are omitted only from this test load; no fake skeleton or test rig.
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const bytes=await fs.readFile('public/assets/shuoyu.glb'),jsonLength=bytes.readUInt32LE(12);
const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binStart=20+jsonLength+8;
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(binStart).toString('base64');
delete json.images;delete json.textures;delete json.samplers;
function stripTextures(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')stripTextures(object[key]);}}
json.materials.forEach(stripTextures);
GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(JSON.stringify(json),'');};
const{createCharacter}=await import('../src/v2/character.js');
const report={at:new Date().toISOString(),method:'CPU GLTFParser with production exported skeleton/geometry and runtime; omitted texture images only',cases:[],slopes:[]};
for(const fps of [30,60,120])for(const speed of [2.2,3.9,5.0]){
 const character=await createCharacter(),old={},record={fps,speed,maxSlide:0,maxStanceDrift:0};
 for(let i=0;i<180;i++)character.update(1/60,i/60,{mode:'grounded',speed,sampleGround:()=>0});
 for(let i=0;i<fps*4;i++){
  const yaw=i/fps*.8;character.group.rotation.y=yaw;character.group.position.x-=Math.sin(yaw)*speed/fps;character.group.position.z-=Math.cos(yaw)*speed/fps;
  character.update(1/fps,i/fps,{mode:'grounded',speed,sampleGround:()=>0});
  for(const contact of character.getFootContacts()){
   const previous=old[contact.id],ankle=character.group.getObjectByName('Foot'+contact.side).getWorldPosition(new THREE.Vector3()),hip=character.group.getObjectByName('Leg'+contact.side).getWorldPosition(new THREE.Vector3());
   let start=contact.position.clone();
   if(contact.planted&&previous?.planted&&contact.phase>=previous.phase){
    start=previous.start;
    const distance=contact.position.distanceTo(previous.position);record.maxStanceDrift=Math.max(record.maxStanceDrift,contact.position.distanceTo(start));
    if(distance>record.maxSlide){record.maxSlide=distance;record.peak={frame:i,side:contact.side,phase:contact.phase,stance:contact.stance,ankleStep:ankle.distanceTo(previous.ankle),hipAnkle:hip.distanceTo(ankle),hip:hip.toArray(),ankle:ankle.toArray(),pad:contact.position.toArray()};}
   }
   old[contact.id]={planted:contact.planted,phase:contact.phase,position:contact.position.clone(),ankle,start};
  }
 }
 report.cases.push(record);character.dispose();
}
for(const [slopeX,slopeZ] of [[0,0],[.12,.10],[-.10,-.12]]){
 const character=await createCharacter(),mesh=character.group.getObjectByName('Shuoyu_skin'),position=new THREE.Vector3(),sampleGround=p=>p.x*slopeX+p.z*slopeZ;
 const vertices=Object.fromEntries(['L','R'].map(side=>{const index=mesh.skeleton.bones.indexOf(character.group.getObjectByName('Foot'+side)),found=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)if(mesh.geometry.attributes.skinIndex.getX(i)===index)found.push(i);return[side,found];}));
 let minimumClawClearance=Infinity,samples=0;
 for(let i=0;i<120;i++)character.update(1/60,i/60,{mode:'grounded',speed:1.7,sampleGround});
 for(let i=0;i<180;i++){
  const yaw=i/60*.6;character.group.rotation.y=yaw;character.group.position.x-=Math.sin(yaw)*1.7/60;character.group.position.z-=Math.cos(yaw)*1.7/60;character.group.position.y=sampleGround(character.group.position);
  character.update(1/60,i/60,{mode:'grounded',speed:1.7,sampleGround});
  character.group.updateMatrixWorld(true);
  for(const foot of character.getFootContacts())if(foot.planted)for(const index of vertices[foot.side]){mesh.getVertexPosition(index,position);mesh.localToWorld(position);minimumClawClearance=Math.min(minimumClawClearance,position.y-sampleGround(position));samples++;}
 }
 report.slopes.push({slopeX,slopeZ,minimumClawClearance,samples});character.dispose();
}
{
 const character=await createCharacter();character.update(1/60,0,{mode:'gliding',speed:3});
 const before=character.getWingTips().map(p=>p.clone()),shift=new THREE.Vector3(5,2,-3);character.group.position.add(shift);
 report.wingTipTranslationError=Math.max(...character.getWingTips().map((p,i)=>p.distanceTo(before[i].add(shift))));character.dispose();
}
await fs.writeFile('docs/v9/character/contact-cpu-diagnostic.json',JSON.stringify(report,null,2));
assert.ok(report.cases.every(c=>Number.isFinite(c.maxSlide)&&c.maxStanceDrift<.001),'A planted toe moved over 1mm during a supported turn');
assert.ok(report.slopes.every(c=>Number.isFinite(c.minimumClawClearance)&&c.minimumClawClearance>-.008),'A supported claw penetrated the sloped surface by over 8mm');
assert.ok(report.wingTipTranslationError<1e-7,'Wing tips double-applied the pre-render group translation');
console.log(JSON.stringify({passed:report.cases.length,maxSlide:Math.max(...report.cases.map(c=>c.maxSlide)),maxStanceDrift:Math.max(...report.cases.map(c=>c.maxStanceDrift)),slopes:report.slopes,wingTipTranslationError:report.wingTipTranslationError},null,2));


