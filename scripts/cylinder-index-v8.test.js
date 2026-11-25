import test from 'node:test';
import assert from 'node:assert/strict';
import {createCylinderIndex} from '../src/v8/cylinder-index.js';

test('bucket edges and large cylinders produce a conservative, unique authored-order list',()=>{
 const cylinders=[{x:6,z:6,r:8},{x:-6,z:-6,r:.6},{x:0,z:0,r:.1},{x:6.2,z:0,r:.12}];const index=createCylinderIndex(cylinders),out=[];
 assert.deepEqual(index.query(0,0,.27,out),[0,2]);assert.equal(index.query(-6.85,-6,.27,out).includes(1),true);assert.deepEqual(index.query(6,0,.27,out),[0,3]);
});
test('deterministic random broadphase never misses a possible cylinder collision',()=>{
 let seed=7;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296),cylinders=Array.from({length:1200},()=>({x:rnd()*80-40,z:-rnd()*420,r:rnd()*3+.03})),index=createCylinderIndex(cylinders),out=[];
 for(let i=0;i<1500;i++){const x=rnd()*100-50,z=-rnd()*450,radius=rnd()*.8;index.query(x,z,radius,out);const actual=cylinders.flatMap((c,id)=>Math.hypot(c.x-x,c.z-z)<c.r+radius?[id]:[]);for(const id of actual)assert.ok(out.includes(id));assert.equal(new Set(out).size,out.length);assert.ok(out.length<60);}
});
