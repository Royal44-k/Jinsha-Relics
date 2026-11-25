import fs from'node:fs/promises';
import crypto from'node:crypto';
import assert from'node:assert/strict';
const report={at:new Date().toISOString(),method:'Direct exported GLB accessor audit, no renderer or reconstructed source. Each contour triangle cross-product is compared with the sum of its three authored normals. Dot tolerance 1e-12.',assets:[]};
for(const base of['docs/v9/baseline/character','public/assets'])for(const lod of['',' .lod1'.trim()]){
 const file=`${base}/shuoyu${lod}.glb`,bytes=await fs.readFile(file),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
 const reader=id=>{const a=json.accessors[id],b=json.bufferViews[a.bufferView],sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},n=sizes[a.type],s={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType],offset=(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||n*s;return (i,k=0)=>{const at=offset+i*stride+k*s;return a.componentType===5126?binary.readFloatLE(at):a.componentType===5125?binary.readUInt32LE(at):a.componentType===5123?binary.readUInt16LE(at):binary.readUInt8(at);};};
 const primitive=json.meshes.flatMap(m=>m.primitives).find(p=>json.materials[p.material].name==='Soft_contour_feathers'),p=reader(primitive.attributes.POSITION),n=reader(primitive.attributes.NORMAL),si=reader(primitive.attributes.JOINTS_0),ix=reader(primitive.indices),counts={positive:0,negative:0,degenerate:0},bones={};
 for(let i=0;i<json.accessors[primitive.indices].count;i+=3){const a=ix(i),b=ix(i+1),c=ix(i+2),u=[0,1,2].map(k=>p(b,k)-p(a,k)),v=[0,1,2].map(k=>p(c,k)-p(a,k)),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],dot=cross.reduce((sum,value,k)=>sum+value*(n(a,k)+n(b,k)+n(c,k)),0),label=Math.abs(dot)<1e-12?'degenerate':dot<0?'negative':'positive',bone=json.nodes[json.skins[0].joints[si(a)]].name;counts[label]++;bones[bone]??={positive:0,negative:0,degenerate:0};bones[bone][label]++;}
 report.assets.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...counts,bones});
}
await fs.writeFile('docs/v9/character/exported-feather-facing.json',JSON.stringify(report,null,2));assert.ok(report.assets.filter(a=>a.file.startsWith('public/')).every(a=>a.negative===0));console.log(JSON.stringify(report.assets.map(({bones,...r})=>r),null,2));
