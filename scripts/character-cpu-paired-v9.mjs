import fs from 'node:fs/promises';
import crypto from 'node:crypto';
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
const report={at:new Date().toISOString(),currentSourceHash:crypto.createHash('sha256').update(await fs.readFile('src/v2/character.js')).digest('hex'),method:'Paired alternating AB/BA order, 1500-frame warm-up, 12 passes of 800 updates. Both runtime revisions use exactly the frozen V8 geometry to isolate runtime overhead. CPU-only, not a game FPS measurement.',samples:[]};
const sampleGround=p=>p.x*.04+p.z*.02;
for(const spec of[{mode:'grounded',speed:2.2},{mode:'grounded',speed:3.9},{mode:'flying',speed:4},{mode:'perched',speed:0},{mode:'diving',speed:2.4,wetness:1}]){
 const records=[];for(const[label,module]of[['baseline',old],['current',current]]){const c=await module.createCharacter();records.push({label,c,times:[],step(i){const yaw=i/60*.3;c.group.rotation.y=yaw;c.group.position.x-=Math.sin(yaw)*spec.speed/60;c.group.position.z-=Math.cos(yaw)*spec.speed/60;c.group.position.y=spec.mode==='grounded'?sampleGround(c.group.position):2;c.update(1/60,i/60,{...spec,wingbeat:1,sampleGround});if(spec.mode==='grounded')c.getFootContacts();if(spec.mode==='flying')c.getWingTips();}});}
 for(let i=0;i<1500;i++)for(const record of records)record.step(i);
 for(let pass=0;pass<12;pass++)for(const record of(pass%2?[...records].reverse():records)){const start=performance.now();for(let i=0;i<800;i++)record.step(i+1500);record.times.push((performance.now()-start)/800);}
 report.samples.push({spec,records:records.map(r=>{const sorted=[...r.times].sort((a,b)=>a-b);return{label:r.label,medianUpdateMs:(sorted[5]+sorted[6])/2,minUpdateMs:sorted[0],maxUpdateMs:sorted.at(-1),passes:r.times};})});for(const r of records)r.c.dispose();
}
await fs.writeFile(process.env.CHARACTER_CPU_REPORT||'docs/v9/character/cpu-paired.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.samples.map(s=>({spec:s.spec,records:s.records.map(({passes,...r})=>r)})),null,2));
