import {Vector3,MathUtils} from 'three';

const UP=new Vector3(0,1,0),BODY_HEIGHT=1.05;

/** Physical root trunk and jade assembly. Low floor details remain step-over art. */
export function createMechanismCollision({rootPosition,jadePosition,jadeYaw=0,discZs=[-2.45,0,2.45],rootHeight=()=>1.85,rootRadius=()=>.4}){
 const root=rootPosition.clone(),jade=jadePosition.clone(),normal=new Vector3();
 const local=p=>p.clone().sub(jade).applyAxisAngle(UP,-jadeYaw);
 const world=p=>p.applyAxisAngle(UP,jadeYaw).add(jade);
 const frames=discZs.flatMap(z=>[
  {x:-1.06,y:1.55,z,hx:.055,hy:1.115,hz:.075},
  {x:1.06,y:1.55,z,hx:.055,hy:1.115,hz:.075},
  {x:0,y:.49,z,hx:1.06,hy:.055,hz:.075},
  {x:0,y:2.61,z,hx:1.06,hy:.055,hz:.075}
 ]);
 function resolveMotion(from,to,radius=.27){
  if(from.distanceToSquared(root)>225&&to.distanceToSquared(root)>225&&from.distanceToSquared(jade)>225&&to.distanceToSquared(jade)>225)return null;
  const steps=Math.max(1,Math.ceil(from.distanceTo(to)/.16)),delta=to.clone().sub(from).divideScalar(steps);let current=from.clone(),hit=false,reason=null;normal.set(0,0,0);
  for(let i=0;i<steps;i++){
   const candidate=current.clone().add(delta);
   if(candidate.y<root.y+rootHeight()&&candidate.y+BODY_HEIGHT>root.y+.03){const away=candidate.clone().sub(root).setY(0),limit=rootRadius()+radius,d=away.length();if(d<limit){if(d<.00001){away.copy(current).sub(root).setY(0);if(away.lengthSq()<.00001)away.set(1,0,0);}away.normalize();candidate.x=root.x+away.x*limit;candidate.z=root.z+away.z*limit;normal.copy(away);hit=true;reason='古树正在这里扎根。沿树身侧面绕行，根巢前留着可以停步的空地。';}}
   if(candidate.distanceToSquared(jade)<100){const p=local(candidate),prior=local(current);
    for(const z of discZs){const closestY=MathUtils.clamp(1.55,p.y,p.y+BODY_HEIGHT),radial=Math.hypot(p.x,closestY-1.55),half=.08+radius;if(radial<.84+radius&&Math.abs(p.z-z)<half){const sign=Math.sign(prior.z-z)||Math.sign(p.z-z)||-1;p.z=z+sign*half;normal.set(0,0,sign).applyAxisAngle(UP,jadeYaw);hit=true;reason='玉轮是实心的。沿轮柄一侧绕行，或升高后飞越方框。';}}
    for(const box of frames){if(p.y>=box.y+box.hy+.025||p.y+BODY_HEIGHT<=box.y-box.hy)continue;const dx=p.x-box.x,dz=p.z-box.z,hx=box.hx+radius,hz=box.hz+radius;if(Math.abs(dx)<hx&&Math.abs(dz)<hz){const px=hx-Math.abs(dx),pz=hz-Math.abs(dz);if(px<pz){const sign=Math.sign(prior.x-box.x)||Math.sign(dx)||1;p.x=box.x+sign*hx;normal.set(sign,0,0);}else{const sign=Math.sign(prior.z-box.z)||Math.sign(dz)||-1;p.z=box.z+sign*hz;normal.set(0,0,sign);}normal.applyAxisAngle(UP,jadeYaw);hit=true;reason='方框就在面前。沿侧边绕行，或展翼升到框顶之上。';}}
    candidate.copy(world(p));
   }
   current.copy(candidate);
  }
  return {position:current,hit,normal:hit?normal.clone():null,reason};
 }
 return {resolveMotion};
}
