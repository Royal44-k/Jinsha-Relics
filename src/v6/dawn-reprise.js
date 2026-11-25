import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2;
const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);

function goldenBird(){
 const pieces=[];
 function add(g,wing=0){if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}g.deleteAttribute('uv');g.setAttribute('aWing',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(wing),1));pieces.push(g);}
 const body=new T.SphereGeometry(1,14,9);body.scale(.1,.12,.34);add(body);
 const head=new T.SphereGeometry(.095,12,8);head.translate(0,.08,-.32);add(head);
 const beak=new T.ConeGeometry(.035,.18,7);beak.rotateX(-Math.PI/2);beak.translate(0,.06,-.46);add(beak);
 for(const side of [-1,1])for(let j=0;j<9;j++){
  const points=[],indices=[],len=.45+j*.055,z=-.19+j*.054;
  for(let k=0;k<8;k++){const t=k/7,width=Math.sin(t*Math.PI)**.65*.055;points.push(side*(.06+len*t),.06+Math.sin(t*Math.PI)*.03,z*t-width,side*(.06+len*t),.06+Math.sin(t*Math.PI)*.03,z*t+width);if(k<7){const n=k*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const feather=new T.BufferGeometry();feather.setAttribute('position',new T.Float32BufferAttribute(points,3));feather.setIndex(indices);feather.computeVertexNormals();add(feather,side);
 }
 for(let j=0;j<5;j++){const tail=new T.SphereGeometry(1,6,4);tail.scale(.026,.012,.2);tail.rotateY((j-2)*.12);tail.translate((j-2)*.028,-.025,.38);add(tail);}
 const result=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());return result;
}

