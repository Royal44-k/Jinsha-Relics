import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {createTraversalWorld} from '../src/v3/traversal-world.js';
import {createTraversalWorld as createBaseline} from '../docs/v8/baseline/src/v3/traversal-world.js';
import {createLocomotion} from '../src/v3/locomotion.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DOMESTIC_HOUSE_SITE} from '../src/v2/world.js';
import {PERCH_SITES} from '../src/v8/perch-sites.js';
import {createBranchGeometry as branch} from '../src/v8/branch-geometry.js';
import {createPerchLeafGeometry} from '../src/v8/perch-leaf.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);let seed=441;
const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const obstacles=Array.from({length:1400},(_,i)=>({x:rnd()*60-30,z:-rnd()*400,r:.15+rnd()*1.8,minY:rnd()*.5,height:1+rnd()*11,reason:'fixture-solid-'+i}));
// Deliberately overlap different buckets to exercise authored-order push chains.
for(let i=0;i<12;i++)obstacles.push({x:5.9+i*.65,z:-90,r:1.1,height:8,reason:'chain-'+i});
const fixture=colliders=>{const group=new THREE.Group(),path=new THREE.LineCurve3(V(),V(0,0,-400));return {group,path,length:400,sample:d=>V(0,0,-d),sampleGround:()=>0,sampleMain:p=>({distance:Math.max(0,Math.min(400,-p.z)),point:V(0,0,Math.max(-400,Math.min(0,p.z)))}),colliders,cameraColliders:[]};};
const source=fs.readFileSync('src/v3/traversal-world.js','utf8').replace(/^import .*?;\r?\n/gm,'').replace('export function createTraversalWorld','function createTraversalWorld');
const fullScanIndex=cylinders=>({query(x,z,radius,out){out.length=0;for(let id=0;id<cylinders.length;id++)out.push(id);return out;}});
const sameSceneFullScan=new Function('THREE','mergeGeometries','DOMESTIC_HOUSE_SITE','createCylinderIndex','PERCH_SITES','branch','createPerchLeafGeometry',source+'\nreturn createTraversalWorld;')(THREE,mergeGeometries,DOMESTIC_HOUSE_SITE,fullScanIndex,PERCH_SITES,branch,createPerchLeafGeometry);
const before=sameSceneFullScan(new THREE.Scene(),fixture(obstacles)),after=createTraversalWorld(new THREE.Scene(),fixture(obstacles));
const samples=Array.from({length:2200},(_,i)=>{const p=V(rnd()*64-32,rnd()*15-1,-rnd()*405);return {from:p,to:p.clone().add(V((rnd()-.5)*(i%7?1:12),(rnd()-.5)*1.6,(rnd()-.5)*(i%7?1:12))),radius:.15+rnd()*.5};});
const record={at:new Date().toISOString(),method:'CPU-only exact comparison of the same V8 scene with full authored-order cylinder scan versus spatial buckets: 1412 deterministic cylinders plus real authored house, bridge, posts and five perches. Short steps and long cross-bucket sweeps. Synthetic flat terrain, not browser FPS. Earlier direct V7 equivalence is preserved in spatial-before-new-sites.json.',queries:samples.length,collisionMismatches:0,perches:[],timing:{}};
try{
 for(const q of samples){const a=before.resolveMotion(q.from,q.to,q.radius),b=after.resolveMotion(q.from,q.to,q.radius);assert.ok(a.position.distanceTo(b.position)<1e-10,JSON.stringify({q,a,b}));assert.equal(a.hit,b.hit);assert.equal(a.reason,b.reason);assert.ok(!a.normal&&!b.normal||a.normal?.distanceTo(b.normal)<1e-10);}
 const measure=world=>{const start=performance.now();for(const q of samples)world.resolveMotion(q.from,q.to,q.radius);return performance.now()-start;};
 // Alternate runs so neither version always runs in the cold process.
 record.timing.beforeMs=[];record.timing.afterMs=[];for(let i=0;i<3;i++){record.timing.beforeMs.push(measure(before));record.timing.afterMs.push(measure(after));}
 record.timing.note='This same-scene full-scan test shim rebuilds the candidate list on each query; its timing is not an unbiased V7 speed benchmark. Direct unmodified V7 versus V8 timing before adding sites is in spatial-before-new-sites.json. This run primarily proves exact collision equivalence.';
 const real=createTraversalWorld(new THREE.Scene(),fixture([])),legacy=createBaseline(new THREE.Scene(),fixture([]));
 for(let i=0;i<2;i++)assert.ok(real.perches[i].position.distanceTo(legacy.perches[i].position)<1e-12);legacy.dispose();
 try{for(const perch of real.perches)for(const dy of [-.9,0,.9])for(let i=0;i<16;i++){
   const a=i*Math.PI/8,position=perch.position.clone().add(V(Math.cos(a)*2.2,dy,Math.sin(a)*2.2)),events=[],c=createLocomotion({world:real,position,onEvent:e=>events.push(e)});
   const accepted=c.requestPerch();for(let f=0;f<150;f++)c.update(1/90,{});record.perches.push({id:perch.id,dy,angle:i,accepted,mode:c.state.mode,error:position.distanceTo(perch.position)});assert.ok(accepted);assert.equal(c.state.mode,'perched');assert.ok(position.distanceTo(perch.position)<.001);
  }}finally{real.dispose();}
 console.log(JSON.stringify(record,null,2));
}finally{before.dispose();after.dispose();fs.mkdirSync('docs/v8/locomotion',{recursive:true});if(fs.existsSync('docs/v8/locomotion/spatial-verification.json')&&!fs.existsSync('docs/v8/locomotion/spatial-before-new-sites.json'))fs.copyFileSync('docs/v8/locomotion/spatial-verification.json','docs/v8/locomotion/spatial-before-new-sites.json');fs.writeFileSync('docs/v8/locomotion/spatial-verification.json',JSON.stringify(record,null,2));}
