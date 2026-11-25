import * as T from 'three';
import { seeded, V, mat } from './fieldwork-studio.js';

// Each bough follows a crooked centreline. Child branches and green, trifoliate
// shoots attach at points on that line while their parent is lengthening.
export function growCrown(studio) {
  const {scene,texture}=studio,rng=seeded(718),boughs=[],sprays=[],up=V(0,1,0),dummy=new T.Object3D();
  const barkMap=texture('/assets/environment/bark_brown_02_diff_1k.webp');
  const bark=studio.software?new T.MeshLambertMaterial({color:0xf0ead7,map:barkMap}):mat(0xe4dfce,.88,{map:barkMap,normalMap:texture('/assets/environment/bark_brown_02_nor_gl_1k.webp','normal'),normalScale:new T.Vector2(.66,.66)});
  const leafStyle={color:0xb3e6bd,map:texture('/assets/v6/canopy/island-leaf-color.webp'),side:T.DoubleSide,alphaTest:.4};
  const leafMat=studio.software?new T.MeshLambertMaterial(leafStyle):mat(0xffffff,.8,leafStyle);
  function fork(start,direction,length,radius,level,delay){
    const end=start.clone().addScaledVector(direction,length),side=V(direction.z,0,-direction.x).normalize();
    const curve=new T.CatmullRomCurve3([start,start.clone().lerp(end,.32).addScaledVector(side,length*(rng()-.5)*.27),start.clone().lerp(end,.71).addScaledVector(side,length*(rng()-.5)*.28),end]);
    const segments=level<3?6:3;
    for(let k=0;k<segments;k++){
      const t=k/segments,p=curve.getPoint(t),q=curve.getPoint((k+1)/segments),axis=q.clone().sub(p);
      boughs.push({p,vec:axis.clone().normalize(),length:axis.length()*1.045,radius:radius*(1-.48*t),time:delay+t*.11,arc:t*length});
    }
    if(level>=3){
      const count=level===3?5:studio.software?7:10;
      for(let k=0;k<count;k++){
        const t=(k+.3+rng()*.4)/count,anchor=curve.getPoint(t);
        const azi=Math.atan2(direction.x,direction.z)+(k%2?1:-1)*(.5+rng()*1.0);
        const stem=.10+rng()*.19;
        for(const spread of [-1,0,1]){
          const a=azi+spread*(.54+rng()*.23),size=(.19+rng()*.16)*(spread?.84:1)*(studio.software?1.16:1);
          const base=anchor.clone().add(V(Math.sin(azi)*stem,.04+rng()*.105,Math.cos(azi)*stem));
          sprays.push({base,a,size,tilt:-.33+rng()*.73,roll:(rng()-.5)*1.28,time:delay+.13+rng()*.10,color:new T.Color().setRGB(.62+rng()*.34,.72+rng()*.26,.64+rng()*.3)});
        }
      }
    }
    if(level===4)return;
    const az=Math.atan2(direction.x,direction.z),count=level===0?(studio.software?5:6):level<3&&!(studio.software&&level===2)?3:2;
    for(let k=0;k<count;k++){
      const a=az+(level===0?k/count*Math.PI*2:(k-(count-1)/2)*1.02)+(rng()-.5)*.82;
      const horizontal=.75+rng()*.86;
      const vertical=level<2?.37+rng()*.95:.17+rng()*.99;
      const branch=V(Math.sin(a)*horizontal,vertical,Math.cos(a)*horizontal).normalize();
      const t=level===0?.47+k*.105:.46+k*(.53/count)+rng()*.11;
      fork(curve.getPoint(t),branch,length*(level===0?.80:.58+rng()*.17),radius*(.43+rng()*.16),level+1,delay+.12+rng()*.035);
    }
  }
  fork(V(0,.28,0),V(.10,1,-.07).normalize(),3.68,.59,0,0);
  const wood=new T.InstancedMesh(new T.CylinderGeometry(.92,1,1,12,1,true),bark,boughs.length);scene.add(wood);
  // The second scanned blade in the atlas has an intact edge and central vein.
  const leaf=new T.PlaneGeometry(.84,1.67,studio.software?1:3,studio.software?2:5),verts=leaf.attributes.position,uv=leaf.attributes.uv;
  for(let i=0;i<verts.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    verts.setXYZ(i,verts.getX(i),Math.sin(v*Math.PI)*.16-Math.abs(u-.5)*.14-v*v*.065,v*1.67);
    uv.setXY(i,.161+u*.177,.593+v*.394);
  }leaf.computeVertexNormals();
  const canopy=new T.InstancedMesh(leaf,leafMat,sprays.length);scene.add(canopy);
  wood.frustumCulled=canopy.frustumCulled=false;
  // Matrices stay fixed. Two shared vertex uniforms grow all shoots and blades
  // without uploading thousands of transforms on every animation frame.
  const progress={value:0};
  function animate(target,data,trunk){
    target.geometry.setAttribute('growthStart',new T.InstancedBufferAttribute(Float32Array.from(data,p=>p.time),1));
    if(trunk)target.geometry.setAttribute('barkSpan',new T.InstancedBufferAttribute(Float32Array.from(data.flatMap(p=>[p.arc*.8,p.length*.8])),2));
    target.material.onBeforeCompile=program=>{
      program.uniforms.progress=progress;
      program.vertexShader=program.vertexShader.replace('#include <common>','#include <common>\nuniform float progress;\nattribute float growthStart;'+(trunk?'\nattribute vec2 barkSpan;':''))
        .replace('#include <begin_vertex>','#include <begin_vertex>\nfloat amount=smoothstep(growthStart,growthStart+'+(trunk?'0.10':'0.16')+',progress);\n'+(trunk?'transformed.xz*=amount;transformed.y=(transformed.y+0.5)*amount-0.5;':'transformed*=amount;'));
      if(trunk)program.vertexShader=program.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.y=barkSpan.x+vMapUv.y*barkSpan.y;\n#ifdef USE_NORMALMAP\nvNormalMapUv.y=barkSpan.x+vNormalMapUv.y*barkSpan.y;\n#endif');
    };
    target.material.customProgramCacheKey=()=>trunk?'jinsha-bough-arclength':'jinsha-three-leaf-growth';
  }
  for(const [i,p] of boughs.entries()){
    dummy.position.copy(p.p).addScaledVector(p.vec,p.length/2);
    dummy.quaternion.setFromUnitVectors(up,p.vec);dummy.scale.set(p.radius,p.length,p.radius);dummy.updateMatrix();wood.setMatrixAt(i,dummy.matrix);
  }
  for(const [i,p] of sprays.entries()){
    dummy.position.copy(p.base);dummy.rotation.set(p.tilt,p.a,p.roll,'YXZ');dummy.scale.setScalar(p.size);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);canopy.setColorAt(i,p.color);
  }
  animate(wood,boughs,true);animate(canopy,sprays,false);
  return t=>{progress.value=t;};
}
