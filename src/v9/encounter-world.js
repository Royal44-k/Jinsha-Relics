import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRootGeometry} from '../v8/profiled-tubes.js';
import {ENCOUNTERS} from './expedition-state.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2;
/** Three authored physical silhouettes, with a ground wave that exactly matches the rules. */
export function createEncounterWorld({parent,at,tangent,bark,rock,ground=()=>0,cleared=[]}){
 const group=new T.Group();group.name='原创幻想 · 三处记忆蚀影';parent.add(group);
 const geometries=[],materials=[],items=[],solids=[],cameraColliders=[],scanSlots=[];let scansBorrowed=false,animationTime=0;
 const wood=bark.clone();wood.color.set(0x495049);wood.roughness=.96;materials.push(wood);
 const stone=rock.clone();stone.color.set(0x686f67);stone.roughness=.91;stone.side=T.DoubleSide;materials.push(stone);
 const jade=new T.MeshStandardMaterial({color:0x6b8f77,roughness:.31,metalness:.22,emissive:0x28533d,emissiveIntensity:.1});materials.push(jade);
 const dark=new T.MeshStandardMaterial({color:0x202b2b,roughness:.62,metalness:.2});materials.push(dark);
 const young=new T.MeshStandardMaterial({color:0x668849,roughness:.8,side:T.DoubleSide}),ochre=new T.MeshStandardMaterial({color:0x9b785e,roughness:.95}),moss=new T.MeshStandardMaterial({color:0x68784d,roughness:1});materials.push(young,ochre,moss);
 function mesh(g,m,p=group){geometries.push(g);const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 function merged(parts,material,parent){const g=mergeGeometries(parts,false);for(const part of parts)part.dispose();return mesh(g,material,parent);}
 function block(x,y,z,sx,sy,sz,ry=0,rz=0){const g=new T.BoxGeometry(sx,sy,sz,2,2,2),p=g.attributes.position;for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i),noise=Math.sin(a*4.1+b*3.7+c*5.3+x*2.3+z)*.045;p.setXYZ(i,a+noise,b+noise*.4,c+Math.sin(a*3.2+b*7.2+c*2.1)*.032);}g.rotateZ(rz);g.rotateY(ry);g.translate(x,y,z);g.computeVertexNormals();return g;}
 function reedBlade(length,bend,width){const p=[],uv=[],index=[];for(let i=0;i<=8;i++){const t=i/8,w=Math.sin(Math.PI*t)*width,lean=bend*t*t;for(const side of [-1,1]){p.push(lean+side*w,length*t,Math.sin(t*Math.PI)*.07);uv.push(side<0?0:1,t);}if(i<8){const n=i*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;}
 function terrainRings(parent,radius){const segments=72,radialSteps=16,heights=[];parent.updateWorldMatrix(true,false);for(let i=0;i<=segments;i++){const a=i/segments*TAU,row=[];for(let j=0;j<=radialSteps;j++){const point=parent.localToWorld(V(Math.cos(a)*radius*j/radialSteps,0,Math.sin(a)*radius*j/radialSteps));row.push(ground(point)-parent.position.y);}heights.push(row);}const make=()=>{const geometry=new T.BufferGeometry(),index=[];geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array((segments+1)*6),3));for(let i=0;i<segments;i++){const n=i*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}geometry.setIndex(index);geometries.push(geometry);return geometry;};
  function fill(geometry,r){const p=geometry.attributes.position;for(let i=0;i<=segments;i++){const a=i/segments*TAU;for(let j=0;j<2;j++){const localRadius=r*(j?.995:.94),u=T.MathUtils.clamp(localRadius/radius*radialSteps,0,radialSteps),k=Math.min(radialSteps-1,Math.floor(u)),y=T.MathUtils.lerp(heights[i][k],heights[i][k+1],u-k);p.setXYZ(i*2+j,Math.cos(a)*localRadius,y+.075,Math.sin(a)*localRadius);}}p.needsUpdate=true;geometry.computeBoundingSphere();}
  return {make,fill};
 }
 function restoration(index,parent){const restored=new T.Group();parent.add(restored);const parts=[],extra=[];
  if(index===0){for(let i=0;i<54;i++){const a=1.5+i*2.399963,r=2.6+(i%7)*.27,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1.5&&Math.abs(x)<1.8)continue;for(let leaf=0;leaf<3;leaf++){const blade=reedBlade(.85+(i%6)*.16,.3+(leaf%2)*.24,.035+(leaf%2)*.018);blade.rotateY(a+leaf*2.1);blade.translate(x,0,z);parts.push(blade);}}merged(parts,young,restored);}
  else if(index===1){for(let i=0;i<22;i++){const side=i%2?1:-1,z=-2.4+Math.floor(i/2)*.53,x=side*(2.5+.28*Math.sin(i));const p=block(x,.015,z,.38+(i%3)*.09,.025,.34,i*.7);parts.push(p);}merged(parts,moss,restored);for(let i=0;i<3;i++){const pot=mesh(new T.LatheGeometry([new T.Vector2(.14,0),new T.Vector2(.3,.1),new T.Vector2(.34,.4),new T.Vector2(.23,.55),new T.Vector2(.17,.58)],24,0,i===1?Math.PI*1.65:TAU),ochre,restored);pot.position.set(2.65+(i%2)*.48,.1,-1.5+i*.7);pot.rotation.z=(i-1)*.16;}}
  else{for(let i=0;i<21;i++){const a=i*2.399963,r=2.5+(i%5)*.26,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1.2&&Math.abs(x)<1.6)continue;for(let j=0;j<5;j++){const blade=reedBlade(.35+(i%4)*.065,.15,.075);blade.rotateY(a+j*1.25);blade.translate(x,0,z);parts.push(blade);}const flower=new T.SphereGeometry(.045,5,4);flower.translate(x,.48+(i%3)*.05,z);extra.push(flower);}merged(parts,young,restored);const pollen=new T.MeshStandardMaterial({color:0xd6d5ad,roughness:.8});materials.push(pollen);merged(extra,pollen,restored);}
  restored.scale.y=.001;restored.visible=false;return restored;
 }
 for(let i=0;i<ENCOUNTERS.length;i++){
  const definition=ENCOUNTERS[i],g=new T.Group();g.name=definition.title;g.position.copy(at(definition.fraction,definition.lateral));const t=tangent(definition.fraction);g.rotation.y=Math.atan2(t.x,t.z);group.add(g);
  const groundParts=[];for(let j=0;j<17;j++){const a=j*2.399963,r=2.05+(j%5)*.31,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1.3&&Math.abs(x)<1.5)continue;groundParts.push(block(x,.025+(j%3)*.018,z,.32+(j%4)*.11,.07+(j%2)*.04,.24+(j%3)*.08,-a,(j%2)*.12));}merged(groundParts,stone,g);
  const base=mesh(new T.LatheGeometry([new T.Vector2(.8,0),new T.Vector2(.68,.13),new T.Vector2(.5,.27),new T.Vector2(.29,.34)],24),stone,g);
  const coreGroup=new T.Group();coreGroup.position.y=1.28;g.add(coreGroup);
  const coreMaterial=jade.clone();materials.push(coreMaterial);const core=mesh(new T.OctahedronGeometry(.41,2),coreMaterial,coreGroup);core.scale.set(.85,1.38,.85);
  const shells=[];
  for(let j=0;j<3;j++){const a=j*TAU/3,shell=new T.Group();shell.rotation.y=a;coreGroup.add(shell);const shellGeo=createRootGeometry([V(.4,-.65,0),V(.66,-.1,.13),V(.52,.5,.11),V(.14,.83,0)],[.13,.15,.09,.004]);mesh(shellGeo,dark,shell);shells.push(shell);}
  if(i===0){
   const limbs=[];for(const [x,z,h,lean] of [[-3.1,-1.2,2.8,.6],[2.8,-.8,3.4,.4],[-2.2,2.3,1.7,.7],[1.6,-2.5,2.3,.75],[-.8,-3.4,2,.6]]){const start=V(x,0,z),end=V(x*lean,h,z*lean);limbs.push(createRootGeometry([start,start.clone().multiplyScalar(.9).setY(.5),start.clone().multiplyScalar(.68).setY(h*.65),end],[.14,.17,.09,.007]));}merged(limbs,wood,g);
  }else if(i===1){
   // Borrow the already-loaded CC0 photogrammetry template. The chapter retains
   // ownership of its geometry/materials; this encounter adds placements only.
   for(const [side,z,width,height,twist] of [[-1,-.65,5.2,3.5,.16],[1,.9,4.6,3.0,-.24]]){const holder=new T.Group();holder.position.set(side*4.7,0,z);holder.rotation.y=-side*.5+twist;g.add(holder);const fallback=mesh(new T.IcosahedronGeometry(1,2),stone,holder);fallback.scale.set(width*.5,height*.5,width*.36);fallback.position.y=height*.4;scanSlots.push({holder,fallback,width,height});cameraColliders.push(holder);for(const dz of [-1.3,0,1.3])solids.push({position:g.localToWorld(V(side*4.7,0,z+dz)),radius:1.25,height});}
  }else{
   const parts=[];for(let j=0;j<5;j++){const a=j/5*TAU+.3,p=V(Math.cos(a)*3.35,0,Math.sin(a)*3.35);if(p.z>1.5)continue;parts.push(createRootGeometry([p,p.clone().add(V(.1,1.9,.1)),p.clone().add(V(.2,3.4,-.1))],[.21,.14,.065]));}merged(parts,wood,g);
  }
  const terrain=terrainRings(g,definition.radius),waveGeometry=terrain.make();terrain.fill(waveGeometry,.05);
  const waveMaterial=new T.MeshBasicMaterial({color:0xc18464,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,toneMapped:false});materials.push(waveMaterial);const wave=new T.Mesh(waveGeometry,waveMaterial);g.add(wave);wave.visible=false;
  const warningGeometry=terrain.make();terrain.fill(warningGeometry,definition.radius);const warningMaterial=new T.MeshBasicMaterial({color:0xd7ae73,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false,toneMapped:false});materials.push(warningMaterial);const warning=new T.Mesh(warningGeometry,warningMaterial);g.add(warning);
  const gapAngle={value:Math.PI/2};let safeArc=null,safeArrow=null;
  if(definition.attack==='broken'){
   const gapShader=(mat,invert=false)=>{mat.onBeforeCompile=shader=>{shader.uniforms.uGapAngle=gapAngle;shader.vertexShader='varying vec2 vWavePoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWavePoint=position.xz;');shader.fragmentShader='uniform float uGapAngle;\nvarying vec2 vWavePoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat a=atan(vWavePoint.y,vWavePoint.x)-uGapAngle;float gap=abs(atan(sin(a),cos(a)));if(gap${invert?'>':'<'}0.6283185)discard;`);};mat.customProgramCacheKey=()=> 'v9-broken-wave-'+invert;};gapShader(waveMaterial);gapShader(warningMaterial);
   const safeMaterial=new T.MeshBasicMaterial({color:0x81be9e,transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false,toneMapped:false});materials.push(safeMaterial);gapShader(safeMaterial,true);safeArc=new T.Mesh(warningGeometry,safeMaterial);g.add(safeArc);
   const arrowGeometry=new T.BufferGeometry();arrowGeometry.setAttribute('position',new T.Float32BufferAttribute([1.15,0,0,-.25,0,-.54,-.05,0,0,1.15,0,0,-.05,0,0,-.25,0,.54],3));arrowGeometry.computeVertexNormals();const arrowMaterial=new T.MeshBasicMaterial({color:0x81be9e,transparent:true,opacity:.26,side:T.DoubleSide,depthWrite:false,toneMapped:false});materials.push(arrowMaterial);safeArrow=mesh(arrowGeometry,arrowMaterial,g);safeArrow.castShadow=false;
  }
  const veins=mesh(new T.TorusGeometry(.65,.012,5,48),jade,coreGroup);veins.rotation.x=Math.PI/2;
  const purified=new T.Group();purified.position.y=.29;g.add(purified);const branchParts=[];for(let j=0;j<5;j++){const a=j*2.4;branchParts.push(createRootGeometry([V(),V(Math.cos(a)*.25,.4,Math.sin(a)*.25),V(Math.cos(a)*.62,.78+(j%2)*.2,Math.sin(a)*.62)],[.025,.02,.002]));}merged(branchParts,wood,purified);purified.visible=false;
  const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.21,.16,-.16,.4,0,.57);leafShape.bezierCurveTo(.16,.4,.21,.16,0,0);const leafGeo=new T.ShapeGeometry(leafShape,8),leafMat=new T.MeshStandardMaterial({color:0x79a05b,roughness:.68,side:T.DoubleSide});materials.push(leafMat);geometries.push(leafGeo);for(let j=0;j<12;j++){const a=j*2.4,l=new T.Mesh(leafGeo,leafMat);l.position.set(Math.cos(a)*.3,.3+(j%3)*.18,Math.sin(a)*.3);l.rotation.set(.2,a,(j%2?1:-1)*.6);purified.add(l);}
  const restored=restoration(i,g),p=g.position.clone(),complete=cleared.includes(definition.id);items.push({definition,group:g,position:p,core,coreGroup,coreMaterial,shells,wave,terrain,warning,gapAngle,safeArc,safeArrow,purified,restored,opening:complete?1:0,life:complete?1:0});
 }
 const pos=new T.Vector3();
 function borrowScans(){if(scansBorrowed||!scanSlots.length)return;let root=parent;while(root.parent)root=root.parent;let source=null;root.traverse(o=>{if(!source&&o.name==='CC0 scan · rock_face_01')source=o;});if(!source)return;const template=source.clone(true);template.position.set(0,0,0);template.rotation.set(0,0,0);template.scale.set(1,1,1);template.updateMatrixWorld(true);const box=new T.Box3().setFromObject(template),size=box.getSize(V()),centre=box.getCenter(V());for(const slot of scanSlots){const model=template.clone(true),scale=slot.width/Math.max(size.x,size.z),height=slot.height/size.y;model.name='复用扫描岩体 · 石廊';model.scale.set(scale,height,scale);model.position.set(-centre.x*scale,-box.min.y*height-.15,-centre.z*scale);slot.holder.add(model);const originalSkirt=source.parent?.children.find(o=>o.name==='Closed earthward rock volume');if(originalSkirt){const skirt=originalSkirt.clone();skirt.name='复用扫描岩体封边';skirt.scale.set(scale/source.scale.x,height/source.scale.y,scale/source.scale.z);skirt.position.y=.16*skirt.scale.y-.15;slot.holder.add(skirt);}slot.fallback.removeFromParent();}scansBorrowed=true;}
 function update(dt,_time,{player,state,reach=6.2,reduced=false}){
  animationTime+=Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0));
  borrowScans();
  for(const item of items){const distance=Math.hypot(player.x-item.position.x,player.z-item.position.z);item.group.visible=distance<44;if(!item.group.visible)continue;const s=state.snapshot(item.definition.id,distance,reach),cleared=s.phase==='cleared',open=s.phase==='exposed'||cleared,goal=open?1:0;item.opening+=(goal-item.opening)*(1-Math.exp(-dt*5));
   item.coreGroup.position.y=1.28+(reduced?0:Math.sin(animationTime*.85+item.definition.fraction)*.07);item.core.rotation.y=reduced?0:animationTime*.12;
   item.coreMaterial.color.set(s.phase==='retry'?0x687074:open?0x8fc7a2:0x597269);item.coreMaterial.emissiveIntensity=open?.23:.06;
   for(let j=0;j<3;j++){const shell=item.shells[j];shell.rotation.z=-item.opening*.48;shell.position.y=-item.opening*.17;shell.visible=!cleared||item.opening<.98;}
   item.wave.visible=s.phase==='wave';if(item.wave.visible){item.terrain.fill(item.wave.geometry,Math.max(.05,s.waveRadius));item.wave.material.opacity=.55*(1-s.progress*.35);}
   item.warning.visible=s.phase==='windup';item.warning.material.opacity=.08+s.progress*.18;
   if(item.safeArc){item.gapAngle.value=s.safeAngle;item.safeArc.visible=['windup','wave'].includes(s.phase);item.safeArrow.visible=item.safeArc.visible;item.safeArrow.position.set(Math.cos(s.safeAngle)*3.3,0,Math.sin(s.safeAngle)*3.3);const world=item.group.localToWorld(item.safeArrow.position.clone());item.safeArrow.position.y=ground(world)-item.position.y+.08;item.safeArrow.rotation.y=-s.safeAngle;}
   item.purified.visible=cleared;item.life+=(cleared?1:-1)*dt*.4;item.life=T.MathUtils.clamp(item.life,0,1);item.purified.scale.setScalar(Math.max(.001,item.life));item.restored.visible=cleared;item.restored.scale.y=Math.max(.001,item.life);item.core.scale.set(.85,1.38,.85).multiplyScalar(cleared?.72:1);
  }
 }
 function resolveMotion(from,to,radius=.27){if(solids.every(s=>Math.hypot(to.x-s.position.x,to.z-s.position.z)>18&&Math.hypot(from.x-s.position.x,from.z-s.position.z)>18))return null;let hit=false,normal=null;const steps=Math.max(1,Math.ceil(from.distanceTo(to)/.18)),delta=to.clone().sub(from).divideScalar(steps);pos.copy(from);for(let step=0;step<steps;step++){pos.add(delta);for(const s of solids){if(pos.y>=s.position.y+s.height||pos.y+1.05<=s.position.y)continue;const dx=pos.x-s.position.x,dz=pos.z-s.position.z,d=Math.hypot(dx,dz),limit=s.radius+radius;if(d<limit){const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;pos.x=s.position.x+nx*limit;pos.z=s.position.z+nz*limit;normal=V(nx,0,nz);hit=true;}}}return hit?{position:pos.clone(),hit,normal,reason:'岩壁有一道开口。穿过中间石廊，或展翼越过岩沿。'}:null;}
 function restore(cleared=[]){for(const item of items){item.life=cleared.includes(item.definition.id)?1:0;item.opening=item.life;}}
 return {group,items,cameraColliders,update,resolveMotion,restore,dispose(){group.removeFromParent();for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();}};
}
