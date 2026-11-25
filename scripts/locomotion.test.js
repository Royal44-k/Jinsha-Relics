import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createLocomotion} from '../src/v3/locomotion.js';

// Deliberately small geometry fixtures: the controller, not a renderer, owns motion.
const ground = (extra = {}) => ({
  perches: [],
  sample(p) {return {groundHeight:0,waterLevel:null,waterDepth:0,zoneId:'forest',zoneName:'林间',boundary:null,wind:new Vector3(),ceil:14,...extra};},
  resolveMotion(from,to) {return {position:to.clone(),hit:false,normal:new Vector3(),reason:''};}
});
function advance(controller, seconds, input = {}, dt = 1 / 60) {
  const frames = Math.round(seconds / dt);
  for (let i=0;i<frames;i++) controller.update(dt,input);
}
function make(world=ground(),position=new Vector3()) {
  const events=[];
  const controller=createLocomotion({world,position,onEvent:e=>events.push(e)});
  return {controller,events};
}
test('fixed-step walking covers the same distance at 30, 60 and 144 Hz',()=>{
  const paths=[30,60,144].map(fps=>{const {controller:c}=make();advance(c,3,{moveZ:1},1/fps);return c.position.clone();});
  assert.ok(paths[0].distanceTo(paths[1])<0.001);
  assert.ok(paths[0].distanceTo(paths[2])<0.001);
  assert.ok(paths[0].z < -4 && paths[0].z > -7);
});
test('walking respects swept walls but powered flight crosses above them',()=>{
  const world=ground();
  world.resolveMotion=(from,to,radius)=>{
    const p=to.clone();
    if(from.z>=-2+radius && to.z<-2+radius && Math.min(from.y,to.y)<1.6){p.z=-2+radius;return {position:p,hit:true,normal:new Vector3(0,0,1),reason:'石坎'};}
    return {position:p,hit:false,normal:new Vector3()};
  };
  const {controller:c}=make(world);
  advance(c,2,{moveZ:1});
  assert.ok(c.position.z>-2);
  c.jump();advance(c,1.2,{ascend:true});advance(c,1.5,{ascend:true,moveZ:1});
  assert.ok(c.position.z<-3);
  assert.ok(c.position.y>1.6);
});
test('jump rises, held wings take off, released wings glide and land stably',()=>{
  const {controller:c,events}=make();
  c.jump();advance(c,.1);assert.ok(c.position.y>.1);
  advance(c,1.5,{ascend:true});assert.equal(c.state.mode,'flying');assert.ok(c.position.y>2);
  advance(c,.2);assert.equal(c.state.mode,'gliding');
  advance(c,14);assert.equal(c.state.mode,'grounded');assert.equal(c.position.y,0);assert.equal(c.velocity.y,0);
  assert.equal(events.filter(e=>e.type==='takeoff').length,1);
  assert.equal(events.filter(e=>e.type==='land').length,1);
});
test('water entry swims below the surface, dive submerges and ascent surfaces',()=>{
  const {controller:c,events}=make(ground({groundHeight:-3,waterLevel:0,waterDepth:3}),new Vector3(0,1,0));
  advance(c,2);assert.equal(c.state.mode,'swimming');assert.ok(c.position.y<0 && c.position.y>-.7);
  c.dive();advance(c,1.1,{descend:true,moveX:1});assert.equal(c.state.mode,'diving');assert.ok(c.position.y<-1);
  assert.ok(c.position.x>.5);assert.ok(c.state.oxygen<1);
  advance(c,2,{ascend:true});assert.equal(c.state.mode,'swimming');assert.ok(c.position.y>-.65);
  assert.ok(events.some(e=>e.type==='splash'));assert.ok(events.some(e=>e.type==='dive'));assert.ok(events.some(e=>e.type==='surface'));
});
test('oxygen exhaustion gently returns the diver to air even with dive held',()=>{
  const {controller:c,events}=make(ground({groundHeight:-5,waterLevel:0,waterDepth:5}),new Vector3(0,-.42,0));
  c.dive();advance(c,45,{descend:true});
  assert.equal(c.state.mode,'swimming');assert.ok(c.position.y>-.7);assert.ok(c.state.oxygen>.1);
  assert.ok(events.some(e=>e.type==='oxygen'));
});
test('nearby branches support a perch and jumping leaves it with momentum',()=>{
  const world=ground();world.perches=[{id:'cedar',position:new Vector3(0,4,0),radius:1,label:'杉枝'}];
  const {controller:c,events}=make(world,new Vector3(.3,4.2,0));
  assert.equal(c.interact(),true);assert.equal(c.state.mode,'perched');assert.equal(c.state.perchId,'cedar');assert.equal(c.position.y,4);
  advance(c,1);assert.equal(c.position.y,4);
  assert.deepEqual(c.getSnapshot().safePosition,[0,4,0]);assert.equal(c.getSnapshot().safePerchId,'cedar');
  c.jump();advance(c,.3,{ascend:true,moveZ:1});assert.equal(c.state.mode,'flying');assert.ok(c.position.y>4);assert.equal(c.state.perchId,null);
  assert.ok(events.some(e=>e.type==='perch'));
});
test('boundary wind warns sparingly, slows escape and permits reentry',()=>{
  const world=ground();const base=world.sample;
  world.sample=p=>({...base(p),boundary:p.x>5?{distance:10-p.x,inward:new Vector3(-1,0,0),message:'风壁就在前方'}:null});
  const {controller:c,events}=make(world,new Vector3(7,0,0));
  advance(c,4,{moveX:1,sprint:true});assert.ok(c.position.x<12);assert.ok(c.state.boundaryMessage);
  assert.ok(events.filter(e=>e.type==='boundary').length>=1 && events.filter(e=>e.type==='boundary').length<=2);
  advance(c,5,{moveX:-1});assert.ok(c.position.x<5);assert.equal(c.state.boundaryMessage,'');
});
test('stopping for focus loss clears velocity without teleporting or dropping a perch',()=>{
  const {controller:c}=make();advance(c,1,{moveZ:1});const position=c.position.clone();
  c.stop();assert.equal(c.velocity.length(),0);assert.deepEqual(c.position,position);assert.equal(c.state.mode,'grounded');
  c.reset(new Vector3(4,0,1));assert.deepEqual(c.position.toArray(),[4,0,1]);assert.equal(c.velocity.length(),0);
});
test('landing request descends to actual terrain rather than teleporting midair',()=>{
  const {controller:c}=make(ground({groundHeight:2}),new Vector3(0,9,0));
  c.land();assert.equal(c.position.y,9);advance(c,6);assert.equal(c.state.mode,'grounded');assert.equal(c.position.y,2);
});
test('steep ground blocks walking without raising the character up a cliff',()=>{
  const world=ground();const base=world.sample;world.sample=p=>({...base(p),groundHeight:p.z<-2?4:0});
  const {controller:c}=make(world);advance(c,3,{moveZ:1});assert.ok(c.position.z>=-2);assert.equal(c.position.y,0);
  c.jump();advance(c,2.2,{ascend:true});advance(c,1.6,{moveZ:1,ascend:true});assert.ok(c.position.z<-2);assert.ok(c.position.y>=4);
});
test('stamina depletion becomes a controlled glide and recovers after landing',()=>{
  const {controller:c,events}=make();c.jump();advance(c,25,{ascend:true});
  assert.notEqual(c.state.mode,'flying');assert.ok(Number.isFinite(c.position.y));assert.ok(events.some(e=>e.type==='fatigue'));
  advance(c,20);assert.equal(c.state.mode,'grounded');assert.ok(c.state.stamina>.8);
});
test('altitude cap pushes down smoothly without freezing controls',()=>{
  const {controller:c}=make(ground({ceil:6}));c.jump();advance(c,6,{ascend:true,moveZ:1});
  assert.ok(c.position.y<7);assert.ok(c.position.z<-15);assert.ok(c.state.boundaryMessage);
  advance(c,1,{descend:true,moveX:1});assert.ok(c.position.y<5.5);assert.ok(c.position.x>1);
});
test('a deep accidental fall recovers to the last solid checkpoint',()=>{
  const world=ground();const base=world.sample;world.sample=p=>({...base(p),groundHeight:p.z<-3?-80:0});
  const {controller:c,events}=make(world);advance(c,1,{moveZ:1});const checkpoint=c.getSnapshot().safePosition;
  c.position.set(0,-28,-5);advance(c,.1);
  assert.ok(c.position.y>=0);assert.ok(c.position.z>-3);assert.ok(events.some(e=>e.type==='recovery'));assert.ok(checkpoint[2]>-3);
});
test('walking off a riverbank falls into swimming instead of walking on the water',()=>{
  const world=ground();const base=world.sample;
  world.sample=p=>p.z<-2?{...base(p),groundHeight:-3,waterLevel:0,waterDepth:3}:base(p);
  const {controller:c}=make(world);advance(c,3,{moveZ:1});
  assert.equal(c.state.mode,'swimming');assert.ok(c.position.y<-.2);assert.ok(c.position.z<-3);
});
test('released flight keeps forward momentum while losing altitude',()=>{
  const {controller:c}=make();c.jump();advance(c,2,{ascend:true,moveZ:1});
  const height=c.position.y,z=c.position.z;advance(c,2);
  assert.ok(c.position.z<z-2);assert.ok(c.position.y<height);assert.equal(c.state.mode,'gliding');
});
test('powered flight and descent follow the same path across render frame rates',()=>{
  const results=[30,60,144].map(fps=>{const {controller:c}=make();c.jump();advance(c,3,{ascend:true,moveZ:1},1/fps);advance(c,1,{moveX:1,descend:true},1/fps);return c.getSnapshot();});
  for(const result of results.slice(1)) {
    assert.ok(new Vector3(...result.position).distanceTo(new Vector3(...results[0].position))<.001);
    assert.ok(Math.abs(result.stamina-results[0].stamina)<.0001);
  }
});
test('rising air slows a glide over a ravine without disabling steering',()=>{
  const calm=make(ground(),new Vector3(0,7,0)).controller;
  const lift=make(ground({wind:new Vector3(0,1.8,0)}),new Vector3(0,7,0)).controller;
  calm.land();lift.land();advance(calm,1.5,{moveZ:1});advance(lift,1.5,{moveZ:1});
  assert.ok(lift.position.y>calm.position.y+.5);
  assert.ok(lift.position.z<-2);
});
