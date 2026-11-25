import * as T from 'three';
import {riverX} from '../v10/geography.js';
import {duckBody,duckHead,duckFoot,duckWings} from './river-duck-model.js';
import {createWakeStrip} from './river-wake.js';

const tau=Math.PI*2;
const ease=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const flock=[[-1.25,-1.42],[-.17,.35],[1.05,-.76],[1.58,1.25],[-1.05,1.95],[.28,2.7]];
const roosts=[29.0,12.8];
const glideLength=8.4;

export function createRiverPassage(scene,{reduced=false,cue=()=>{}}={}){
  const root=new T.Group();root.name='芦湾 · 水鸟过汊';scene.add(root);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.79,side:T.DoubleSide});
  function batch(geometry,count){
    const mesh=new T.InstancedMesh(geometry,material,count);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;
    root.add(mesh);return mesh;
  }
  const bodies=[batch(duckBody(false),3),batch(duckBody(true),3)];
  const heads=[batch(duckHead(false),3),batch(duckHead(true),3)],feet=batch(duckFoot(),flock.length*2);
  const wingBatches=[-1,1].map(sign=>duckWings(sign).map(geo=>batch(geo,flock.length)));
  const wake=createWakeStrip(root,flock.length,12),base=new T.Object3D(),joint=new T.Object3D(),hand=new T.Object3D();
  const poses=flock.map(([side,offset],i)=>({side,offset,yaw:0,x:0,z:0,y:0,fromX:0,fromZ:0,delay:(i%3)*.15+Math.floor(i/3)*.23}));
  let patch=0,clock=0,elapsed=-1,flights=0,allow=false,rest=0,visible=false,phase='游弋',nearest=Infinity;
  let watching=0;
  function drift(p,i,t){
    const a=t*.22+i*1.85,z=roosts[patch]+p.offset+.49*Math.cos(a);
    p.x=riverX(z)+p.side-.18+.62*Math.sin(a);
    p.z=z;p.y=.015+.006*Math.sin(t*2+i);
    return Math.atan2(.62*Math.cos(a)-.49*Math.sin(a)*riverTangent(z),-.49*Math.sin(a));
  }
  const riverTangent=z=>.3996*Math.cos(z*.074+.2)+.273*Math.cos(z*.13);
  function reset(){
    patch=0;clock=0;elapsed=-1;flights=0;allow=false;rest=0;phase='游弋';watching=0;wake.reset();
    poses.forEach((p,i)=>{p.yaw=drift(p,i,clock);});
  }
  reset();
  function update(dt,player,mode,speed){
    const active=Math.abs(player.z-21)<39&&Math.abs(player.x-7)<39;
    root.visible=active;
    if(!active){if(visible)wake.reset();visible=false;allow=true;return;}
    visible=true;clock+=dt;rest+=dt;
    nearest=Infinity;
    for(const p of poses)nearest=Math.min(nearest,Math.hypot(player.x-p.x,player.z-p.z));
    const low=player.y>-.55&&player.y<5.4;
    const brisk=mode==='flying'||mode==='gliding'||speed>3.05;
    const alarm=brisk?7.8:4.35;
    if(nearest>alarm+1.9||!low)allow=true;
    if(elapsed<0&&allow&&low&&nearest<alarm&&rest>1.1){
      elapsed=0;allow=false;flights++;rest=0;
      poses.forEach(p=>{p.fromX=p.x;p.fromZ=p.z;});
      cue('splash',.36);
    }
    if(elapsed>=0)elapsed+=dt;
    const next=1-patch,direction=Math.sign(roosts[next]-roosts[patch]);
    watching=elapsed<0&&nearest<10&&low&&!brisk&&speed<.3?watching+dt:0;
    phase=elapsed<0?(watching>2?'觅食':nearest<8.2&&low?'警觉':'游弋'):
      elapsed<1.5?'踏水':elapsed<6.5?'掠河':'落水';
    poses.forEach((p,i)=>{
      let yaw,lift=0,open=0,flap=0,pitch=0,wakePower=.22,roll=0,dip=0;
      if(elapsed<0)yaw=drift(p,i,clock);
      else{
        const u=T.MathUtils.clamp((elapsed-p.delay)/glideLength,0,1),progress=u*u*(3-2*u);
        const endTime=clock+Math.max(0,glideLength+.7-elapsed),a=endTime*.22+i*1.85;
        const toZ=roosts[next]+p.offset+.49*Math.cos(a);
        p.z=T.MathUtils.lerp(p.fromZ,toZ,progress);
        p.x=riverX(p.z)+T.MathUtils.lerp(p.fromX-riverX(p.fromZ),p.side-.18+.62*Math.sin(a),progress);
        lift=ease(.07,.40,u)*(1-ease(.64,.99,u));
        const stride=1-ease(.09,.19,u),flare=ease(.72,.95,u);
        open=ease(0,.12,u)*(1-ease(.94,1,u));
        const stroke=1-.91*ease(.29,.41,u)*(1-ease(.68,.81,u));
        flap=Math.sin(u*83+i*.32)*stroke*(reduced?.40:.78);
        p.y=.014+lift*(2.0+.24*i)+stride*.10*Math.abs(Math.sin(u*73))+flare*.022;
        yaw=Math.atan2(direction*riverTangent(p.z),direction);
        pitch=-.16*ease(.04,.16,u)*(1-ease(.24,.35,u))-.12*flare;
        roll=.11*lift*Math.sin(p.z*.16+i*.14);
        wakePower=lift>.04?0:.32;
      }
      p.yaw+=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw))*(1-Math.exp(-dt*(elapsed<0?2.8:4)));
      if(elapsed<0&&phase!=='警觉'){
        dip=ease(.28,.89,Math.sin(clock*1.14+i*1.35));
        pitch+=dip*.79;
      }
      const size=1.07+.07*(i%3);
      base.position.set(p.x,p.y,p.z);base.rotation.set(pitch,p.yaw,roll,'YXZ');
      base.scale.setScalar(size);base.updateMatrix();
      bodies[i%2].setMatrixAt(Math.floor(i/2),base.matrix);
      joint.position.set(0,.315,.17);
      const look=phase==='警觉'?.49*Math.sin(Math.atan2(player.x-p.x,player.z-p.z)-p.yaw):.16*Math.sin(clock*1.4+i);
      joint.rotation.set(dip*.92,look*(1-open),0);joint.scale.setScalar(1);joint.updateMatrix();joint.matrix.premultiply(base.matrix);
      heads[i%2].setMatrixAt(Math.floor(i/2),joint.matrix);
      for(let s=0;s<2;s++){
        const sign=s?1:-1;
        joint.position.set(sign*.074,.064,-.075);
        const run=phase==='踏水'||phase==='落水';
        joint.rotation.set(lift*1.06+(run?.85:.32)*Math.sin(clock*(run?17:3)+i+Math.PI*s),0,sign*.14);
        joint.scale.setScalar(1);joint.updateMatrix();joint.matrix.premultiply(base.matrix);
        feet.setMatrixAt(i*2+s,joint.matrix);
        joint.position.set(sign*.116,.236,.04);
        joint.rotation.set(.02,sign*(1-open)*1.36,sign*(.08+open*(.17+flap)),'YXZ');
        joint.scale.set(.61+.39*open,1,1);joint.updateMatrix();joint.matrix.premultiply(base.matrix);
        wingBatches[s][0].setMatrixAt(i,joint.matrix);
        hand.position.set(sign*.29,0,.035);
        hand.rotation.set(0,sign*(1-open)*.09,sign*(open*(-.09+flap*.22)));
        hand.scale.set(1,1,1);hand.updateMatrix();hand.matrix.premultiply(joint.matrix);
        wingBatches[s][1].setMatrixAt(i,hand.matrix);
      }
      wake.write(i,dt,p.x-Math.sin(p.yaw)*.28,p.z-Math.cos(p.yaw)*.28,p.yaw,wakePower,.19);
    });
    for(const m of bodies)m.instanceMatrix.needsUpdate=true;
    for(const m of heads)m.instanceMatrix.needsUpdate=true;
    feet.instanceMatrix.needsUpdate=true;
    for(const wings of wingBatches)for(const m of wings)m.instanceMatrix.needsUpdate=true;
    wake.flush();
    if(elapsed>glideLength+.7){patch=next;elapsed=-1;rest=0;allow=false;cue('water',.2);}
  }
  return {update,reset,dispose(){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});},
    snapshot:()=>({visible,phase,flights,pool:patch,nearest:+nearest.toFixed(2),
      center:[+poses[1].x.toFixed(2),+poses[1].y.toFixed(2),+poses[1].z.toFixed(2)]})};
}
