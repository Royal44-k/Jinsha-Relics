import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createLocomotion} from '../src/v3/locomotion.js';
import {createExpeditionState} from '../src/v9/expedition-state.js';

const world={sample:()=>({groundHeight:0,waterLevel:null,waterDepth:0,ceil:18,wind:new Vector3()}),resolveMotion:(_from,to)=>({position:to.clone(),hit:false}),perches:[]};
function attempt({distance,trigger,action='jump',fps=60}){
 const motion=createLocomotion({world,position:new Vector3(distance,0,0)}),hits=[],state=createExpeditionState({onEvent:e=>{if(e.type==='encounter-hit')hits.push({height:motion.position.y,mode:motion.state.mode});}});state.begin('reed');let fired=false,maxHeight=0,jumpAt=null;
 for(let frame=0;frame<fps*4.1;frame++){
  const s=state.snapshot('reed',Math.hypot(motion.position.x,motion.position.z));
  if(!fired&&trigger?.(s)){fired=true;jumpAt=frame/fps;if(action==='jump')motion.jump();else if(action==='dash')motion.dash({moveX:-1,moveZ:0,yaw:0});else if(action==='flight')motion.toggleCruise();}
  motion.update(1/fps,{});maxHeight=Math.max(maxHeight,motion.position.y);
  state.advance(1/fps,{distance:Math.hypot(motion.position.x,motion.position.z),height:motion.position.y,dashing:motion.state.dashing,playing:true});
 }
 return {ward:state.snapshot('reed',distance).ward,maxHeight,jumpAt,hits,mode:motion.state.mode};
}
test('actual short Space jump clears a low wave near the core and at mid distance, across display rates',()=>{
 for(const fps of [30,60,144])for(const [distance,progress] of [[2.367,.015],[2.367,.055],[2.367,.08],[5.8,.25],[5.8,.32],[5.8,.4]]){
  const result=attempt({distance,fps,trigger:s=>s.phase==='wave'&&s.progress>progress});
  assert.ok(result.maxHeight>.78&&result.maxHeight<.86,'a short jump must remain the actual ballistic jump, without powered flight');
  assert.equal(result.ward,3,JSON.stringify({fps,distance,...result}));assert.equal(result.mode,'grounded');
 }
});
test('jump timing remains meaningful: an early landing, a late input and standing still all take one hit',()=>{
 for(const distance of [2.367,5.8])for(const trigger of [null,s=>s.phase==='windup'&&s.progress>.5,s=>s.phase==='wave'&&s.waveRadius>distance+.2]){
  const result=attempt({distance,trigger});assert.equal(result.ward,2);assert.equal(result.hits.length,1);
 }
});
test('real X movement and sustained flight still avoid the wave rather than relying on a synthetic immune flag',()=>{
 for(const distance of [2.367,5.8]){
  const dash=attempt({distance,action:'dash',trigger:s=>s.phase==='wave'&&s.waveRadius>distance-1.25});assert.equal(dash.ward,3,JSON.stringify({distance,dash}));
  const flight=attempt({distance,action:'flight',trigger:s=>s.phase==='windup'&&s.progress>.7});assert.equal(flight.ward,3);assert.ok(flight.maxHeight>1.1);assert.equal(flight.mode,'flying');
 }
});
