import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const bytes=await fs.readFile('public/assets/shuoyu.glb'),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;
function strip(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')strip(object[key]);}}json.materials.forEach(strip);
GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(JSON.stringify(json),'');};
const{createCharacter}=await import('../src/v2/character.js'),report={at:new Date().toISOString(),method:'Production foot skin, actual grip morph, settled perch pose. Reference cylinders radius .29m with level and arbitrary world slope, including equivalent reverse facing; this does not sample real bent branch geometry.',samples:[]};
for(const [mode,slopeX,slopeZ,opposite] of [['grounded',0,0,0],['perched',0,0,0],['perched',.22,0,0],['perched',0,.22,0],['perched',-.15,.19,0],['perched',-.15,.19,1]]){
 const c=await createCharacter(),gradient=Math.hypot(slopeX,slopeZ),axis=gradient>0?new T.Vector3(slopeX/gradient,gradient,slopeZ/gradient).normalize():new T.Vector3(1,0,0),offset=new T.Vector3();c.group.rotation.y=(gradient>0?Math.atan2(-slopeZ,slopeX):0)+opposite*Math.PI;for(let i=0;i<240;i++)c.update(1/60,i/60,{mode,speed:0,perchSlopeX:slopeX,perchSlopeZ:slopeZ});c.group.updateMatrixWorld(true);
 const mesh=c.group.getObjectByName('Shuoyu_skin'),position=mesh.geometry.attributes.position,point=new T.Vector3(),footIndices=['L','R'].map(s=>mesh.skeleton.bones.indexOf(c.group.getObjectByName('Foot'+s)));
 const vertices=[],forward=[],back=[];for(let i=0;i<position.count;i++){
  if(!footIndices.includes(mesh.geometry.attributes.skinIndex.getX(i)))continue;
  mesh.getVertexPosition(i,point);mesh.localToWorld(point);
  offset.copy(point).add(new T.Vector3(0,.29,0));const clearance=offset.addScaledVector(axis,-offset.dot(axis)).length()-.29;
  vertices.push(clearance);
  if(position.getY(i)<.022&&position.getZ(i)<-.11)forward.push(clearance);
  if(position.getY(i)<.022&&position.getZ(i)>.06)back.push(clearance);
 }
 const stats=values=>{values.sort((a,b)=>a-b);return{min:values[0],p50:values[Math.floor(values.length*.5)],p90:values[Math.floor(values.length*.9)],max:values.at(-1),count:values.length};};
 report.samples.push({mode,slopeX,slopeZ,opposite,all:stats(vertices),forwardPads:stats(forward),rearPads:stats(back),morphs:mesh.morphTargetInfluences});c.dispose();
}
await fs.writeFile('docs/v8/character/perch-grip-cpu.json',JSON.stringify(report,null,2));assert.ok(report.samples.filter(s=>s.mode==='perched').every(s=>s.all.min>-.004&&s.forwardPads.min<.015&&s.rearPads.min<.015),'Opposing pads must follow the sloped branch without penetrating its cylinder');console.log(JSON.stringify(report,null,2));
