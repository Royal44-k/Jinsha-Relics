import fs from 'node:fs';
import * as T from 'three';
import {createForest} from '../src/v2/world.js';
import {createTraversalWorld} from '../src/v3/traversal-world.js';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {createCameraClearance} from '../src/v7/camera-clearance.js';
import {chooseRebirthView} from '../src/v9/rebirth-view.js';
const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
T.TextureLoader.prototype.load=function(url,onLoad){const texture=new T.Texture({src:url});queueMicrotask(()=>onLoad?.(texture));return texture;};
const scene=new T.Scene(),forest=createForest(scene);await forest.ready;
const traversal=createTraversalWorld(scene,forest),adventure=createAdventureWorld({scene,forest,traversal}),clearance=createCameraClearance();scene.updateMatrixWorld(true);
const colliders=[...forest.cameraColliders,...traversal.cameraColliders,...adventure.cameraColliders];clearance.prepare(colliders);
const focus=new T.Vector3().fromArray(adventure.snapshot().rootLife.position),results=[];
for(const target of adventure.debug().targets.filter(t=>t.id.startsWith('root-socket-')||t.id==='root-memory')){
 const anchor=new T.Vector3().fromArray(target.position);anchor.y=traversal.sample(anchor).groundHeight;
 const start=performance.now(),view=chooseRebirthView({focus,anchor,colliders,raycast:clearance.first,sampleTerrain:p=>traversal.sample(p).terrainHeight});results.push({id:target.id,anchor:anchor.toArray(),milliseconds:performance.now()-start,view});
}
const report={timestamp:new Date().toISOString(),gpu:false,scope:'Production procedural forest/traversal/adventure meshes, prebuilt camera BVH; no chapter photogrammetry load or leaf occlusion verification',focus:focus.toArray(),results,query:clearance.stats()};fs.writeFileSync('docs/v9/world/rebirth-view-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));adventure.dispose();traversal.dispose();forest.dispose();