/** Four original light-birds answer the four-bird motif; no museum reconstruction. */
export function createDawnReprise(scene){
 const group=new T.Group();group.name='V6 · 四鸟归日';group.visible=false;scene.add(group);
 const clock={value:0},reveal={value:0};
 const material=new T.MeshStandardMaterial({color:'#f7d795',emissive:'#edac4b',emissiveIntensity:.85,metalness:.72,roughness:.31,side:T.DoubleSide,transparent:true,opacity:0});
 material.onBeforeCompile=s=>{s.uniforms.uDawnTime=clock;s.vertexShader='uniform float uDawnTime;attribute float aWing;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float flap=sin(uDawnTime*5.3+instanceMatrix[3].y)*.32*aWing;float ca=cos(flap),sa=sin(flap);transformed.xy=mat2(ca,-sa,sa,ca)*(transformed.xy-vec2(aWing*.08,0.))+vec2(aWing*.08,0.);`);};material.customProgramCacheKey=()=> 'v6-golden-bird';
 const geometry=goldenBird(),birds=new T.InstancedMesh(geometry,material,4);birds.frustumCulled=false;group.add(birds);
 const sparkGeometry=new T.BufferGeometry(),sparkPositions=new Float32Array(144*3);sparkGeometry.setAttribute('position',new T.BufferAttribute(sparkPositions,3));
 const sparkMaterial=new T.PointsMaterial({color:'#ffda87',size:.045,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
 const sparks=new T.Points(sparkGeometry,sparkMaterial);sparks.frustumCulled=false;group.add(sparks);
 const haloGeometry=new T.RingGeometry(2.25,2.263,144),haloMaterial=new T.MeshBasicMaterial({color:'#edcd8a',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}),halo=new T.Mesh(haloGeometry,haloMaterial);group.add(halo);
 const dummy=new T.Object3D(),center=V(),origin=V(),normal=V(),right=V(),up=V(0,1,0),tangent=V(),look=V(),birdPosition=V();
 let age=-1,wasComplete=false,restored=false;
 // Compile alone does not upload these hidden geometries. The loading renderer
 // can draw them once without advancing the finale or affecting the depth buffer.
 function prepareWarmup(){
  const visible=group.visible,renderables=[birds,sparks,halo],states=renderables.map(object=>({object,visible:object.visible,frustumCulled:object.frustumCulled,opacity:object.material.opacity,depthWrite:object.material.depthWrite})),count=birds.count;
  group.visible=true;birds.count=4;
  for(const object of renderables){object.visible=true;object.frustumCulled=false;object.material.opacity=0;object.material.depthWrite=false;}
  let restoredState=false;
  return ()=>{
   if(restoredState)return;restoredState=true;group.visible=visible;birds.count=count;
   for(const state of states){const object=state.object;object.visible=state.visible;object.frustumCulled=state.frustumCulled;object.material.opacity=state.opacity;object.material.depthWrite=state.depthWrite;}
  };
 }
 function reset(done=false){age=done?12:-1;wasComplete=done;restored=done;group.visible=false;}
 function update(dt,time,{adventure,position,visible=true,reduced=false}={}){
  if(!adventure?.finalTarget)return;
  const done=!!adventure.completed;if(done&&!wasComplete)age=0;wasComplete=done;
  if(!done){age=-1;group.visible=false;return;}
  if(dt>0)age+=Math.min(.05,dt);center.fromArray(adventure.finalTarget);origin.fromArray(adventure.stages.find(s=>s.id==='sun').position);
  group.visible=visible&&position.distanceTo(center)<55;if(!group.visible)return;
  normal.copy(center).sub(origin).setY(0).normalize();right.crossVectors(normal,up).normalize();clock.value=reduced?0:time;
  const progress=reduced||restored?1:smooth(.2,5.2,age),opacity=reduced||restored?1:smooth(.15,1.6,age);reveal.value=progress;
  material.opacity=opacity;material.emissiveIntensity=.65+progress*.5;
  for(let i=0;i<4;i++){
   const phase=i*TAU/4+(reduced?0:time*.24),radius=T.MathUtils.lerp(7,2.9,progress);
   birdPosition.copy(center).addScaledVector(right,Math.cos(phase)*radius).addScaledVector(up,Math.sin(phase)*radius*(.2+.8*progress)+1.1*(1-progress)).addScaledVector(normal,Math.sin(phase*2)*.35);
   tangent.copy(right).multiplyScalar(-Math.sin(phase)).addScaledVector(up,Math.cos(phase));look.copy(birdPosition).add(tangent);dummy.position.copy(birdPosition);dummy.up.copy(normal).negate();dummy.lookAt(look);dummy.rotateY(Math.PI);dummy.scale.setScalar(.9+progress*.15);dummy.updateMatrix();birds.setMatrixAt(i,dummy.matrix);
  }birds.instanceMatrix.needsUpdate=true;
  for(let i=0;i<144;i++){const arm=i%4,t=i/144,phase=arm*TAU/4+(reduced?0:time*.24)-t*.85,radius=T.MathUtils.lerp(7,2.9,progress)+Math.sin(i*2.3)*.1;sparkPositions[i*3]=center.x+right.x*Math.cos(phase)*radius;sparkPositions[i*3+1]=center.y+Math.sin(phase)*radius*(.2+.8*progress)+1.1*(1-progress)+Math.sin(i*1.7)*.08;sparkPositions[i*3+2]=center.z+right.z*Math.cos(phase)*radius;}
  sparkGeometry.attributes.position.needsUpdate=true;sparkMaterial.opacity=opacity*(.2+.45*(1-progress));
  halo.position.copy(center).addScaledVector(normal,-.12);halo.quaternion.setFromUnitVectors(V(0,0,1),normal);haloMaterial.opacity=opacity*progress*.35;
 }
 return {group,update,reset,prepareWarmup,snapshot:()=>({active:group.visible,age,completed:wasComplete,reveal:reveal.value,birds:4}),dispose(){group.removeFromParent();for(const v of [geometry,material,sparkGeometry,sparkMaterial,haloGeometry,haloMaterial])v.dispose();}};
}
