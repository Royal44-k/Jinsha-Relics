import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createMomentDirector } from '../src/v6/director.js';

const idle = {playing:true,reduced:false,manualInput:false,position:new Vector3(),yaw:0,motion:{mode:'grounded',speed:0}};
test('a quiet reveal blends in, remains bounded, and releases its camera',()=>{
  const d=createMomentDirector();
  assert.equal(d.play({id:'root',focus:[0,2,-5],title:'根脉醒来'},idle),true);
  let shot;
  for(let i=0;i<35;i++) shot=d.update(.04,idle);
  assert.ok(shot.weight>.8 && shot.weight<=1);
  assert.ok(shot.position.distanceTo(idle.position)<9);
  assert.ok(shot.target.toArray().every(Number.isFinite));
  for(let i=0;i<160;i++) d.update(.04,idle);
  assert.equal(d.snapshot().active,false);
});
test('manual movement or camera input relinquishes camera on the same frame',()=>{
  const d=createMomentDirector();d.play({id:'intro'},idle);d.update(.4,idle);
  assert.equal(d.update(.016,{...idle,manualInput:true}),null);
  assert.equal(d.snapshot().active,false);
});
test('pause freezes the shot, reduced motion cancels, and flight cannot start a shot',()=>{
  const d=createMomentDirector();d.play({id:'root'},idle);d.update(.25,idle);
  const before=d.snapshot().elapsed;
  d.update(10,{...idle,playing:false});assert.equal(d.snapshot().elapsed,before);
  assert.equal(d.update(.01,{...idle,reduced:true}),null);
  assert.equal(d.play({id:'root'},{...idle,motion:{mode:'gliding',speed:0}}),false);
  assert.equal(d.play({id:'root'},{...idle,manualInput:true}),false);
});
test('invalid event coordinates fall back to the player and reset clears the scene',()=>{
  const d=createMomentDirector();d.play({id:'root',focus:[NaN,Infinity,0]},idle);
  const shot=d.update(.2,idle);assert.ok(shot.target.toArray().every(Number.isFinite));
  d.reset();assert.equal(d.snapshot().active,false);
});
