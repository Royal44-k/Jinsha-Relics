import {Vector3,Raycaster,MathUtils} from 'three';

export const REBIRTH_OBSERVATION_DURATION=22.2;
const UP=new Vector3(0,1,0),DURATION=REBIRTH_OBSERVATION_DURATION;
const DEFAULT_OFFSETS=[0,15,-15,30,-30,60,-60,90,-90,135,-135,180].map(n=>n*Math.PI/180);
const smooth=(a,b,n)=>{const t=MathUtils.clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const point=value=>value?.isVector3?value.clone():Array.isArray(value)&&value.length===3?new Vector3(...value):null;
const finite=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

/** Same authored pull-back as the moment director. Returns independent vectors. */
export function rebirthViewPose({focus,yaw,elapsed}){
 const centre=point(focus);if(!finite(centre)||!Number.isFinite(yaw))return null;
 const t=MathUtils.clamp(Number(elapsed)||0,0,DURATION),rise=smooth(2.16,12.96,t),crown=smooth(6.84,17.28,t),angle=yaw+Math.sin(t/DURATION*Math.PI)*.07,distance=7.8+rise*9.8+crown*1.4;
 return {position:centre.clone().add(new Vector3(Math.sin(angle)*distance,2.6+rise*4.2,Math.cos(angle)*distance)),target:centre.clone().add(new Vector3(0,1.7+rise*4.2,0)),fov:52+rise*4};
}

/**
 * One-shot, deterministic view selection. Call when a rebirth starts; retain
 * the returned yaw for the entire shot. Never call this from a frame update.
 *
 * raycast(raycaster, filteredObjects, recursive=false) returns the nearest hit
 * or null, e.g. cameraClearance.first. The meshes must have current world
 * matrices. sampleTerrain(Vector3) returns a world height (or traversal.sample
 * result). An invalid query/height makes the candidate unreliable, not clear.
 * The subject tag is excluded recursively, including tagged ancestor groups.
 * A null result leaves the caller's original camera behaviour unchanged.
 */
export function chooseRebirthView({focus,anchor,yaw=0,colliders=[],raycast,sampleTerrain,offsets=DEFAULT_OFFSETS,samples=21,radius=.38,groundClearance=.45}={}){
 const centre=point(focus),origin=point(anchor);if(!finite(centre)||!finite(origin)||typeof raycast!=='function'||typeof sampleTerrain!=='function')return null;
 const outward=origin.clone().sub(centre).setY(0),base=outward.lengthSq()>=.1?Math.atan2(outward.x,outward.z):Number.isFinite(yaw)?yaw:0;
 const objects=[],seen=new Set();
 const excluded=o=>{for(let p=o;p;p=p.parent)if(p.userData?.cameraSubject==='rebirth-root')return true;return false;};
 function visit(o){if(!o||seen.has(o)||excluded(o))return;seen.add(o);if(o.isMesh||o.isLine||o.isPoints||o.isSprite)objects.push(o);for(const child of o.children||[])visit(child);}
 for(const object of colliders)visit(object);
 const count=MathUtils.clamp(Math.round(samples),9,41),padding=MathUtils.clamp(radius,.15,.8),ray=new Raycaster(),direction=new Vector3(),right=new Vector3(),vertical=new Vector3(),start=new Vector3(),end=new Vector3();
 let probes=0,candidates=0;
 function unobstructed(a,b){direction.copy(b).sub(a);const distance=direction.length();if(distance<1e-6)return true;ray.set(a,direction.multiplyScalar(1/distance));ray.near=0;ray.far=distance+.08;probes++;const hit=raycast(ray,objects,false);return hit==null||(Number.isFinite(hit.distance)&&hit.distance>distance+.06);}
 function terrainClear(p){for(const [x,z] of [[0,0],[-padding,0],[padding,0],[0,-padding],[0,padding]]){start.copy(p);start.x+=x;start.z+=z;const sample=sampleTerrain(start),height=typeof sample==='number'?sample:sample?.terrainHeight??sample?.groundHeight;if(!Number.isFinite(height)||p.y<height+groundClearance)return false;}return true;}
 function clearPose(pose,previous){
  if(!terrainClear(pose.position))return false;
  direction.copy(pose.position).sub(pose.target).normalize();right.crossVectors(UP,direction).normalize();vertical.crossVectors(direction,right).normalize();
  // A padded sight bundle protects composition from near branches; swept
  // camera segments also reject an obstruction between two temporal samples.
  for(let i=0;i<5;i++){
   const x=i===1?-padding:i===2?padding:0,y=i===3?-padding:i===4?padding:0;
   start.copy(pose.target).addScaledVector(right,x).addScaledVector(vertical,y);end.copy(pose.position).addScaledVector(right,x).addScaledVector(vertical,y);
   if(!unobstructed(start,end))return false;
   if(previous){start.copy(previous.position).addScaledVector(right,x).addScaledVector(vertical,y);if(!unobstructed(start,end))return false;}
  }
  return true;
 }
 const ordered=[...new Set(offsets.filter(Number.isFinite))].sort((a,b)=>Math.abs(a)-Math.abs(b));
 for(const offset of ordered){candidates++;const selected=base+offset;let previous=null,clear=true;for(let i=0;i<count;i++){const pose=rebirthViewPose({focus:centre,yaw:selected,elapsed:i/(count-1)*DURATION});if(!clearPose(pose,previous)){clear=false;break;}previous=pose;}if(clear)return {yaw:Math.atan2(Math.sin(selected),Math.cos(selected)),offset,baseYaw:base,samples:count,probes,candidates};}
 return null;
}
