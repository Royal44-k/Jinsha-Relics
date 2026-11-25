import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const data=[];
for(const file of ['public/assets/shuoyu.glb','public/assets/shuoyu.lod1.glb']){
 const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
 json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;
 function strip(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')strip(object[key]);}}json.materials.forEach(strip);data.push(JSON.stringify(json));
}
GLTFLoader.prototype.loadAsync=function(url){return this.parseAsync(data[url.includes('.lod1.')?1:0],'');};
const {createCharacter}=await import('../src/v2/character.js');
const report={at:new Date().toISOString(),sourceHash:crypto.createHash('sha256').update(await fs.readFile('src/v2/character.js')).digest('hex'),method:'Actual high/low GLB and production character runtime, textures omitted for CPU load. Enter dive, pause, resurface, leave shore wet, fully dry. Check continuity, reversible material state and absence of shader invalidations.',cases:[]};
for(const lod of [0,1])for(const fps of [30,60,120]){
 const c=await createCharacter({lod}),materials=new Set();c.group.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 const feathers=[...materials].filter(m=>m.isMeshPhysicalMaterial&&/feather|down/i.test(m.name)),eyes=[...materials].filter(m=>m.isMeshPhysicalMaterial&&!/feather|down/i.test(m.name));
 const original=new Map([...materials].map(m=>[m,{color:m.color.toArray(),roughness:m.roughness,ior:m.ior,version:m.version}]));let time=0,maxIorFrameDelta=0;
 const step=(seconds,state)=>{for(let i=0;i<Math.round(fps*seconds);i++){const previous=feathers.map(m=>m.ior);time+=1/fps;c.update(1/fps,time,state);for(let n=0;n<feathers.length;n++)maxIorFrameDelta=Math.max(maxIorFrameDelta,Math.abs(feathers[n].ior-previous[n]));}};
 step(4,{mode:'grounded',wetness:0,speed:0});step(4,{mode:'diving',wetness:1,speed:2.4});
 const underwater=feathers.map(m=>({name:m.name,ior:m.ior,roughness:m.roughness}));assert.ok(underwater.every(m=>m.ior>1&&m.ior<1.14));
 const paused=[...materials].map(m=>[m.ior,m.roughness,...m.color.toArray()]);for(let i=0;i<120;i++)c.update(0,time+10,{mode:'grounded',wetness:0});assert.deepEqual([...materials].map(m=>[m.ior,m.roughness,...m.color.toArray()]),paused);
 step(4,{mode:'swimming',wetness:1,speed:0});const surfaced=feathers.map(m=>({name:m.name,ior:m.ior,roughness:m.roughness}));assert.ok(surfaced.every(m=>Math.abs(m.ior-1.5)<1e-7));
 step(2,{mode:'grounded',wetness:1,speed:0});const wetShore=feathers.map(m=>({name:m.name,ior:m.ior,roughness:m.roughness}));assert.ok(wetShore.every(m=>Math.abs(m.ior-1.5)<1e-10));
 step(30,{mode:'grounded',wetness:0,speed:0});const dryErrors=[...materials].map(m=>({name:m.name,roughness:Math.abs(m.roughness-original.get(m).roughness),ior:typeof m.ior==='number'?Math.abs(m.ior-original.get(m).ior):0,color:Math.max(...m.color.toArray().map((v,i)=>Math.abs(v-original.get(m).color[i]))),shaderVersions:m.version-original.get(m).version}));
 assert.ok(dryErrors.every(m=>m.roughness<1e-7&&m.ior<1e-10&&m.color<1e-7&&m.shaderVersions===0),JSON.stringify(dryErrors));assert.ok(eyes.every(m=>m.ior===original.get(m).ior));assert.ok(maxIorFrameDelta<.18,'water transition must not cross half the full IOR range in one frame');
 report.cases.push({lod,fps,underwater,surfaced,wetShore,maxIorFrameDelta,dryErrors});c.dispose();
}
await fs.writeFile('docs/v9/character/water-light/material-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases.length,maxIorFrameDelta:Math.max(...report.cases.map(c=>c.maxIorFrameDelta)),maximumShaderVersionChange:Math.max(...report.cases.flatMap(c=>c.dryErrors.map(m=>m.shaderVersions))),maximumDryRoughnessError:Math.max(...report.cases.flatMap(c=>c.dryErrors.map(m=>m.roughness)))},null,2));
