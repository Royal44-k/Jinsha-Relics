import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const jsons=[];
for(const path of ['public/assets/shuoyu.glb','public/assets/shuoyu.lod1.glb']){
 const bytes=await fs.readFile(path),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
 json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;
 function strip(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')strip(object[key]);}}json.materials.forEach(strip);jsons.push(JSON.stringify(json));
}
GLTFLoader.prototype.loadAsync=function(url){return this.parseAsync(jsons[url.includes('.lod1.')?1:0],'');};
const versions=[['before',(await import('../docs/v9/character/diving/character-before.js')).createCharacter],['revised',(await import('../src/v2/character.js')).createCharacter]],actionSource=await fs.readFile('scripts/verify-character-actions-v9.mjs','utf8'),measureSource=actionSource.slice(actionSource.indexOf('function measure('),actionSource.indexOf('\nconst report=')),measure=new Function('T',measureSource+';return measure;')(T),report={at:new Date().toISOString(),method:'Real GLB and real pose runtime. Head-to-pelvis centreline elevation; actual skinned toe torso intersection; same elapsed samples. Textures excluded only from CPU load.',cases:[]};
for(const[version,create]of versions)for(const lod of [0,1])for(const speed of [0,2.4,5.4])for(const pitch of [-.28,0,.28]){
 const c=await create({lod}),state={mode:'diving',speed,pitch,wetness:1};for(let i=0;i<180;i++)c.update(1/60,i/60,state);
 const elevations=[],footLows=[],bodyIntersections=[],tipExtents=new T.Box3(),hips=new T.Vector3(),head=new T.Vector3(),foot=new T.Vector3();let finite=true;
 for(let frame=0;frame<24;frame++){
  c.update(1/30,frame/30,state);c.group.updateMatrixWorld(true);c.group.getObjectByName('Pelvis').getWorldPosition(hips);c.group.getObjectByName('Head').getWorldPosition(head);head.sub(hips);elevations.push(Math.asin(head.y/head.length())*180/Math.PI);
  for(const side of ['L','R']){c.group.getObjectByName('Foot'+side).getWorldPosition(foot);footLows.push(foot.y-hips.y);}
  const measurement=measure(c,false);finite&&=measurement.finite;bodyIntersections.push(measurement.bodyInside);for(const tip of c.getWingTips())tipExtents.expandByPoint(tip);
 }
 report.cases.push({version,lod,speed,pitch,centrelineElevation:{min:Math.min(...elevations),max:Math.max(...elevations)},ankleRelativeToPelvis:{min:Math.min(...footLows),max:Math.max(...footLows)},maxTorsoIntersections:Math.max(...bodyIntersections),tuck:c.group.userData.motion.flightTuck,finite,wingTipMotionExtent:tipExtents.getSize(new T.Vector3()).toArray()});c.dispose();
}
await fs.writeFile('docs/v9/character/diving/pose-cpu-comparison.json',JSON.stringify(report,null,2));assert.ok(report.cases.every(r=>r.finite&&r.maxTorsoIntersections===0));
console.log(JSON.stringify({cases:report.cases.length,maxTorsoIntersections:Math.max(...report.cases.map(c=>c.maxTorsoIntersections)),levelPitchSamples:report.cases.filter(c=>c.lod===0&&c.speed===2.4&&c.pitch===0)},null,2));
