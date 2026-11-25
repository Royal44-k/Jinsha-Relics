import {simulationDelta} from '../v8/frame-time.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const copy=p=>({x:p.x,y:p.y,z:p.z});

/** Tracks contact transitions, rather than inventing footsteps from elapsed time. */
export function createFootfallTracker(){
 const feet=new Map();let previous=null,time=0,count=0;
 function reset(){feet.clear();previous=null;time=0;count=0;}
 function update(dt,{mode,speed=0,position,feet:contacts=[],sample}={}){
  if(!(dt>0)||!position)return [];
  time+=simulationDelta(dt);const jumped=previous&&distance(previous,position)>3;previous=copy(position);
  if(jumped||mode!=='grounded'){feet.clear();return [];}
  const events=[];
  for(const f of contacts){
   if(!f?.position||![f.position.x,f.position.y,f.position.z].every(Number.isFinite))continue;
   const surface=sample(f.position),clearance=f.position.y-surface.groundHeight;
   const planted=f.planted===undefined?Math.abs(clearance)<.045:f.planted;
   let old=feet.get(f.id);
   if(!old){feet.set(f.id,{planted,point:copy(f.position),at:time});continue;}
   if(planted&&!old.planted&&speed>.18&&time-old.at>.12&&distance(f.position,old.point)>.075&&Math.abs(clearance)<.1){
    old.point=copy(f.position);old.at=time;count++;
    events.push({id:f.id,position:{...old.point,y:surface.groundHeight+.006},surface:surface.surface||'soil',strength:clamp(.28+speed*.17,.3,.85)});
   }
   old.planted=planted;
  }
  return events;
 }
 return {update,reset,snapshot:()=>({count,tracked:feet.size})};
}

/** A small damped lens response. It never rotates the player's movement frame. */
export function createCameraResponse(){
 let y=0,vy=0,roll=0;
 const value={y:0,roll:0};
 return {
  impulse(impact){vy-=clamp(impact,0,12)*.027;},
  update(dt,{bank=0,speed=0,air=false,reduced=false}={}){
   if(reduced){y=vy=roll=0;value.y=value.roll=0;return value;}
   if(!(dt>0))return value;
   // Substeps preserve the spring under slower hardware and tab resumption.
   const elapsed=simulationDelta(dt),n=Math.max(1,Math.ceil(elapsed/.008)),step=elapsed/n;
   for(let i=0;i<n;i++){vy+=(-y*92-vy*16)*step;y=clamp(y+vy*step,-.085,.04);}
   const target=air?clamp(bank,-.45,.45)*Math.min(speed/5,1)*.055:0;
   roll+=(target-roll)*(1-Math.exp(-dt*3));value.y=y;value.roll=roll;return value;
  },
  reset(){y=vy=roll=0;value.y=value.roll=0;},
  snapshot:()=>({y,vy,roll})
 };
}
