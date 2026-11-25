import * as T from 'three';
import {sites,riverWidth,riverX,ground} from './geography.js';
import {matchObservation} from './observations.js';
import {postOffsets,postWidth} from './post-layout.js';

export function createFieldReading(scene,onObservation,world) {
  const root=new T.Group(),image=new T.Group();scene.add(root);root.add(image);image.visible=false;
  const lineMat=new T.LineBasicMaterial({color:0x9ae3cb,transparent:true,opacity:.78,depthWrite:false});
  const strips=[];
  // Each strip represents one short reach, so the reconstruction stops in the fog.
  for(let z=-68;z<49;z+=8){
    const points=[];
    for(const sign of [-1,1])for(let t=0;t<8;t+=.5){
      function edge(s){
        const x=riverX(s)+sign*(riverWidth(s)+1.85)+Math.sin(s*.08)*1.4;
        return new T.Vector3(x,Math.max(.08,ground(x,s)+.11),s);
      }
      points.push(edge(z+t),edge(z+t+.49));
    }
    const line=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),lineMat);image.add(line);strips.push({line,z:z+4});
  }
  const log=new T.Vector3(riverX(20),0,20);log.y=ground(log.x,log.z);
  const bark=new T.TextureLoader().load('/assets/environment/bark_brown_02_diff_1k.webp');bark.colorSpace=T.SRGBColorSpace;
  const wood=new T.MeshStandardMaterial({color:0x777365,map:bark,roughness:.84});
  const driftwood=new T.Group();driftwood.position.copy(log);driftwood.rotation.y=-.43;
  const logSolids=[];let timberActive=false;
  driftwood.updateMatrixWorld(true);
  const between=(a,b,base,tip)=>{
    const v=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(tip,base,v.length(),11),wood);
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());driftwood.add(m);
    const parts=Math.ceil(v.length()/.25);
    for(let i=0;i<parts;i++){
      const u=(i+.5)/parts,p=a.clone().lerp(b,u).applyMatrix4(driftwood.matrixWorld),r=T.MathUtils.lerp(base,tip,u);
      logSolids.push({x:p.x,z:p.z,y:p.y-r,height:r*2,radius:r+.072,hint:'河底的沉木横在前面。沿木身游过，或轻按空格从上方越过。'});
    }
  };
  between(new T.Vector3(-1.9,.28,0),new T.Vector3(1.8,.36,.12),.26,.13);
  between(new T.Vector3(-.48,.39,.03),new T.Vector3(.27,.61,-.73),.11,.031);
  root.add(driftwood);
  const [sx,sz]=sites[8],cx=sx+postOffsets[4][0],cz=sz+postOffsets[4][1],posts=new T.Vector3(cx,ground(cx,cz),cz);
  const poles=new T.Group(),timber=new T.MeshBasicMaterial({color:0xe8bb83,transparent:true,opacity:.19,depthWrite:false});
  const column=new T.BoxGeometry(postWidth,1,postWidth),heights=[];
  for(let k=0;k<postOffsets.length;k++){
    const x=sx+postOffsets[k][0],z=sz+postOffsets[k][1],base=ground(x,z),height=3.5+(k%3===1?.6:0);
    const m=new T.Mesh(column,timber);m.position.set(x,base,z);poles.add(m);heights.push({m,base,height});
  }
  root.add(poles);
  let tracing=false,lastId=null,held=0,rise=0;
  function toggle(count){
    if(!count)return false;tracing=!tracing;return tracing;
  }
  function update(dt,count,state,position) {
    image.visible=tracing&&count>=1;
    if(image.visible)for(const s of strips)s.line.visible=Math.abs(s.z-position.z)<23;
    driftwood.visible=count>=2&&Math.abs(log.z-position.z)<22;
    if(world&&timberActive!==driftwood.visible){
      timberActive=driftwood.visible;
      if(timberActive)world.colliders.push(...logSolids);
      else for(const part of logSolids){const i=world.colliders.indexOf(part);if(i>=0)world.colliders.splice(i,1);}
      world.invalidateSolids();
    }
    const warm=count>=8&&tracing&&Math.hypot(position.x-posts.x,position.z-posts.z)<10;
    rise=T.MathUtils.damp(rise,warm?1:0,3,dt);poles.visible=rise>.025;
    if(poles.visible)for(const {m,base,height} of heights){m.scale.y=rise*height;m.position.y=base+m.scale.y*.5;}
    const id=matchObservation(count,state,position,tracing,{log,posts});
    if(id!==lastId){lastId=id;held=0;}
    if(id&&held<.55){held+=dt;if(held>=.55)onObservation(id);}
  }
  return {toggle,update,get active(){return tracing;},reset(){tracing=false;held=0;lastId=null;}};
}
