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
const report={at:new Date().toISOString(),method:'Production runtime and actual exported GLB skeleton; textures omitted on CPU. Paired control characters verify Flinch is an additive 0.42-second skeletal response, with no outer movement or mode change.',samples:[]};
for(const lod of[0,1])for(const mode of['grounded','flying','swimming','diving','perched']){
 const a=await createCharacter({lod}),b=await createCharacter({lod}),state={mode,speed:mode==='grounded'||mode==='perched'?0:3.5,wingbeat:mode==='flying'?1:0,growth:{level:2}};
 for(let i=0;i<120;i++){a.update(1/60,i/60,state);b.update(1/60,i/60,state);}a.trigger('Flinch');let peak=0,displacement=0,finite=true;
 for(let i=0;i<60;i++){a.update(1/60,i/60,state);b.update(1/60,i/60,state);a.group.updateMatrixWorld(true);peak=Math.max(peak,a.group.getObjectByName('Neck').position.distanceTo(b.group.getObjectByName('Neck').position));displacement=Math.max(displacement,a.group.position.distanceTo(b.group.position));a.group.traverse(n=>{if(n.isBone)finite&&=n.matrixWorld.elements.every(Number.isFinite);});assert.equal(a.group.userData.motion.mode,mode);}
 const residual=a.group.getObjectByName('Neck').position.distanceTo(b.group.getObjectByName('Neck').position);report.samples.push({lod,mode,peakNeckDisplacement:peak,outerDisplacement:displacement,residual,finite});assert.ok(peak>.01&&peak<.035&&displacement===0&&residual===0&&finite);a.dispose();b.dispose();
}
await fs.writeFile('docs/v9/character/flinch-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
