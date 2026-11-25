import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createMomentDirector} from '../src/v6/director.js';
import {REBIRTH_OBSERVATION_DURATION,rebirthViewPose} from '../src/v9/rebirth-view.js';

const context={playing:true,reduced:false,manualInput:false,position:new Vector3(0,0,4),yaw:0,motion:{mode:'grounded',speed:0}};
test('tree reveal covers full growth, climbs smoothly and yields after its last leaf',()=>{
 const d=createMomentDirector();assert.ok(d.play({id:'rebirth',focus:[0,0,0]},context));
 let previous=null,peakTarget=0,maxStep=0;
 for(let i=0;i<Math.round(REBIRTH_OBSERVATION_DURATION*60)-1;i++){
  const shot=d.update(1/60,context);assert.ok(shot);peakTarget=Math.max(peakTarget,shot.target.y);
  if(previous)maxStep=Math.max(maxStep,previous.distanceTo(shot.position));previous=shot.position.clone();
  assert.ok(shot.position.toArray().every(Number.isFinite));assert.ok(shot.position.distanceTo(new Vector3())<22);
 }
 assert.ok(peakTarget>5.8);assert.ok(maxStep<.04,`camera displacement per 60 Hz frame: ${maxStep}`);
 for(let i=0;i<6;i++)d.update(1/60,context);assert.equal(d.snapshot().active,false);
});

test('mature canopy remains fully framed from 18 through 21 seconds, then returns smoothly',()=>{
 const d=createMomentDirector();d.play({id:'rebirth',focus:[0,0,0],viewYaw:.67},context);let matureFrames=0,previousWeight=1,returnFrames=0;
 for(let i=0;i<Math.round(REBIRTH_OBSERVATION_DURATION*60)-1;i++){
  const shot=d.update(1/60,context),elapsed=d.snapshot().elapsed;
  const reference=rebirthViewPose({focus:[0,0,0],yaw:.67,elapsed});
  assert.ok(shot.position.distanceTo(reference.position)<1e-10);assert.ok(shot.target.distanceTo(reference.target)<1e-10);assert.equal(shot.fov,reference.fov);
  if(elapsed>=18&&elapsed<=21){matureFrames++;assert.equal(shot.weight,1);assert.ok(Math.abs(shot.target.y-5.9)<1e-10);assert.equal(shot.fov,56);}
  if(elapsed>REBIRTH_OBSERVATION_DURATION-1.05){returnFrames++;assert.ok(shot.weight<=previousWeight);assert.ok(previousWeight-shot.weight<.025);previousWeight=shot.weight;}
 }
 assert.ok(matureFrames>=179);assert.ok(returnFrames>=61);assert.ok(previousWeight<.002);
 d.update(.04,context);assert.equal(d.snapshot().active,false);
});
test('growth observation pauses and returns full camera control on movement or reduced motion',()=>{
 const d=createMomentDirector();d.play({id:'rebirth',focus:[0,0,0]},context);for(let i=0;i<120;i++)d.update(1/60,context);
 const elapsed=d.snapshot().elapsed;d.update(.1,{...context,playing:false});assert.equal(d.snapshot().elapsed,elapsed);
 assert.equal(d.update(.016,{...context,manualInput:true}),null);assert.equal(d.snapshot().active,false);
 d.play({id:'rebirth',focus:[0,0,0]},context);assert.equal(d.update(.016,{...context,reduced:true}),null);
});
test('delivery on the final falling frames waits for landing, keeps growth time and blends gently',()=>{
 const d=createMomentDirector(),falling={...context,motion:{mode:'falling',speed:0}};
 assert.equal(d.play({id:'rebirth',focus:[0,0,0]},falling),false);assert.equal(d.snapshot().queued,true);
 for(let i=0;i<5;i++)assert.equal(d.update(.1,falling),null);
 const shot=d.update(.016,context);assert.equal(d.snapshot().active,true);assert.ok(Math.abs(d.snapshot().elapsed-.516)<1e-9);assert.ok(shot.weight<.01);
 const another=createMomentDirector();another.play({id:'rebirth',focus:[0,0,0]},falling);another.update(.1,{...falling,manualInput:true});assert.equal(another.snapshot().queued,false);assert.equal(another.update(.1,context),null);
});
