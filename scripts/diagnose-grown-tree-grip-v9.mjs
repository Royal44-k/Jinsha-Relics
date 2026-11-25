import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLivingTree} from '../src/v9/living-tree.js';
globalThis.ProgressEvent??=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const bytes=await fs.readFile('public/assets/shuoyu.glb'),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');delete json.images;delete json.textures;delete json.samplers;
function strip(object){for(const key of Object.keys(object)){if(/texture/i.test(key))delete object[key];else if(object[key]&&typeof object[key]==='object')strip(object[key]);}}json.materials.forEach(strip);
GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(JSON.stringify(json),'');};
const{createCharacter}=await import('../src/v2/character.js'),parent=new T.Group(),bark=new T.MeshStandardMaterial(),tree=createLivingTree({parent,bark,completed:true,lights:3}),perch=tree.getPerch(),branch=tree.group.children.find(g=>g.isGroup&&g.children.some(m=>m.name==='骨干枝与三级细枝')).children.find(m=>m.name==='骨干枝与三级细枝');
parent.updateMatrixWorld(true);const bvh=new MeshBVH(branch.geometry,{indirect:true}),point=new T.Vector3(),local=new T.Vector3(),closest={point:new T.Vector3()},normal=new T.Vector3(),tri=new T.Triangle(),attr=branch.geometry.attributes.position,index=branch.geometry.index;
const report={at:new Date().toISOString(),scope:'Actual exported skinned toe pads and actual mature-tree first branch triangle surfaces, including its side twigs; no rendered appearance claim.',treeSourceSHA256:crypto.createHash('sha256').update(await fs.readFile('src/v9/living-tree.js')).digest('hex'),perch:{position:perch.position.toArray(),yaw:perch.yaw,slope:perch.slope},poses:[]};
let windClock=0;
for(const windTime of [0,4.9,9.8])for(const opposite of [false,true]){
 while(windClock<windTime-1e-9){const dt=Math.min(.25,windTime-windClock);tree.update(dt,{lights:3,playing:true});windClock+=dt;}parent.updateMatrixWorld(true);
 const c=await createCharacter();c.group.position.copy(perch.position);c.group.rotation.y=perch.yaw+(opposite?Math.PI:0);
 for(let i=0;i<240;i++)c.update(1/60,i/60,{mode:'perched',speed:0,perchSlopeX:perch.slope.x,perchSlopeZ:perch.slope.z});c.group.updateMatrixWorld(true);
 const skin=c.group.getObjectByName('Shuoyu_skin'),p=skin.geometry.attributes.position,ids=['L','R'].map(s=>skin.skeleton.bones.indexOf(c.group.getObjectByName('Foot'+s))),groups={forward:[],rear:[],all:[]};
 for(let i=0;i<p.count;i++){
  if(!ids.includes(skin.geometry.attributes.skinIndex.getX(i)))continue;
  skin.getVertexPosition(i,point);skin.localToWorld(point);branch.worldToLocal(local.copy(point));bvh.closestPointToPoint(local,closest);
  const face=closest.faceIndex*3;tri.setFromAttributeAndIndices(attr,index.getX(face),index.getX(face+1),index.getX(face+2));tri.getNormal(normal);
  const signed=Math.sign(point.copy(local).sub(closest.point).dot(normal))*closest.distance;groups.all.push(signed);
  if(p.getY(i)<.022&&p.getZ(i)<-.11)groups.forward.push(signed);if(p.getY(i)<.022&&p.getZ(i)>.06)groups.rear.push(signed);
 }
 const stats=values=>{values.sort((a,b)=>a-b);return{min:values[0],p10:values[Math.floor(values.length*.1)],median:values[Math.floor(values.length*.5)],max:values.at(-1),count:values.length};};
 report.poses.push({windTime,opposite,...Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,stats(v)]))});c.dispose();
}
tree.dispose();bark.dispose();await fs.mkdir('docs/v9/character/review',{recursive:true});await fs.writeFile('docs/v9/character/review/grown-tree-grip-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
