import {Vector3,MathUtils} from 'three';
import {REBIRTH_OBSERVATION_DURATION} from '../v9/rebirth-view.js';

const smooth=(a,b,v)=>{const t=MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const groundedModes=new Set(['grounded','perched']);
const validPoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const durations={intro:5.8,root:4.8,rebirth:REBIRTH_OBSERVATION_DURATION,light:4.2,water:5.3,sun:7.8,fireflies:4.8,fish:4.8,birds:4.8};

/** A camera suggestion, never a player controller. The caller owns occlusion. */
export function createMomentDirector(){
 let active=null,pending=null;
 const shotPosition=new Vector3(),target=new Vector3(),pivot=new Vector3(),outward=new Vector3();
 function reset(){active=null;pending=null;}
 function play(event,context){
  if(context.reduced||context.manualInput||!context.playing||!groundedModes.has(context.motion?.mode)||context.motion.speed>.4){
   // A light can be delivered on the last few falling frames. Wait briefly for
   // that physical landing, but never capture the camera after active steering.
   if(event.id==='rebirth'&&!context.reduced&&!context.manualInput&&context.playing)pending={event:{...event},wait:0};
   return false;
  }
  pending=null;
  const anchor=context.position.clone(),focus=validPoint(event.focus||event.position)?new Vector3().fromArray(event.focus||event.position):anchor.clone().add(new Vector3(0,.9,0));
  // Distant event coordinates must not drag the camera across an unexplored zone.
  if(focus.distanceTo(anchor)>18)focus.copy(anchor).add(new Vector3(0,1,0));
  const duration=durations[event.id]||4.8;
  active={id:event.id||'moment',title:event.title||'',text:event.text||'',elapsed:MathUtils.clamp(Number(event.elapsed)||0,0,duration-1),blendElapsed:0,duration,anchor,focus,viewYaw:Number.isFinite(event.viewYaw)?event.viewYaw:null,yaw:context.yaw||0};
  return true;
 }
 function update(dt,context){
  const delta=Math.max(0,Math.min(.1,Number(dt)||0));
  if(pending){
   if(context.reduced||context.manualInput){reset();return null;}
   if(!context.playing)return null;
   pending.wait+=delta;
   if(pending.wait>1.4){pending=null;return null;}
   if(groundedModes.has(context.motion?.mode)&&context.motion.speed<=.4){const event={...pending.event,elapsed:(Number(pending.event.elapsed)||0)+pending.wait-delta};pending=null;play(event,context);}
  }
  if(!active)return null;
  if(context.reduced||context.manualInput||context.position.distanceTo(active.anchor)>1.4){reset();return null;}
  if(!context.playing)return null;
  active.elapsed+=delta;active.blendElapsed+=delta;
  const {elapsed,duration,anchor,focus,yaw,id}=active;
  if(elapsed>=duration){reset();return null;}
  const progress=elapsed/duration,weight=smooth(0,.85,active.blendElapsed)*(1-smooth(duration-1.05,duration,elapsed));
  if(id==='rebirth'){
   // Eighteen-second growth, followed by a short look at the mature canopy.
   // The player remains free to move/orbit and relinquishes the shot immediately.
   const rise=smooth(2.16,12.96,elapsed),crown=smooth(6.84,17.28,elapsed);
   outward.copy(anchor).sub(focus).setY(0);
   if(outward.lengthSq()<.1)outward.set(Math.sin(yaw),0,Math.cos(yaw));
   outward.normalize();const a=(active.viewYaw??Math.atan2(outward.x,outward.z))+Math.sin(progress*Math.PI)*.07;
   const distance=7.8+rise*9.8+crown*1.4;
   shotPosition.copy(focus).add(new Vector3(Math.sin(a)*distance,2.6+rise*4.2,Math.cos(a)*distance));
   target.copy(focus).y+=1.7+rise*4.2;
   return {position:shotPosition,target,weight,fov:52+rise*4,progress,id,title:active.title,text:active.text};
  }
  pivot.copy(anchor).y+=.82;
  target.copy(pivot).lerp(focus,id==='intro'?.34:id==='sun'?.32:.36);
  const angle=yaw+(id==='intro'?.38:.12)+Math.sin(progress*Math.PI)*.16;
  const distance=id==='intro'?3.6+progress*.7:id==='sun'?5.6:5.05+progress*.65;
  shotPosition.copy(pivot).add(new Vector3(Math.sin(angle)*distance,(id==='intro'?.45:id==='sun'?1.7:1.05)+Math.sin(progress*Math.PI)*.55,Math.cos(angle)*distance));
  return {position:shotPosition,target,weight,fov:id==='intro'?44:id==='sun'?52:47,progress,id,title:active.title,text:active.text};
 }
 return {play,update,reset,snapshot:()=>active?{active:true,id:active.id,title:active.title,elapsed:active.elapsed,duration:active.duration}:{active:false,queued:!!pending}};
}
