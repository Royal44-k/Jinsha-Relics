import {simulationDelta} from '../v8/frame-time.js';

const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

/** Separate player intent from the orbit that follows it. Feeding the changing
 * orbit straight back into held WASD makes a chase camera drive its own circle. */
export function createTravelCamera({grace=1.9,response=3.1}={}){
 let yaw=0,basis=0,lastInputAngle=0,moving=false,manualLeft=0,orbitRevision=0,inputRevision=0;
 function reset(value=0){yaw=basis=finite(value);lastInputAngle=0;moving=false;manualLeft=0;orbitRevision=inputRevision=0;}
 function resolveInput(input={}){
  const x=finite(input.moveX),z=finite(input.moveZ),active=Math.hypot(x,z)>.08;
  const inputAngle=Math.atan2(x,z);
  if(!active)basis=yaw;
  if(active&&(!moving||Math.abs(angle(inputAngle,lastInputAngle))>.12||inputRevision!==orbitRevision)){
   basis=yaw;lastInputAngle=inputAngle;inputRevision=orbitRevision;
  }
  moving=active;
  return {...input,yaw:basis};
 }
 function orbit(delta){yaw+=finite(delta);manualLeft=grace;orbitRevision++;}
 function update(dt,{heading=yaw,speed=0,moving:hasIntent=false,locked=false,focusHeading=null}={}){
  const elapsed=simulationDelta(dt);if(!elapsed)return yaw;
  const remaining=manualLeft;manualLeft=Math.max(0,manualLeft-elapsed);
  if(Number.isFinite(focusHeading)){
   yaw+=angle(focusHeading,yaw)*(1-Math.exp(-elapsed*3.6));return yaw;
  }
  const followElapsed=Math.max(0,elapsed-remaining);
  if(locked||followElapsed<=0||!hasIntent||speed<.28)return yaw;
  const delta=angle(finite(heading,yaw),yaw);
  // Exact exponential response is independent of the display refresh rate.
  yaw+=delta*(1-Math.exp(-followElapsed*response));return yaw;
 }
 return {get yaw(){return yaw;},reset,resolveInput,orbit,update,
  stopInput(){moving=false;},snapshot:()=>({yaw,basis,manualLeft,moving})};
}

/** Retain an obstacle shoulder until a different side is clearly better.
 * A hard obstruction still wins immediately, while nearly equal branches do
 * not swap the camera left/right every frame. */
export function createAvoidanceMemory(){
 let offset=0,hold=0;
 return {
  reset(){offset=hold=0;},
  choose(dt,candidates){
   hold=Math.max(0,hold-simulationDelta(dt));
   const score=c=>c.allowed-Math.abs(c.offset)*.23;
   const best=candidates.reduce((a,b)=>score(b)>score(a)?b:a);
   const retained=candidates.reduce((a,b)=>Math.abs(b.offset-offset)<Math.abs(a.offset-offset)?b:a);
   const direct=candidates.find(c=>c.offset===0);
   const clear=direct&&direct.allowed>direct.length-.08;
   const switchSide=Math.sign(best.offset)!==Math.sign(offset)&&offset!==0&&best.offset!==0;
   const required=switchSide?.65:.28;
   if(clear&&hold<=0){offset=0;return direct;}
   if(retained.allowed<.9||score(best)>score(retained)+required&&hold<=0){offset=best.offset;hold=.45;return best;}
   return retained;
  },snapshot:()=>({offset,hold})
 };
}
