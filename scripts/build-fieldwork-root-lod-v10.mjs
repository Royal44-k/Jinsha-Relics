import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Keep the original UV islands and material. The close-up uses the original
// scan. This spatially clustered mesh is for the continuous world only.
const project=fileURLToPath(new URL('../',import.meta.url));
const input=path.join(project,'public/assets/v5/tree_stump_01');
const output=path.join(project,'public/assets/v10');
const src=JSON.parse(fs.readFileSync(path.join(input,'tree_stump_01.gltf'),'utf8'));
const binary=fs.readFileSync(path.join(input,src.buffers[0].uri));
function accessor(index){
  const a=src.accessors[index],view=src.bufferViews[a.bufferView],dim={SCALAR:1,VEC2:2,VEC3:3}[a.type],byte=(view.byteOffset||0)+(a.byteOffset||0);
  const Typed=a.componentType===5126?Float32Array:Uint16Array;
  return new Typed(binary.buffer,binary.byteOffset+byte,a.count*dim);
}
const pos=accessor(0),uv=accessor(1),norm=accessor(2),indices=accessor(3),ids=new Uint16Array(pos.length/3),bins=new Map(),nodes=[];
for(let i=0;i<ids.length;i++){
  const [x,y,z]=pos.subarray(3*i,3*i+3),[u,v]=uv.subarray(i*2,i*2+2),nx=norm[i*3],ny=norm[i*3+1],nz=norm[i*3+2];
  const key=[Math.round(x/.047),Math.round(y/.043),Math.round(z/.047),Math.floor(u/.093),Math.floor(v/.093)].join(',');
  let id=bins.get(key);
  if(id===undefined){id=nodes.length;bins.set(key,id);nodes.push({sum:new Float64Array(8),n:0});}
  ids[i]=id;const node=nodes[id];node.n++;
  for(const [j,value] of [x,y,z,u,v,nx,ny,nz].entries())node.sum[j]+=value;
}
const positions=[],normals=[],uvs=[],faces=[],dedupe=new Set();
for(const {sum,n} of nodes){const unit=Math.hypot(sum[5],sum[6],sum[7])||1;positions.push(sum[0]/n,sum[1]/n,sum[2]/n);uvs.push(sum[3]/n,sum[4]/n);normals.push(sum[5]/unit,sum[6]/unit,sum[7]/unit);}
for(let i=0;i<indices.length;i+=3){
  const a=ids[indices[i]],b=ids[indices[i+1]],c=ids[indices[i+2]];
  if(a===b||a===c||b===c)continue;
  const id=[a,b,c].sort((x,y)=>x-y).join(',');
  if(dedupe.has(id))continue;dedupe.add(id);faces.push(a,b,c);
}
const arrays=[new Float32Array(positions),new Float32Array(uvs),new Float32Array(normals),new Uint16Array(faces)];
const outputMesh=structuredClone(src);const chunks=[];let offset=0;
arrays.forEach((array,i)=>{
  const raw=Buffer.from(array.buffer,array.byteOffset,array.byteLength);chunks.push(raw);
  outputMesh.bufferViews[i]={...src.bufferViews[i],byteOffset:offset,byteLength:raw.length};
  outputMesh.accessors[i].count=i===3?faces.length:nodes.length;offset+=raw.length;
});
outputMesh.accessors[3].max=[nodes.length-1];outputMesh.buffers=[{byteLength:offset,uri:'tree-root-lod.bin'}];
for(const img of outputMesh.images){img.uri='../v5/tree_stump_01/'+img.uri;img.mimeType='image/webp';}
outputMesh.asset.generator='Field survey world LOD; UV-aware vertex clustering';
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'tree-root-lod.bin'),Buffer.concat(chunks));
fs.writeFileSync(path.join(output,'tree-root-lod.gltf'),JSON.stringify(outputMesh));
console.log(nodes.length+' vertices, '+faces.length/3+' triangles, '+offset+' bytes');
