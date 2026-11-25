import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
function stripTextures(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')stripTextures(object[key]);}}
const report={at:new Date().toISOString(),method:'Actual exported GLB skeleton/colour geometry; CPU loader omits image textures. Checks sparse recolour, pose scale, reversibility, pause and unchanged soles. No GPU appearance claim.',lods:[]};
for(const lod of [0,1]){
  const file=`public/assets/shuoyu${lod?'.lod1':''}.glb`,bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
  json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;json.materials.forEach(stripTextures);
  GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(JSON.stringify(json),'');};
  const {createCharacter}=await import('../src/v2/character.js'),character=await createCharacter({lod}),steps=level=>{for(let i=0;i<180;i++)character.update(1/60,i/60,{mode:'grounded',speed:0,growth:{level}});character.group.updateMatrixWorld(true);};
  const colours=()=>{const all=[];character.group.traverse(n=>{if(n.geometry?.attributes.color)for(const value of n.geometry.attributes.color.array)all.push(value);});return Uint8Array.from(all);};
  const versions=()=>{const all=[];character.group.traverse(n=>{if(n.geometry?.attributes.color)all.push(n.geometry.attributes.color.version);});return all;};
  const changed=(a,b)=>{let count=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])count++;return count;};
  steps(0);const initial=colours(),baseSoles=character.getFootContacts().map(c=>c.position.clone()),states=[];
  for(const level of [1,2,0]){
    steps(level);const before=versions();
    character.update(1/60,0,{mode:'grounded',speed:0,growth:{level}});assert.deepEqual(versions(),before,'Same level must not upload colour buffers every frame');
    const pose=character.group.getObjectByName('Crest').scale.toArray();character.update(0,0,{mode:'grounded',speed:3,growth:{level}});assert.deepEqual(character.group.getObjectByName('Crest').scale.toArray(),pose,'dt=0 preserves pose');
    const soleDisplacement=Math.max(...character.getFootContacts().map((c,i)=>c.position.distanceTo(baseSoles[i]))),delta=changed(initial,colours());
    states.push({level,colourBytesChanged:delta,crestScale:pose,soleDisplacement,growth:character.getGrowth()});
    assert.ok(soleDisplacement<1e-5,'Growth must not alter the grounding target');assert.ok(level===0?delta===0:delta>300);
  }
  assert.ok(states[1].crestScale[1]>states[0].crestScale[1]);
  report.lods.push({lod,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,states});character.dispose();
}
await fs.mkdir('docs/v9/character',{recursive:true});await fs.writeFile('docs/v9/character/growth-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
