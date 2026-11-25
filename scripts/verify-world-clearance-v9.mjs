// Spatial audit against production terrain, vegetation and collision builders.
// The canvas/image stubs remove I/O only. No WebGL or rendered-image claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createForest} from '../src/v2/world.js';
import {createTraversalWorld} from '../src/v3/traversal-world.js';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {createLivingTree} from '../src/v9/living-tree.js';
import {ENCOUNTERS} from '../src/v9/expedition-state.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
T.TextureLoader.prototype.load=function(url,onLoad){const texture=new T.Texture({src:url});queueMicrotask(()=>onLoad?.(texture));return texture;};
const scene=new T.Scene(),forest=createForest(scene);await forest.ready;
const traversal=createTraversalWorld(scene,forest),adventure=createAdventureWorld({scene,forest,traversal});scene.updateMatrixWorld(true);
const resolve=(from,to)=>{const candidate=traversal.resolveMotion(from,to,.27).position;return adventure.resolveMotion(from,candidate,.27)?.position||candidate;};
const targetResults=adventure.debug().targets.filter(t=>t.id.startsWith('root-')||t.id.startsWith('encounter-')).map(t=>{
 const destination=V(...t.position);destination.y=traversal.sample(destination).groundHeight;
 const overlap=resolve(destination,destination).distanceTo(destination),approaches=[];
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,start=destination.clone().add(V(Math.sin(a)*1.8,0,Math.cos(a)*1.8));start.y=traversal.sample(start).groundHeight;let current=start.clone();for(let k=1;k<=24;k++){const next=start.clone().lerp(destination,k/24);next.y=traversal.sample(next).groundHeight;current=resolve(current,next);}approaches.push({angle:a,miss:Math.hypot(current.x-destination.x,current.z-destination.z)});}
 return {id:t.id,position:destination.toArray(),overlap,bestApproach:Math.min(...approaches.map(a=>a.miss)),clearApproaches:approaches.filter(a=>a.miss<.12).length};
});
const at=(f,s)=>{const t=forest.path.getTangentAt(f);return forest.sample(f*forest.length).addScaledVector(V(-t.z,0,t.x),s);};
const sites=[{id:'root',fraction:.182,lateral:-2.4,radius:4},...ENCOUNTERS.map(e=>({...e,radius:5.1}))].map(e=>{const p=at(e.fraction,e.lateral),ground=traversal.sample(p).groundHeight,near=forest.colliders.filter(c=>c.treeTrunk&&c.height>ground&&c.minY<ground+1.5).map(c=>({clearance:Math.hypot(c.x-p.x,c.z-p.z)-c.r,...c})).sort((a,b)=>a.clearance-b.clearance);return {id:e.id,position:p.toArray(),radius:e.radius,nearestSolidTrunk:near[0]?.clearance,intrusions:near.filter(c=>c.clearance<e.radius-.8)};});
const pathPassages=ENCOUNTERS.map(e=>{let current=at(e.fraction-.014,0),miss=0;current.y=traversal.sample(current).groundHeight;for(let i=1;i<=90;i++){const target=at(e.fraction-.014+i/90*.028,0);target.y=traversal.sample(target).groundHeight;current=resolve(current,target);miss=Math.max(miss,Math.hypot(current.x-target.x,current.z-target.z));}return {id:e.id,maximumDisplacement:miss};});
const bark=new T.MeshStandardMaterial(),tree=createLivingTree({parent:new T.Group(),bark,completed:true,lights:3});let draws=0,triangles=0;tree.group.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
const result={timestamp:new Date().toISOString(),gpu:false,scope:'Production procedural geometry and collisions; texture/canvas I/O stubbed',targets:targetResults,sites,pathPassages,tree:{...tree.debug(),draws,triangles,perch:tree.getPerch().position.toArray()}};
fs.mkdirSync('docs/v9/world',{recursive:true});fs.writeFileSync('docs/v9/world/clearance-cpu.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
tree.dispose();bark.dispose();adventure.dispose();traversal.dispose();forest.dispose();
assert.ok(targetResults.every(t=>t.bestApproach<.12), 'Every new root/encounter action must have an unblocked approach');
assert.ok(sites.every(s=>s.intrusions.length===0),'Reserved play space must not retain random trunk solids');
assert.ok(pathPassages.every(p=>p.maximumDisplacement<.35),'New encounter landmarks must not obstruct the primary walking path');
assert.ok(triangles<180000,'Expanded crown must stay below its geometry budget');

