import {Vector3,MathUtils} from 'three';
import {contactFraction} from './survey-solids.js';
import {ground} from './geography.js';

const bodyRadius=.29,bodyHeight=1;
const probe=new Vector3();
function route(points,lengths){
  const length=lengths[lengths.length-1];
  return {points,lengths,length,leg:1,elapsed:0,duration:MathUtils.clamp(length/5.4,1.4,12)};
}
export function clearFlightLeg(world,a,b){
  for(const solid of world.solidsNear(a,b,bodyRadius)){
    if(contactFraction(a,b,solid,bodyRadius,bodyHeight,probe)<=1)return false;
  }
  return true;
}

// Try a shallow sweep down the river first; a blocked chord gets a lateral
// turn, then higher alternatives. Every leg is cast with the actor envelope.
export function planSurveyFlight(world,start,goal){
  const dx=goal.x-start.x,dz=goal.z-start.z,span=Math.max(.1,Math.hypot(dx,dz));
  const segments=Math.max(12,Math.ceil(span/.85));
  const arc=MathUtils.clamp(span*.13,1.1,4.2),bend=MathUtils.clamp(span*.18,1.9,7);
  const side=(Math.sin(goal.x+start.z)>=0?1:-1)*bend;
  const offsets=[0,side,-side,side*2,-side*2,side*3,-side*3];
  for(const lift of [arc,.24,arc+2.8,8.8,12.1])for(const offset of offsets){
    const points=[start.clone()],lengths=[0];let complete=true;
    for(let i=1;i<=segments;i++){
      const u=i/segments,sine=Math.sin(Math.PI*u);
      const p=start.clone().lerp(goal,u);
      p.x-=dz/span*offset*sine;p.z+=dx/span*offset*sine;
      if(i<segments){
        // The exposed soil above an excavation is also actual terrain.
        let bed=ground(p.x,p.z);
        for(const s of world.surfaces){
          if(s.earth&&p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ)bed=Math.max(bed,s.heightAt(p.x,p.z));
        }
        p.y=Math.max(bed+.05,p.y+lift*sine);
      }
      const last=points[points.length-1];
      if(!clearFlightLeg(world,last,p)){complete=false;break;}
      lengths.push(lengths[lengths.length-1]+last.distanceTo(p));points.push(p);
    }
    if(complete)return route(points,lengths);
  }
  // A long flight can leave the trench in the wrong direction or meet the
  // edge of a shelter on final approach. Rise in the clearing, cross above
  // the canopy, then land vertically in the other clearing.
  for(const altitude of [6.4,9.8,14.1]){
    const top=Math.max(start.y,goal.y,altitude);
    const points=[start.clone(),new Vector3(start.x,top,start.z),new Vector3(goal.x,top,goal.z),goal.clone()];
    const lengths=[0];let safe=true;
    for(let i=1;i<points.length;i++){
      if(!clearFlightLeg(world,points[i-1],points[i])){safe=false;break;}
      lengths.push(lengths[i-1]+points[i-1].distanceTo(points[i]));
    }
    if(safe)return route(points,lengths);
  }
  return null;
}

export function advanceSurveyFlight(world,run,position,elapsed){
  run.elapsed=Math.min(run.duration,run.elapsed+Math.min(.10,elapsed));
  const u=run.elapsed/run.duration,distance=run.length*u*u*(3-2*u);
  while(run.leg<run.points.length){
    const hi=run.lengths[run.leg],lo=run.lengths[run.leg-1];
    probe.lerpVectors(run.points[run.leg-1],run.points[run.leg],MathUtils.clamp((distance-lo)/Math.max(.00001,hi-lo),0,1));
    // A station can materialise while the guide is already in flight.
    const hit=world.resolveMotion(position,probe,bodyRadius);
    if(hit.hit)return 'blocked';
    position.copy(probe);
    if(distance<hi-.00001)return 'moving';
    run.leg++;
  }
  return 'arrived';
}
