import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {createLivingWorld} from '../src/v6/living-world.js';
import {createLivingState} from '../src/v6/living-state.js';
import {createPotteryWorld} from '../src/v7/pottery-world.js';
import {createPotteryState} from '../src/v7/pottery-state.js';
import {simulationDelta} from '../src/v8/frame-time.js';

const schedules=[[1/60],[.016,.085,.016,.12,.035,.066],[.2]];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function run(seconds,schedule,update){let elapsed=0,i=0;while(elapsed<seconds-1e-10){const raw=Math.min(seconds-elapsed,schedule[i++%schedule.length]);elapsed+=raw;update(simulationDelta(raw),elapsed);}}
function fixture(){return {scene:new THREE.Scene(),forest:{group:new THREE.Group(),length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d),sampleGround:()=>0},traversal:{group:new THREE.Group(),perches:[{id:'branch-0',position:new THREE.Vector3(-2,4.9,-42)}],pool:new THREE.Vector3(12,-.2,-86),sample:()=>({groundHeight:-2.5,waterLevel:-.2})}};}

test('six real seconds of trial time agree at 60Hz, mixed long frames and 200ms frames',()=>{
 for(const schedule of schedules){const w=createAdventureWorld(fixture()),position=new THREE.Vector3().fromArray(w.debug().targets.find(t=>t.id==='flight-start').position),input={position,playing:true,motion:{mode:'grounded'},yaw:0};
  w.update(0,0,input);assert.equal(w.interact(),true);run(6,schedule,(dt,t)=>w.update(dt,t,input));near(w.snapshot().challenge.time,6);
  w.update(12,100,{...input,playing:false});near(w.snapshot().challenge.time,6);w.update(12,100,input);near(w.snapshot().challenge.time,6.25);w.dispose();
 }
});

test('actual finale alignment uses the same elapsed time and pause cannot finish it',()=>{
 for(const schedule of schedules){const w=createAdventureWorld(fixture());w.restore(null,['bird','jade','mask','tiger']);const p=w.debug(),position=new THREE.Vector3().fromArray(p.targets.find(t=>t.id==='sun-focus').position),yaw=Math.atan2(-(p.finalTarget[0]-position.x),-(p.finalTarget[2]-position.z)),input={position,yaw,playing:true,lightHeld:true,motion:{mode:'grounded'}};
  run(.9,schedule,(dt,t)=>w.update(dt,t,input));near(w.snapshot().focus,.5);w.update(12,90,{...input,playing:false});near(w.snapshot().focus,.5);run(6,schedule,(dt,t)=>w.update(dt,t+90,input));assert.equal(w.snapshot().completed,true);w.dispose();
 }
});

test('living scene and state retain observation progress through ordinary long frames',()=>{
 for(const schedule of schedules){const w=createLivingWorld(fixture()),position=new THREE.Vector3().fromArray(w.debug().moments.find(m=>m.id==='river-mirror').position),input={position,playing:true,listening:true,motion:{mode:'diving',speed:0}},state=createLivingState(),stateInput={id:'river-mirror',distance:0,playing:true,listening:true,mode:'diving',speed:0};
  run(2,schedule,(dt,t)=>{w.update(dt,t,input);state.update(dt,stateInput);});near(w.snapshot().nearest.progress,2/3);near(state.snapshot('river-mirror').progress,2/3);
  w.update(12,100,{...input,playing:false});state.update(12,{...stateInput,playing:false});near(w.snapshot().nearest.progress,2/3);near(state.snapshot('river-mirror').progress,2/3);
  run(4,schedule,(dt,t)=>{w.update(dt,t+2,input);state.update(dt,stateInput);});assert.equal(w.snapshot().nearest.done,true);assert.equal(state.snapshot('river-mirror').done,true);w.dispose();
 }
});

test('six seconds of actual pottery firing preserve 80 percent heat at every cadence',()=>{
 for(const schedule of schedules){const w=createPotteryWorld(fixture()),state=createPotteryState(),input={position:w.centre,playing:true,active:true};w.setActive(true);assert.equal(w.fire(),true);state.fire();
  run(6,schedule,dt=>{w.update(dt,input);state.update(dt,true);});near(w.snapshot().heat,.8);near(state.snapshot().heat,.8);
  w.update(12,{...input,playing:false});state.update(12,false);near(w.snapshot().heat,.8);near(state.snapshot().heat,.8);
  run(1.5,schedule,dt=>{w.update(dt,input);state.update(dt,true);});assert.equal(w.snapshot().fired,true);assert.equal(state.snapshot().fired,true);assert.equal(w.serialize().totalMade,1);w.dispose();
 }
});

test('raw suspended intervals are bounded in living and pottery public entry points',()=>{
 const w=createLivingWorld(fixture()),position=new THREE.Vector3().fromArray(w.debug().moments.find(m=>m.id==='river-mirror').position);w.update(12,12,{position,playing:true,listening:true,motion:{mode:'diving',speed:0}});near(w.snapshot().nearest.progress,.25/3);w.dispose();
 const state=createLivingState();state.update(12,{id:'river-mirror',distance:0,playing:true,listening:true,mode:'diving'});near(state.snapshot('river-mirror').progress,.25/3);
 const p=createPotteryWorld(fixture());p.setActive(true);p.fire();p.update(12,{playing:true,active:true});near(p.snapshot().heat,.25/7.5);p.dispose();
 const ps=createPotteryState();ps.fire();ps.update(12);near(ps.snapshot().heat,.25/7.5);
});
