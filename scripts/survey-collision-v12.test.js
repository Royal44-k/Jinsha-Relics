import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createSurveyWorld} from '../src/v10/geography.js';
import {planSurveyFlight,advanceSurveyFlight} from '../src/v10/survey-flight.js';
import {cameraReach} from '../src/v10/camera-boom.js';

const point=(x,y,z)=>new Vector3(x,y,z);
test('Thin stakes stop long dash strokes; the exact centre cannot pass through',()=>{
  const w=createSurveyWorld();
  w.colliders.push({x:0,z:0,y:0,height:2,radius:.07});
  const hit=w.resolveMotion(point(-6,.2,0),point(6,.2,0),.27);
  assert.ok(hit.hit&&Math.abs(hit.position.x+.34)<.002);
  assert.ok(w.resolveMotion(point(-6,.2,0),point(0,.2,0),.27).hit);
  assert.equal(w.resolveMotion(point(-6,2.1,0),point(6,2.1,0),.27).hit,false);
});
test('Slipping along a shelf stops at the second wall of a corner',()=>{
  const w=createSurveyWorld();
  w.colliders.push({x:0,z:0,y:0,height:2,halfX:.1,halfZ:3},{x:-1,z:2,y:0,height:2,halfX:1,halfZ:.1});
  const h=w.resolveMotion(point(-2,.1,0),point(1,.1,3),.27);
  assert.ok(h.hit&&h.position.x<=-.369&&h.position.z<=1.631);
});
test('A loft permits walking under it, blocks rising heads, and supports landing feet',()=>{
  const w=createSurveyWorld();w.colliders.push({x:-12,z:0,y:5,height:.25,halfX:1,halfZ:2});
  assert.equal(w.resolveMotion(point(-15,2,0),point(-9,2,0),.27).hit,false);
  const up=w.resolveMotion(point(-12,2,0),point(-12,7,0),.27);
  assert.ok(up.hit&&up.normal.y===-1&&Math.abs(up.position.y-4)<.001);
  const down=w.resolveMotion(point(-12,8,0),point(-12,3,0),.27);
  assert.ok(down.hit&&down.normal.y===1&&Math.abs(down.position.y-5.25)<.001);
  assert.equal(w.sample(down.position).groundHeight,5.25);
  assert.ok(cameraReach(point(-12,2,0),point(-12,7,0),w.colliders)<.65);
});
test('Guided flight bends around solid timber and never advances through newly streamed props',()=>{
  const w=createSurveyWorld();w.colliders.push({x:-12,z:0,y:0,height:16,radius:.8});
  const start=point(-12,2,5),goal=point(-12,2,-5),run=planSurveyFlight(w,start,goal);
  assert.ok(run&&run.points.some(p=>Math.abs(p.x+12)>1));
  const p=start.clone();let mode='moving';
  while(mode==='moving'){mode=advanceSurveyFlight(w,run,p,.065);assert.ok(Math.hypot(p.x+12,p.z)>=1.08);}
  assert.equal(mode,'arrived');assert.ok(p.distanceTo(goal)<.001);
  const second=planSurveyFlight(w,start,goal);p.copy(start);
  w.colliders.push({x:-12,z:2,y:-1,height:20,halfX:5,halfZ:.06});
  while(advanceSurveyFlight(w,second,p,.1)==='moving'){}
  assert.ok(p.z>2);
});

test('A submerged rock stops the feet without making the entire north channel a shallow ford',()=>{
  const w=createSurveyWorld(),p=point(7.97,-.42,-71.15),depth=w.sample(p).waterDepth;
  w.colliders.push({x:p.x,z:p.z,y:-1.74,height:.48,radius:.42});
  const s=w.sample(p);
  assert.equal(s.waterLevel,0);assert.ok(depth>1.45&&s.waterDepth===depth);
  assert.ok(Math.abs(s.groundHeight+1.26)<1e-5);
});
