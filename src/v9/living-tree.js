import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRootGeometry} from '../v8/profiled-tubes.js';
import {applyThinLeafLight} from './thin-leaf.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
const ease=(n,a,b)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
export const TREE_REBIRTH_SECONDS=18;
export function treeLifePose(age,lights=0){
 const p=clamp(age/TREE_REBIRTH_SECONDS,0,1),rise=ease(p,.12,.72),crown=ease(p,.38,.96);
 return {progress:p,trunkScale:.265+.735*rise,branchScale:.35+.65*ease(p,.2,.78),leafScale:crown,green:ease(p,.22,.9),height:3.95+10.95*rise,phase:lights<3?(lights?'sprouting':'dormant'):p<.22?'awakening':p<.64?'rising':p<.96?'unfurling':'mature'};
}
export function createLivingTree({parent,bark,canopy,completed=false,lights=0,onEvent=()=>{}}){
 const group=new T.Group();group.name='古根复苏 · 实体绿叶与分叉枝干';parent.add(group);
 const ownedGeometries=[],ownedMaterials=[],branches=[],shoots=[],dummy=new T.Object3D(),leafOpen={value:completed?1:0};let perchLocal=null,perchTangent=null;
 let age=completed?TREE_REBIRTH_SECONDS:0,started=completed,previousLights=lights,replaying=false,lastPhase=null,windTime=0;
 const wood=bark.clone();wood.color.set(0x918c79);wood.roughness=.94;wood.side=T.DoubleSide;ownedMaterials.push(wood);
 const greenWood=bark.clone();greenWood.color.set(0x697953);greenWood.roughness=.86;ownedMaterials.push(greenWood);
 const atlas=!!canopy?.map,leafMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.84,metalness:0,side:T.DoubleSide,vertexColors:false,emissiveIntensity:0,map:canopy?.map||null,normalMap:canopy?.normalMap||null,normalScale:new T.Vector2(.12,.12),alphaTest:atlas?.28:0});ownedMaterials.push(leafMaterial);
 function configureLeaf(material,opening){material.onBeforeCompile=shader=>{shader.uniforms.uTreeLeafOpen=opening;shader.vertexShader='uniform float uTreeLeafOpen;\nvarying vec2 vTreeLeaf;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvTreeLeaf='+ (atlas?'(uv-vec2(175.0/1024.0,1.0-417.0/1024.0))/vec2(172.0/1024.0,401.0/1024.0)':'uv')+';').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed*=uTreeLeafOpen;');shader.fragmentShader='varying vec2 vTreeLeaf;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float spine=1.-smoothstep(.006,.021,abs(vTreeLeaf.x-.5));
 float rib=1.-smoothstep(.025,.11,abs(fract(vTreeLeaf.y*7.0+abs(vTreeLeaf.x-.5)*2.4)-.5));
 diffuseColor.rgb*=.89+.13*sin(vTreeLeaf.y*3.14159);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.24,1.15,.87),spine*.45+rib*.10);
 `);};material.customProgramCacheKey=()=> 'v9-curved-leaf-veins';applyThinLeafLight(material);}configureLeaf(leafMaterial,leafOpen);
 const shootLeafMaterial=leafMaterial.clone();configureLeaf(shootLeafMaterial,{value:1});ownedMaterials.push(shootLeafMaterial);
 const leafDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide,map:canopy?.map||null,alphaTest:atlas?.28:0});leafDepth.onBeforeCompile=shader=>{shader.uniforms.uTreeLeafOpen=leafOpen;shader.vertexShader='uniform float uTreeLeafOpen;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed*=uTreeLeafOpen;');};leafDepth.customProgramCacheKey=()=> 'v9-growing-leaf-shadow';ownedMaterials.push(leafDepth);
 function addMesh(geometry,material,target=group){ownedGeometries.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;target.add(mesh);return mesh;}
 function tube(points,radii){const curve=new T.CatmullRomCurve3(points);if(Math.max(...radii)>=.065){const g=createRootGeometry(points,radii),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)/3*curve.getLength()*.55);return g;}const steps=8,sides=5,g=new T.TubeGeometry(curve,steps,.02,sides,false),p=g.attributes.position,uv=g.attributes.uv,point=V(),centre=V();for(let row=0;row<=steps;row++){const t=row/steps,u=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(u)),radius=T.MathUtils.lerp(radii[i],radii[i+1],u-i);curve.getPointAt(t,centre);for(let side=0;side<=sides;side++){const index=row*(sides+1)+side;point.fromBufferAttribute(p,index).sub(centre).multiplyScalar(radius/.02).add(centre);p.setXYZ(index,point.x,point.y,point.z);uv.setXY(index,side/sides,t*curve.getLength()*.55);}}g.computeVertexNormals();return g;}
 function restingBranch(curve){const rows=80,sides=20,g=new T.TubeGeometry(curve,rows,.29,sides,false),p=g.attributes.position,uv=g.attributes.uv,point=V(),centre=V(),radii=[.42,.35,.25,.015];for(let row=0;row<=rows;row++){const u=row/rows,t=curve.getUtoTmapping(u),k=Math.min(2,Math.floor(t*3)),natural=T.MathUtils.lerp(radii[k],radii[k+1],t*3-k),smoothing=ease(t,.38,.47)*(1-ease(t,.62,.72)),radius=T.MathUtils.lerp(natural,.29,smoothing);curve.getPointAt(u,centre);for(let side=0;side<=sides;side++){const index=row*(sides+1)+side;point.fromBufferAttribute(p,index).sub(centre).multiplyScalar(radius/.29).add(centre);p.setXYZ(index,point.x,point.y,point.z);uv.setXY(index,side/sides,u*curve.getLength()*.55);}}g.computeVertexNormals();return g;}
 const trunkPoints=[V(0,0,0),V(-.5,2.7,.22),V(.38,5.8,-.15),V(-.25,9,.55),V(-.72,12.2,.28),V(-.3,14.9,.02)],trunkCurve=new T.CatmullRomCurve3(trunkPoints);
 const trunk=addMesh(tube(trunkPoints,[.64,.49,.37,.26,.13,.012]),wood);
 trunk.name='生长主干';trunk.userData.cameraSubject='rebirth-root';
 // Cupped leaf surfaces retain curvature up close; the borrowed photographic
 // atlas supplies the fine serration and veins without another texture download.
 const leafRows=6,positions=[],uvs=[],indices=[];for(let i=0;i<=leafRows;i++){const t=i/leafRows,width=atlas?.235:Math.pow(Math.sin(Math.PI*t),.83)*.235;for(let j=0;j<3;j++){const side=j-1;positions.push(side*width,t,.045*Math.sin(t*Math.PI)+Math.abs(side)*.026*Math.sin(t*Math.PI)+side*.012*t*t);uvs.push(atlas?(175+j/2*172)/1024:j/2,atlas?1-(417-t*401)/1024:t);if(i<leafRows&&j<2){const a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}}}
 const leafGeometry=new T.BufferGeometry();leafGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));leafGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));leafGeometry.setIndex(indices);leafGeometry.computeVertexNormals();ownedGeometries.push(leafGeometry);
 const tint=new T.Color(),palette=atlas?[0xbbd2ae,0xcbdcb7,0xd4ddb9,0xb6cfa6,0xa7c299]:[0x3b6c3e,0x4f7e43,0x5a8847,0x719553,0x315f36];
 function leafCloud(parent,leaves,material=leafMaterial){const mesh=new T.InstancedMesh(leafGeometry,material,leaves.length);mesh.name=material===leafMaterial?'Rebirth tree canopy':'Rebirth tree young leaves';mesh.userData.foliageClearance=true;if(material===leafMaterial)mesh.customDepthMaterial=leafDepth;for(let i=0;i<leaves.length;i++){const l=leaves[i];dummy.position.copy(l.p);dummy.rotation.set(l.rx,l.ry,l.rz);dummy.scale.set(l.size*(.76+(i%4)*.1),l.size,l.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint.set(palette[i%palette.length]));}mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 const births=[5.88,6.7,7.1,6.8,8.5,9,9.6,10.8,11.6],lengths=[6,5.7,4.8,6.4,5.2,6.2,4.9,4.5,3.5],rises=[2.05,3.4,4.2,2.7,3.7,2.1,2.8,1.9,1.7];
 const noise=n=>{const v=Math.sin(n*127.1+19.83)*43758.5453;return v-Math.floor(v);};
 for(let i=0;i<9;i++){
  const a=i*2.399963,birth=births[i],length=lengths[i],rise=rises[i],branchGroup=new T.Group();branchGroup.rotation.y=a;group.add(branchGroup);let lo=0,hi=1;for(let n=0;n<14;n++){const mid=(lo+hi)/2;if(trunkCurve.getPoint(mid).y<birth)lo=mid;else hi=mid;}const attach=trunkCurve.getPoint((lo+hi)/2);
  // Keep the tested landing branch invariant; the remaining crown is asymmetric
  // in rise, spread and bow rather than nine identical radial shelves.
  const branchPoints=i===0?[V(),V(length*.27,.65,0),V(length*.64,1.6,.35),V(length,2.05,.12)]:[V(),V(length*.25,rise*.18,(i%2?-.18:.24)),V(length*.63,rise*.64,(i%3-1)*.62),V(length,rise,(i%2?-.38:.5))];
  const bcurve=new T.CatmullRomCurve3(branchPoints),parts=[i===0?restingBranch(bcurve):tube(branchPoints,[.22-i*.012,.15-i*.006,.075,.009])],leaves=[];
  if(i===0){perchLocal=bcurve.getPoint(.53).add(attach).add(V(0,.29,0));perchTangent=bcurve.getTangent(.53);}
  for(let j=0;j<8;j++){
   const seed=i*71+j*11,start=bcurve.getPoint(.22+j*.1),side=j%2?1:-1,len=1.35+noise(seed+1)*1.2,end=start.clone().add(V(.35+noise(seed+2)*.75,-.25+noise(seed+3)*1.65,side*len));
   const mid=start.clone().lerp(end,.5).add(V(-.12,.18+noise(seed+4)*.2,side*.16));parts.push(tube([start,mid,end],[.055,.032,.003]));
   for(let k=0;k<4;k++){
    const stem=start.clone().lerp(end,.24+k*.21),fan=(k%2?1:-1),tip=stem.clone().add(V(fan*(.5+noise(seed+k+5)*.5),-.2+noise(seed+k+6)*.85,side*(.3+noise(seed+k+7)*.35)));parts.push(tube([stem,stem.clone().lerp(tip,.5).add(V(0,.08,0)),tip],[.018,.011,.001]));
    for(let n=0;n<9;n++)for(const face of [-1,1]){const t=.12+n*.095,p=stem.clone().lerp(tip,t).add(V(face*.045,.012,0)),leafSeed=seed+k*29+n*5+face;
     const relative=p.clone().applyAxisAngle(V(0,1,0),a).add(attach).sub(perchLocal).sub(V(0,.65,0)),radial=Math.hypot(relative.x,relative.z);
     // Leave a breathable pocket around the whole perched body across every
     // branch group, not just an empty point at the first branch's foot grip.
     if(radial*radial/(1.35*1.35)+relative.y*relative.y/(1.6*1.6)<1)continue;
     const nearby=radial<3.2&&Math.abs(relative.y)<2;if(nearby&&face>0&&noise(leafSeed+8)>.35)continue;
     leaves.push({p,rx:-.7+noise(leafSeed+1)*1.8,ry:a*.13+n*1.8+face*1.1,rz:face*(.55+noise(leafSeed+2)*.75),size:(.34+noise(leafSeed+3)*.2)*(nearby?.9:1)});
    }
   }
  }
  const geometry=mergeGeometries(parts,false);for(const g of parts)g.dispose();const mesh=addMesh(geometry,wood,branchGroup);mesh.name='骨干枝与三级细枝';const leavesMesh=leafCloud(branchGroup,leaves);branches.push({group:branchGroup,birth,attach,leaves:leavesMesh,phase:i*.7,wind:i===0?0:.004});
 }
 for(let i=0;i<3;i++){
  const shoot=new T.Group(),a=i*Math.PI*2/3+.25;shoot.position.set(Math.cos(a)*.65,.34,Math.sin(a)*.65);shoot.rotation.y=-a;group.add(shoot);
  addMesh(tube([V(),V(.12,.42,0),V(.22,.87,.03),V(.12,1.18,0)],[.032,.025,.015,.002]),greenWood,shoot);
  const leaves=[];for(let j=0;j<8;j++)leaves.push({p:V(.13,.2+j*.105,0),rx:.2,ry:j*2.4,rz:(j%2?1:-1)*.65,size:.22+(j%3)*.055});leafCloud(shoot,leaves,shootLeafMaterial);shoots.push({group:shoot,age:lights>i?1:0});
 }
 function applyPose(time=0,reduced=false){const pose=treeLifePose(age,started?3:previousLights);trunk.scale.set(.76+.24*pose.green,pose.trunkScale,.76+.24*pose.green);wood.color.set(0x918c79).lerp(new T.Color(0x797d62),pose.green*.6);
  leafOpen.value=pose.leafScale;
  for(const branch of branches){branch.group.position.set(branch.attach.x*trunk.scale.x,branch.birth*pose.trunkScale,branch.attach.z*trunk.scale.z);branch.group.scale.setScalar(pose.branchScale);branch.group.rotation.z=reduced?0:Math.sin(time*.32+branch.phase)*branch.wind*pose.leafScale;branch.leaves.visible=pose.leafScale>.002;}
  for(const shoot of shoots){shoot.group.scale.setScalar(Math.max(.001,ease(shoot.age,0,1)));shoot.group.visible=shoot.age>.001;}
  trunk.updateWorldMatrix(true,false);
  return pose;
 }
 lastPhase=applyPose().phase;
 function update(dt,{lights:nextLights=previousLights,playing=true,reduced=false}={}){
  const delta=playing?clamp(Number.isFinite(dt)?dt:0,0,.25):0;windTime+=delta;
  if(nextLights>=3&&!started){started=true;age=0;onEvent({type:'tree-rebirth',phase:'start'});}
  for(let i=0;i<3;i++)if(nextLights>i)shoots[i].age=clamp(shoots[i].age+delta*.65,0,1);
  previousLights=nextLights;if(started&&age<TREE_REBIRTH_SECONDS)age=Math.min(TREE_REBIRTH_SECONDS,age+delta);
  const pose=applyPose(windTime,reduced);if(pose.phase!==lastPhase){lastPhase=pose.phase;if(started)onEvent({type:'tree-life',phase:pose.phase,progress:pose.progress,replay:replaying});}if(age>=TREE_REBIRTH_SECONDS)replaying=false;
  return pose;
 }
 function restore({completed=false,lights=0}={}){started=completed;age=completed?TREE_REBIRTH_SECONDS:0;previousLights=lights;replaying=false;for(let i=0;i<3;i++)shoots[i].age=lights>i?1:0;lastPhase=applyPose(windTime).phase;}
 function replay(){if(!started||age<TREE_REBIRTH_SECONDS)return false;age=0;replaying=true;lastPhase=null;onEvent({type:'tree-rebirth',phase:'start',replay:true});return true;}
 return {group,trunk,cameraColliders:[trunk],update,restore,replay,getPerch(){group.updateWorldMatrix(true,false);const direction=perchTangent.clone().transformDirection(group.matrixWorld),horizontal=direction.x**2+direction.z**2;return {id:'reborn-root-bough',label:'你唤醒的古树',position:group.localToWorld(perchLocal.clone()),radius:.75,yaw:Math.atan2(-direction.z,direction.x),slope:{x:direction.y*direction.x/horizontal,z:direction.y*direction.z/horizontal}};},snapshot:()=>({...treeLifePose(age,started?3:previousLights),replaying}),dispose(){group.removeFromParent();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();},debug:()=>({branches:branches.length,leaves:branches.reduce((n,b)=>n+b.leaves.count,0),height:treeLifePose(age,started?3:previousLights).height})};
}

