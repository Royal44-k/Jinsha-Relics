import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const bytes=await fs.readFile('docs/v9/baseline/character/shuoyu.glb'),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;
function stripTextures(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')stripTextures(object[key]);}}json.materials.forEach(stripTextures);
const serialized=JSON.stringify(json);GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(serialized,'');};
const old=await import('../docs/v9/baseline/src/v2/character.js'),current=await import('../src/v2/character.js');
const report={at:new Date().toISOString(),method:'Real frozen V8 skeleton/geometry, textures omitted in CPU loader only. Same motion input, warmed loop. Counts include ancestor traversal, not GPU render work.',samples:[]},sampleGround=p=>p.x*.04+p.z*.02;
for(const spec of [{mode:'grounded',speed:2.2},{mode:'grounded',speed:3.9},{mode:'flying',speed:4},{mode:'perched',speed:0}]){
 const records=[];
 for(const[label,module]of[['baseline',old],['current',current]]){
  const character=await module.createCharacter(),step=(i)=>{const yaw=i/60*.3;character.group.rotation.y=yaw;character.group.position.x-=Math.sin(yaw)*spec.speed/60;character.group.position.z-=Math.cos(yaw)*spec.speed/60;character.group.position.y=spec.mode==='grounded'?sampleGround(character.group.position):2;character.update(1/60,i/60,{...spec,wingbeat:1,sampleGround});if(spec.mode==='grounded')character.getFootContacts();if(spec.mode==='flying')character.getWingTips();};
  const countsOnly=process.argv.includes('--counts-only');
  for(let i=0;i<(countsOnly?10:300);i++)step(i);
  const durations=[];for(let pass=0;pass<(countsOnly?1:7);pass++){const count=countsOnly?10:600,start=performance.now();for(let i=0;i<count;i++)step(i+300);durations.push((performance.now()-start)/count);}durations.sort((a,b)=>a-b);
  const nativeWorld=T.Object3D.prototype.updateWorldMatrix,nativeMatrix=T.Object3D.prototype.updateMatrixWorld;let worldCalls=0,matrixCalls=0;
  T.Object3D.prototype.updateWorldMatrix=function(...args){worldCalls++;return nativeWorld.apply(this,args);};T.Object3D.prototype.updateMatrixWorld=function(...args){matrixCalls++;return nativeMatrix.apply(this,args);};
  for(let i=0;i<60;i++)step(i);T.Object3D.prototype.updateWorldMatrix=nativeWorld;T.Object3D.prototype.updateMatrixWorld=nativeMatrix;
  character.group.updateMatrixWorld(true);const pose={};character.group.traverse(n=>{if(n.isBone)pose[n.name]=[...n.position,...n.quaternion,...n.scale];});records.push({label,mode:spec.mode,speed:spec.speed,medianUpdateMs:durations[Math.floor(durations.length/2)],minUpdateMs:durations[0],worldCallsPerFrame:worldCalls/60,matrixCallsPerFrame:matrixCalls/60,pose});character.dispose();
 }
 let poseDelta=0;for(const[name,p]of Object.entries(records[0].pose))p.forEach((v,i)=>poseDelta=Math.max(poseDelta,Math.abs(v-records[1].pose[name][i])));report.samples.push({spec,poseDelta,records:records.map(({pose,...r})=>r)});
}
await fs.mkdir('docs/v9/character',{recursive:true});await fs.writeFile('docs/v9/character/cpu-comparison.json',JSON.stringify(report,null,2));
assert.ok(report.samples.every(s=>Number.isFinite(s.poseDelta)));console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-reduction'))assert.ok(report.samples.filter(s=>s.spec.mode==='grounded').every(s=>s.records[1].worldCallsPerFrame<s.records[0].worldCallsPerFrame*.8),'Grounded pose still redundantly visits the full character tree');

