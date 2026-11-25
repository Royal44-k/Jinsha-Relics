import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files=['src/v2/character.js','scripts/build-shuoyu.source.js','public/assets/shuoyu.glb','public/assets/shuoyu.lod1.glb','docs/v8/baseline/dist/assets/shuoyu.glb','docs/v8/baseline/dist/assets/shuoyu.lod1.glb'],records=[];
for(const path of files){const bytes=await fs.readFile(path),record={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};if(path.endsWith('.glb')){const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());record.triangles=json.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);record.materials=json.materials.length;record.bones=json.skins[0].joints.length;record.animations=json.animations.length;}records.push(record);}
const report={at:new Date().toISOString(),records};await fs.writeFile('docs/v8/character/manifest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
