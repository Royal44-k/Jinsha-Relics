import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {simulationDelta,advanceParticle} from '../src/v8/frame-time.js';
import {createLocomotion} from '../src/v3/locomotion.js';
const world={sample:()=>({groundHeight:0,waterLevel:null,normal:new Vector3(0,1,0),zoneId:'flat'}),resolveMotion:(_a,b)=>({position:b.clone(),hit:false}),perches:[]};
test('real-time walking does not slow down when normal frames alternate with 85–120ms frames',()=>{
 const run=schedule=>{const p=new Vector3(),m=createLocomotion({world,position:p});let total=0,i=0;while(total<5-1e-8){const dt=Math.min(5-total,schedule[i++%schedule.length]);m.update(simulationDelta(dt),{moveZ:1,yaw:0});total+=dt;}return p.z;};
 assert.ok(Math.abs(run([1/60])-run([.016,.085,.016,.12,.035,.066]))<.03);
});
test('suspended or invalid frames cannot integrate unbounded catch-up',()=>{
 assert.equal(simulationDelta(12),.25);assert.equal(simulationDelta(-1),0);assert.equal(simulationDelta(NaN),0);
});
test('splash, drifting feathers, bubbles and leaves retain trajectories through long frames',()=>{
 for(const gravity of [-3.6,-.3,.2,-1.2]){
  const run=schedule=>{const p=new Vector3(.2,.8,-.3),v=new Vector3(.2,1.1,-.1);let t=0,i=0;while(t<.7-1e-9){const dt=Math.min(.7-t,schedule[i++%schedule.length]);advanceParticle(p,v,gravity,dt);t+=dt;}return p;};
  assert.ok(run([1/60]).distanceTo(run([.016,.12,.085,.25]))<1e-12);
 }
});
