import * as T from 'three';
import {ground} from './geography.js';
import {createWakeStrip} from '../v16/river-wake.js';

export function createGroundContact(scene,world){
  const sheet=document.createElement('canvas');sheet.width=sheet.height=96;
  const c=sheet.getContext('2d'),wash=c.createRadialGradient(48,48,3,48,48,48);
  wash.addColorStop(0,'rgba(22,21,16,.85)');wash.addColorStop(.36,'rgba(28,25,18,.48)');wash.addColorStop(1,'rgba(36,32,23,0)');
  c.fillStyle=wash;c.fillRect(0,0,96,96);
  const texture=new T.CanvasTexture(sheet);texture.colorSpace=T.SRGBColorSpace;
  const wake=createWakeStrip(scene,1,13),previous=new T.Vector3();
  let first=true,wakeYaw=0;
  const plane=new T.PlaneGeometry(1,1);plane.rotateX(-Math.PI/2);
  const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const blob=new T.Mesh(plane,mat);blob.renderOrder=1;scene.add(blob);
  // Four soft lobes meet under the toe pads. The broad solar shadow alone
  // separates from the feet in a low side view and makes a standing bird float.
  const pads=document.createElement('canvas');pads.width=pads.height=96;
  const pc=pads.getContext('2d');
  function pad(x,y,rx,ry,angle){
    pc.save();pc.translate(x,y);pc.rotate(angle);pc.scale(rx,ry);
    const shade=pc.createRadialGradient(0,0,0,0,0,1);
    shade.addColorStop(0,'rgba(34,24,16,.68)');shade.addColorStop(.43,'rgba(38,28,18,.40)');shade.addColorStop(1,'rgba(38,28,18,0)');
    pc.fillStyle=shade;pc.fillRect(-1,-1,2,2);pc.restore();
  }
  pad(48,51,19,13,0);pad(32,37,8,21,-.56);pad(48,29,8,24,0);pad(65,37,8,20,.50);pad(47,68,7,16,.18);
  const padMap=new T.CanvasTexture(pads);padMap.colorSpace=T.SRGBColorSpace;
  const contactMat=new T.MeshBasicMaterial({map:padMap,transparent:true,opacity:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const toes=new T.InstancedMesh(plane,contactMat,2);toes.frustumCulled=false;toes.renderOrder=2;scene.add(toes);
  const padPose=new T.Object3D(),heading=new T.Quaternion();
  const rings=[],geo=new T.RingGeometry(.94,1,56);geo.rotateX(-Math.PI/2);
  for(let i=0;i<5;i++){
    const m=new T.MeshBasicMaterial({color:0xe2e8c7,transparent:true,opacity:0,depthWrite:false});
    const ring=new T.Mesh(geo,m);ring.visible=false;ring.renderOrder=3;scene.add(ring);rings.push({ring,t:1,duration:1,impact:0});
  }
  let head=0,swim=0;const up=new T.Vector3(0,1,0),normal=new T.Vector3();
  function ripple(position,strength){
    const effect=rings[head++%rings.length];effect.t=0;effect.duration=.78+strength*.4;effect.impact=strength;
    effect.ring.position.set(position.x,.027,position.z);effect.ring.visible=true;
  }
  function update(dt,pos,state,feet,yaw){
    const sample=world.sample(pos),height=sample.groundHeight,above=Math.max(0,pos.y-height);
    const dx=pos.x-previous.x,dz=pos.z-previous.z,travel=Math.hypot(dx,dz);
    if(!first&&travel>.0005)wakeYaw=Math.atan2(dx,dz);
    const displacement=!first&&travel<.7&&state.mode==='swimming'?Math.min(1,travel/Math.max(.001,dt)*.47):0;
    wake.write(0,dt,pos.x-.23*Math.sin(wakeYaw),pos.z-.23*Math.cos(wakeYaw),wakeYaw,.52*displacement,.34);
    wake.flush();previous.copy(pos);first=false;
    blob.visible=height>.03&&above<4;
    if(blob.visible){
      blob.position.set(pos.x,height+.023,pos.z);
      const radius=.68+above*.39;blob.scale.set(1.14*radius,1,1.47*radius);mat.opacity=(state.mode==='perched'?.28:.5)/(1+above*.85);
      if(Math.abs(height-ground(pos.x,pos.z))<.10){
        normal.set(ground(pos.x-.1,pos.z)-ground(pos.x+.1,pos.z),.2,ground(pos.x,pos.z-.1)-ground(pos.x,pos.z+.1)).normalize();
        blob.quaternion.setFromUnitVectors(up,normal);
      }else blob.quaternion.identity();
    }
    let planted=0;
    if(state.mode==='grounded'){
      heading.setFromAxisAngle(up,yaw);
      for(const foot of feet){
        if(!foot.planted)continue;
        const p=foot.position,height=world.sample(p).groundHeight;
        if(height<.018||Math.abs(height-p.y)>.085)continue;
        const terrain=world.terrainSurface;
        if(Math.abs(terrain.heightAt(p.x,p.z)-height)<.018)terrain.contactNormal(p.x,p.z,normal);
        else normal.copy(up);
        padPose.position.set(p.x,height+.003,p.z);
        padPose.quaternion.setFromUnitVectors(up,normal).multiply(heading);
        padPose.scale.set(.225,1,.31);padPose.updateMatrix();
        toes.setMatrixAt(planted++,padPose.matrix);
      }
    }
    toes.count=planted;toes.visible=planted>0;if(planted)toes.instanceMatrix.needsUpdate=true;
    if(state.mode==='swimming'){swim+=dt*Math.max(.4,state.speed);if(swim>.77){swim=0;ripple(pos,.5);}}
    else swim=0;
    for(const e of rings){if(!e.ring.visible)continue;e.t+=dt;
      const u=Math.min(1,e.t/e.duration),s=.17+u*(.65+e.impact*.75);
      e.ring.scale.set(s,1,s*.86);e.ring.material.opacity=.33*(1-u)**1.4;e.ring.visible=u<1;}
  }
  return {update,ripple};
}
