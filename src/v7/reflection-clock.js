// Reuse a planar texture only while its world-space camera and projection are
// exactly unchanged. No tolerance: even slow dolly/zoom motion needs new UVs.
export function createReflectionClock(){
 const interval=1/30,epsilon=1e-9,previousWorld=new Float64Array(16),previousProjection=new Float64Array(16);
 let valid=false,next=0,lastTime=0;
 function invalidate(){valid=false;}
 function shouldRender({time,world,projection}){
  let changed=!valid||time<lastTime;
  for(let i=0;i<16&&!changed;i++)changed=world[i]!==previousWorld[i]||projection[i]!==previousProjection[i];
  lastTime=time;
  if(changed){
   previousWorld.set(world);previousProjection.set(projection);valid=true;next=time+interval;return true;
  }
  if(time+epsilon<next)return false;
  // Advance the existing phase, rather than starting a new interval at a late
  // frame. This keeps 30 Hz at 60/90/144 Hz and skips missed slots in one step.
  next+=(Math.floor((time+epsilon-next)/interval)+1)*interval;
  return true;
 }
 return {shouldRender,invalidate};
}
