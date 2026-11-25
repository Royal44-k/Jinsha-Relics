import * as T from 'three';
import {createFootfallTracker} from './travel-response.js';

export function createTravelFeedback({scene,world,onFootfall=()=>{}}){
 const group=new T.Group();group.name='V7 · traces of a journey';scene.add(group);
 const tracker=createFootfallTracker(),count=64,dummy=new T.Object3D(),normal=new T.Vector3(),axis=new T.Vector3(0,0,1),point=new T.Vector3(),trailTangent=new T.Vector3(),trailView=new T.Vector3(),trailSide=new T.Vector3();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 c.lineCap='round';c.strokeStyle='#fff';c.lineWidth=7;
 for(const [x,y]of [[29,26],[64,12],[99,26]]){c.beginPath();c.moveTo(64,91);c.quadraticCurveTo(64+(x-64)*.45,56,x,y);c.stroke();}
 c.lineWidth=6;c.beginPath();c.moveTo(64,84);c.lineTo(51,113);c.stroke();
 const map=new T.CanvasTexture(canvas),geometry=new T.PlaneGeometry(.18,.25),alpha=new Float32Array(count),sides=new Float32Array(count);
 geometry.setAttribute('aFade',new T.InstancedBufferAttribute(alpha,1));
 geometry.setAttribute('aSide',new T.InstancedBufferAttribute(sides,1));
 const material=new T.MeshBasicMaterial({map,color:'#342b20',transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
 material.onBeforeCompile=s=>{s.vertexShader='attribute float aFade;attribute float aSide;varying float vFade;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFade=aFade;').replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.x=mix(vMapUv.x,1.-vMapUv.x,aSide);');s.fragmentShader='varying float vFade;\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=vFade*texture2D(map,vMapUv).r;');};
 material.customProgramCacheKey=()=> 'v7-footprint-fade';
 const marks=new T.InstancedMesh(geometry,material,count);marks.frustumCulled=false;marks.renderOrder=2;group.add(marks);
 const states=Array.from({length:count},()=>({age:100,life:0,p:new T.Vector3()}));let cursor=0,total=0;
 for(let i=0;i<count;i++){dummy.scale.setScalar(0);dummy.updateMatrix();marks.setMatrixAt(i,dummy.matrix);}
 const ribbonCount=24,ribbons=[];
 for(let side=0;side<2;side++){
  const positions=new Float32Array(ribbonCount*2*3),ages=new Float32Array(ribbonCount*2),indices=[];
  for(let i=0;i<ribbonCount-1;i++){let a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('aFade',new T.BufferAttribute(ages,1));g.setIndex(indices);
  const m=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{tint:{value:new T.Color('#c4d4c8')}},vertexShader:'attribute float aFade;varying float vFade;void main(){vFade=aFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float vFade;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,vFade*.19);}',blending:T.NormalBlending});
  const mesh=new T.Mesh(g,m);mesh.frustumCulled=false;mesh.visible=false;group.add(mesh);ribbons.push({mesh,positions,ages,history:[],at:0});
 }
 function stamp(event,yaw){
  const slot=cursor++%count,item=states[slot],p=event.position;item.p.set(p.x,p.y,p.z);item.age=0;item.life=event.surface==='mud'?28:event.surface==='wood'||event.surface==='stone'?5:18;
  const e=.07;point.set(p.x-e,p.y,p.z);const left=world.sample(point).groundHeight;point.x=p.x+e;const right=world.sample(point).groundHeight;
  point.set(p.x,p.y,p.z-e);const back=world.sample(point).groundHeight;point.z=p.z+e;const front=world.sample(point).groundHeight;
  normal.set(left-right,e*2,back-front).normalize();dummy.position.copy(item.p);dummy.quaternion.setFromUnitVectors(axis,normal);dummy.rotateZ(yaw);dummy.scale.setScalar(event.surface==='wood'?.86:1);dummy.updateMatrix();marks.setMatrixAt(slot,dummy.matrix);alpha[slot]=1;sides[slot]=event.id==='right'?1:0;total++;
 }
 function update(dt,time,{position,camera,motion={},character,yaw=0,playing=false,reduced=false,quality='high'}={}){
  if(!position)return;
  if(playing){for(const e of tracker.update(dt,{position,mode:motion.mode,speed:motion.speed,feet:character?.getFootContacts?.()||[],sample:p=>world.sample(p)})){onFootfall(e);if(!reduced)stamp(e,yaw);}}
  let visible=0;for(let i=0;i<count;i++){const s=states[i];s.age+=dt;alpha[i]=s.age<s.life?Math.pow(1-s.age/s.life,.8)*(s.p.distanceToSquared(position)<900?1:0):0;if(alpha[i]>.001)visible++;}
  marks.visible=visible>0;marks.instanceMatrix.needsUpdate=true;geometry.attributes.aFade.needsUpdate=true;geometry.attributes.aSide.needsUpdate=true;
  const air=['flying','gliding'].includes(motion.mode)&&motion.speed>3.5&&!reduced&&quality!=='low',tips=playing&&air?character?.getWingTips?.():null;
  for(let side=0;side<2;side++){
   const r=ribbons[side];if(dt>0){r.at+=dt;for(const p of r.history)p.age+=dt;r.history=r.history.filter(p=>p.age<.62);
    if(playing&&air&&tips?.[side]&&r.at>.025){r.at=0;const tip=tips[side];if(r.history.length&&r.history[0].p.distanceTo(tip)>2)r.history.length=0;r.history.unshift({p:tip.clone(),age:0});if(r.history.length>ribbonCount)r.history.pop();}}
   r.mesh.visible=!reduced&&quality!=='low'&&r.history.length>2;
   if(!r.mesh.visible)continue;
   for(let i=0;i<ribbonCount;i++){const index=Math.min(i,r.history.length-1),h=r.history[index],f=1-h.age/.62,width=.012*Math.sin(Math.PI*clamp01(f));trailTangent.copy(r.history[Math.max(0,index-1)].p).sub(r.history[Math.min(r.history.length-1,index+1)].p);trailView.copy(camera?.position||position).sub(h.p);trailSide.crossVectors(trailTangent,trailView);if(trailSide.lengthSq()<1e-8)trailSide.set(0,1,0);else trailSide.normalize();for(let j=0;j<2;j++){const k=(i*2+j)*3,side=(j?width:-width);r.positions[k]=h.p.x+trailSide.x*side;r.positions[k+1]=h.p.y+trailSide.y*side;r.positions[k+2]=h.p.z+trailSide.z*side;r.ages[i*2+j]=i<r.history.length?f:0;}}
   r.mesh.geometry.attributes.position.needsUpdate=true;r.mesh.geometry.attributes.aFade.needsUpdate=true;
  }
 }
 function reset(){tracker.reset();for(const s of states){s.life=0;s.age=100;}alpha.fill(0);for(const r of ribbons){r.history.length=0;r.mesh.visible=false;}marks.visible=false;cursor=0;total=0;}
 return {update,reset,stats:()=>({footfalls:tracker.snapshot().count,stamped:total,visible:states.filter(s=>s.age<s.life).length,ribbons:ribbons.filter(r=>r.mesh.visible).length}),dispose(){group.removeFromParent();geometry.dispose();material.dispose();map.dispose();for(const r of ribbons){r.mesh.geometry.dispose();r.mesh.material.dispose();}}};
}
const clamp01=v=>Math.max(0,Math.min(1,v));
