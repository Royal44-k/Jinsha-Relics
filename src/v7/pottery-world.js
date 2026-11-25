import * as THREE from 'three';
import {simulationDelta} from '../v8/frame-time.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createPotteryState,sanitizePottery,describePottery,POTTERY_PROFILE,POTTERY_REFERENCES} from './pottery-state.js';
export {sanitizePottery} from './pottery-state.js';
export const POTTERY_SITE=Object.freeze({fraction:.610,side:-4.8,radius:1.5});
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2,clamp=THREE.MathUtils.clamp;
const HEIGHT=1.14;
function sampleRadius(profile,t){const v=clamp(t,0,1)*12,i=Math.min(11,Math.floor(v)),f=v-i,a=profile[Math.max(0,i-1)],b=profile[i],c=profile[i+1],d=profile[Math.min(12,i+2)];return clamp(.5*(2*b+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f),.18,.68);}
/** Closed clay wall with an open mouth, real inner surface and substantial bottom. */
export function createPotteryGeometry(profile=POTTERY_PROFILE,pattern='plain',segments=80){
 const points=[new THREE.Vector2(0,.015),new THREE.Vector2(profile[0]*.91,.015),new THREE.Vector2(profile[0],.045)];
 for(let i=0;i<=84;i++){const t=i/84;let radius=sampleRadius(profile,t);const band=Math.sin(Math.PI*clamp((t-.13)/.74,0,1));
  if(pattern==='ripple')radius+=Math.sin(t*TAU*11)*.0045*band;
  points.push(new THREE.Vector2(radius,.055+t*HEIGHT));
 }
 const mouth=profile[12];points.push(new THREE.Vector2(mouth-.012,HEIGHT+.067),new THREE.Vector2(mouth-.044,HEIGHT+.061));
 for(let i=84;i>=5;i--){const t=i/84;points.push(new THREE.Vector2(Math.max(.105,sampleRadius(profile,t)-.055),.055+t*HEIGHT));}
 points.push(new THREE.Vector2(.12,.12),new THREE.Vector2(0,.12));
 const g=new THREE.LatheGeometry(points,segments);
 if(pattern==='seed'){const p=g.attributes.position;for(let j=0;j<=segments;j++)for(let i=0;i<=84;i++){const k=j*points.length+3+i,t=i/84,a=j/segments*TAU,r=Math.hypot(p.getX(k),p.getZ(k)),marks=[.31,.40,.63,.72].reduce((sum,y,n)=>sum+Math.exp(-Math.pow((t-y)/.021,2))*Math.max(0,Math.cos(a*26+(n%2)*Math.PI))**8,0),nr=r-marks*.0095;p.setXYZ(k,p.getX(k)*nr/r,p.getY(k),p.getZ(k)*nr/r);}g.computeVertexNormals();}
 g.computeBoundingSphere();return g;
}
export function createPotteryWorld({scene,forest,traversal,saved,onEvent=()=>{}}={}){
 const group=new THREE.Group();group.name='V7 · 泥火留形';scene.add(group);
 const tangent=forest.path.getTangentAt(POTTERY_SITE.fraction).setY(0).normalize(),right=V(-tangent.z,0,tangent.x);
 const centre=forest.sample(forest.length*POTTERY_SITE.fraction).addScaledVector(right,POTTERY_SITE.side);centre.y=traversal.sample(centre).groundHeight;
 group.position.copy(centre);group.rotation.y=Math.atan2(tangent.x,tangent.z);
 const materials=new Set(),geometries=new Set(),textures=new Set(),cameraColliders=[],gallery=[];
 const mat=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
 const mesh=(g,m,p=V(),parent=group)=>{geometries.add(g);const o=new THREE.Mesh(g,m);o.position.copy(p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const findMap=needle=>{let map=null;forest.group?.traverse(o=>{if(!map&&o.material?.map?.image?.src?.includes(needle))map=o.material.map;});return map;};
 const wood=mat({map:forest.surfaces?.bark?.map||findMap('bark_brown'),color:'#574534',roughness:.87}),stone=mat({color:'#555b50',roughness:.96}),cloth=mat({color:'#8c8061',roughness:.96}),clay=mat({color:'#a28b75',roughness:.79,metalness:0});
 const firedClay=mat({color:'#b37a51',roughness:.94});
 // Original fine mineral grain, encoded as a tangent-space normal tile. No
 // image borrowed from a museum or a reference game's pot.
 const texSize=128,heights=new Float32Array(texSize*texSize),normalBytes=new Uint8Array(texSize*texSize*4);let seed=918362;
 for(let y=0;y<texSize;y++)for(let x=0;x<texSize;x++){seed=(1664525*seed+1013904223)>>>0;heights[y*texSize+x]=(seed/4294967296)*.42+Math.sin(y*.28+Math.sin(x*.08)*.65)*.07;}
 const atHeight=(x,y)=>heights[((y+texSize)%texSize)*texSize+(x+texSize)%texSize];
 for(let y=0;y<texSize;y++)for(let x=0;x<texSize;x++){const nx=(atHeight(x-1,y)-atHeight(x+1,y))*.65,ny=(atHeight(x,y-1)-atHeight(x,y+1))*.65,n=V(nx,ny,1).normalize(),k=(y*texSize+x)*4;normalBytes[k]=Math.round((n.x*.5+.5)*255);normalBytes[k+1]=Math.round((n.y*.5+.5)*255);normalBytes[k+2]=Math.round((n.z*.5+.5)*255);normalBytes[k+3]=255;}
 const clayNormal=new THREE.DataTexture(normalBytes,texSize,texSize,THREE.RGBAFormat);clayNormal.wrapS=clayNormal.wrapT=THREE.RepeatWrapping;clayNormal.repeat.set(7,7);clayNormal.generateMipmaps=true;clayNormal.minFilter=THREE.LinearMipmapLinearFilter;clayNormal.magFilter=THREE.LinearFilter;clayNormal.needsUpdate=true;textures.add(clayNormal);
 clay.normalMap=firedClay.normalMap=clayNormal;clay.normalScale.set(.35,.35);firedClay.normalScale.set(.55,.55);
 const wetColor=new THREE.Color('#a28b75'),firedColor=new THREE.Color('#bd845b');
 function claySurface(material){material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vPotPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPotPosition=position;');
  shader.fragmentShader='varying vec3 vPotPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float grain=fract(sin(dot(floor(vPotPosition*830.),vec3(127.1,311.7,74.7)))*43758.5453);
 float throwing=sin(vPotPosition.y*310.+sin(vPotPosition.x*16.)*.7+sin(vPotPosition.z*21.)*.7);
 float ash=sin(vPotPosition.x*9.+vPotPosition.z*6.)*sin(vPotPosition.y*12.+vPotPosition.x*4.);
 diffuseColor.rgb*=.89+grain*.12+throwing*.018+ash*.07;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+sin(vPotPosition.y*120.+vPotPosition.x*27.)*.045,.65,1.);');
 };material.customProgramCacheKey=()=> 'v7-tactile-clay';}
 claySurface(clay);claySurface(firedClay);
 cloth.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vMatPos;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMatPos=position;');shader.fragmentShader='varying vec3 vMatPos;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.86+.08*sin(vMatPos.x*230.)+.07*sin(vMatPos.z*230.);');};cloth.customProgramCacheKey=()=> 'v7-reed-mat';
 const tabletop=mesh(new RoundedBoxGeometry(2.45,.13,1.60,3,.045),wood,V(0,.65,0));cameraColliders.push(tabletop);
 for(const x of [-.97,.97])for(const z of [-.54,.54]){const leg=mesh(new THREE.CylinderGeometry(.09,.12,.59,7),wood,V(x,.295,z));leg.rotation.z=x*.04;cameraColliders.push(leg);}
 mesh(new THREE.BoxGeometry(2.08,.11,.10),wood,V(0,.25,-.54));
 const matPlane=mesh(new THREE.CylinderGeometry(.79,.8,.026,64),cloth,V(-.15,.729,0));
 const turntable=mesh(new THREE.CylinderGeometry(.64,.68,.08,64),stone,V(-.15,.77,0));
 const potPivot=new THREE.Group();potPivot.position.set(-.15,.815,0);group.add(potPivot);
 const pot=mesh(createPotteryGeometry(),clay,V(),potPivot);pot.name='Your own hollow vessel';cameraColliders.push(pot);
 const guideMaterial=new THREE.LineBasicMaterial({color:'#dfc589',transparent:true,opacity:.34,depthWrite:false});materials.add(guideMaterial);
 const guide=new THREE.Group();guide.position.copy(potPivot.position);group.add(guide);guide.visible=false;
 for(const sign of [-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(Array(13*3).fill(0),3));geometries.add(geo);const line=new THREE.Line(geo,guideMaterial);line.userData.sign=sign;guide.add(line);}
 const brush=mesh(new THREE.CylinderGeometry(.013,.021,.43,7),wood,V(.95,.75,.43));brush.rotation.set(.08,.4,1.45);
 const bowl=mesh(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.16,.01),new THREE.Vector2(.22,.13),new THREE.Vector2(.18,.14),new THREE.Vector2(.12,.04),new THREE.Vector2(0,.04)],32),firedClay,V(.90,.74,-.38));
 const water=mesh(new THREE.CircleGeometry(.172,32),mat({color:'#456c68',metalness:.3,roughness:.17,transparent:true,opacity:.84}),V(.90,.842,-.38));water.rotation.x=-Math.PI/2;
 const stamps=[];for(let i=0;i<3;i++){const stamp=mesh(new THREE.CylinderGeometry(.045,.035,.24,8),wood,V(.85+i*.12,.76,.09));stamp.rotation.z=Math.PI/2;stamps.push(stamp);}
 // The miniature works remain here after leaving; they are meshes of the saved profiles.
 const display=new THREE.Group();display.position.set(0,.73,-.61);group.add(display);
 const hotMaterial=new THREE.MeshBasicMaterial({color:'#ef9852',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});materials.add(hotMaterial);
 const heatRing=mesh(new THREE.RingGeometry(.52,.70,64),hotMaterial,V(-.15,.825,0));heatRing.rotation.x=-Math.PI/2;heatRing.castShadow=false;
 let active=false,nearby=false,distance=Infinity,lastRevision='',lastWorks='',orbitAngle=0,orbitElevation=.36,reference=null,paused=false,elapsed=0,lastCue=-9,viewingWork=null,qualityMode='high';const picker=new THREE.Raycaster();
 const state=createPotteryState(saved,event=>{onEvent({...event,position:centre.toArray()});});
 function replaceGeometry(object,g){const old=object.geometry;geometries.delete(old);old.dispose();object.geometry=g;geometries.add(g);}
 function sync(){const s=state.snapshot(),view=viewingWork===null?null:s.works[viewingWork],revision=s.revision+':'+viewingWork+':'+qualityMode;if(lastRevision!==revision){replaceGeometry(pot,createPotteryGeometry(view?.profile||s.profile,view?.pattern||s.pattern,qualityMode==='low'?48:80));lastRevision=revision;}
  const signature=JSON.stringify(s.works)+qualityMode;if(signature!==lastWorks){for(const o of gallery){geometries.delete(o.geometry);o.geometry.dispose();o.removeFromParent();}gallery.length=0;s.works.forEach((w,i)=>{const o=mesh(createPotteryGeometry(w.profile,w.pattern,qualityMode==='low'?24:40),firedClay,V((i-1)*.50,0,0),display);o.scale.setScalar(.29);o.rotation.y=i*.7;gallery.push(o);});lastWorks=signature;}
  const bake=view||s.fired?1:s.firing?THREE.MathUtils.smoothstep(s.heat,.3,.96):0;clay.color.copy(wetColor).lerp(firedColor,bake);clay.roughness=.79+bake*.15;clay.normalScale.setScalar(.35+bake*.20);
  const incandescence=s.firing?Math.sin(s.heat*Math.PI)**2:0;clay.emissive.set('#ed5421');clay.emissiveIntensity=incandescence*.32;hotMaterial.opacity=incandescence*.38;
 }
 function positionOfPot(){group.updateMatrixWorld(true);return potPivot.getWorldPosition(V());}
 function cameraPose(aspect=1.6){const target=positionOfPot().add(V(0,aspect<.75?.40:.57,0)),dist=aspect<.75?4.45:3.2,angle=orbitAngle;
  const dir=right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle));return {position:target.clone().addScaledVector(dir,dist).add(V(0,dist*orbitElevation,0)),target,fov:aspect<.75?34:33};}
 function screenBounds(camera,width,height){group.updateMatrixWorld(true);camera.updateMatrixWorld();const bottom=potPivot.localToWorld(V(0,.055,0)).project(camera),top=potPivot.localToWorld(V(0,HEIGHT+.065,0)).project(camera),mid=potPivot.localToWorld(V(0,.6,0)),axis=V(1,0,0).applyQuaternion(camera.quaternion),edge=mid.clone().addScaledVector(axis,.72).project(camera),midScreen=mid.project(camera);return {x:(midScreen.x+1)*width/2,y:(top.y+1)*-height/2+height,bottom:(bottom.y+1)*-height/2+height,width:Math.abs(edge.x-midScreen.x)*width,height:Math.abs(top.y-bottom.y)*height/2};}
 function update(dt,{position,playing=true,active:isActive=active,reduced=false,quality='high',motion={}}={}){
  active=!!isActive;paused=!playing;qualityMode=quality==='low'?'low':'high';const safeDt=playing?simulationDelta(dt):0;elapsed+=safeDt;
  if(position){distance=centre.distanceTo(position);nearby=distance<3.05&&(!motion.mode||motion.mode==='grounded');if(playing&&distance<12&&!state.snapshot().discovered){state.discover();onEvent({type:'discover',name:'pottery',title:'泥火留形',body:'窑火旁，有一张等你靠近的陶案。可以留下一件自己的器物。',position:centre.toArray()});}}
  group.visible=active||distance<(quality==='low'?32:46);state.update(safeDt,active&&playing);sync();
  if(active&&!reduced&&!paused&&!state.snapshot().fired&&viewingWork===null)potPivot.rotation.y+=safeDt*.42;
  if(reference){const s=state.snapshot();guide.visible=active&&!s.firing&&!s.fired&&viewingWork===null;guide.quaternion.copy(group.quaternion).invert().multiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.atan2(right.x,right.z)+orbitAngle));}else guide.visible=false;
 }
 function cue(name,strength){if(elapsed-lastCue<.065)return;lastCue=elapsed;onEvent({type:'cue',name,strength:clamp(strength,.05,1),position:centre.toArray()});}
 function resolveMotion(from,to,radius=.26){const result=to.clone(),steps=Math.max(1,Math.ceil(from.distanceTo(to)/.2)),step=to.clone().sub(from).multiplyScalar(1/steps),potCentre=positionOfPot(),potRadius=Math.max(...state.snapshot().profile);let p=from.clone(),hit=false,normal=null;
  for(let i=0;i<steps;i++){p.add(step);if(p.y<=centre.y+.77&&p.y+1.05>=centre.y){const q=p.clone().sub(centre),x=q.dot(right),z=q.dot(tangent),hx=1.225+radius,hz=.80+radius;
   if(Math.abs(x)<hx&&Math.abs(z)<hz){const useX=hx-Math.abs(x)<hz-Math.abs(z),axis=useX?right:tangent,amount=(useX?hx-Math.abs(x):hz-Math.abs(z))*(Math.sign(useX?x:z)||1);p.addScaledVector(axis,amount);normal=axis.clone().multiplyScalar(Math.sign(amount));hit=true;}}
   if(p.y<potCentre.y+HEIGHT+.07&&p.y+1.05>potCentre.y){const dx=p.x-potCentre.x,dz=p.z-potCentre.z,len=Math.hypot(dx,dz),limit=potRadius+radius;if(len<limit){normal=len>.001?V(dx/len,0,dz/len):right.clone();p.x=potCentre.x+normal.x*limit;p.z=potCentre.z+normal.z*limit;hit=true;}}
  }result.copy(p);return {position:result,hit,normal,reason:hit?'陶案在这里，绕到近处就能捏一件自己的器物。':null};}
 sync();
 return {
  group,centre,cameraColliders,resolveMotion,cameraPose,screenBounds,
  pick(camera,x,y,width,height){camera.updateMatrixWorld();pot.updateWorldMatrix(true,false);picker.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);const hit=picker.intersectObject(pot,false)[0];if(!hit)return null;const local=pot.worldToLocal(hit.point.clone());return {height:clamp((local.y-.055)/HEIGHT,.05,1)};},
  setActive(value){active=!!value;viewingWork=null;if(active){state.discover();orbitAngle=0;orbitElevation=.36;}sync();},
  shape(height,amount){if(!active||paused||viewingWork!==null)return false;const ok=state.shape(height,amount);if(ok)cue('pot-shape',Math.abs(amount)*35);return ok;},
  smooth(height){if(!active||paused||viewingWork!==null)return false;const ok=state.smooth(height);if(ok)cue('pot-smooth',.35);return ok;},
  stroke(start){if(start&&active&&!paused&&viewingWork===null)state.beginStroke();else state.endStroke();},
  undo(){if(!active||paused||viewingWork!==null)return false;return state.undo();},
  setPattern(id){if(!active||paused||viewingWork!==null)return false;const ok=state.setPattern(id);if(ok)cue('pot-stamp',.55);return ok;},
  fire(){return active&&!paused&&viewingWork===null&&state.fire();},remake(){if(!active||paused||viewingWork!==null)return false;return state.remake();},
  showWork(index){if(!active||paused||state.snapshot().firing)return false;if(index!==null&&(!Number.isInteger(index)||index<0||index>=state.snapshot().works.length))return false;state.endStroke();viewingWork=index;sync();return true;},
  orbit(dx,dy=0){if(!active||paused)return;orbitAngle+=clamp(dx,-.3,.3);orbitElevation=clamp(orbitElevation+dy,.16,.68);},
  setReference(id){reference=POTTERY_REFERENCES.find(r=>r.id===id)||null;if(reference)for(const line of guide.children){const p=line.geometry.attributes.position;reference.profile.forEach((r,i)=>p.setXYZ(i,line.userData.sign*r,.055+i/12*HEIGHT,.003));p.needsUpdate=true;line.geometry.computeBoundingSphere();}},
  snapshot(){const s=state.snapshot(),view=viewingWork===null?null:s.works[viewingWork];return {...s,viewingWork,displayName:describePottery(view?.profile||s.profile),displayFired:!!view||s.fired,displayPattern:view?.pattern||s.pattern,canUndo:s.canUndo&&!view,active,distance,nearby,position:centre.toArray(),reference:reference?.id||null,interaction:nearby?{id:'pottery',label:'泥火留形',detail:s.works.length?'陶案上还留着你的作品':'捏一件自己的器物，留在聚落',key:'E'}:null};},
  update,serialize:()=>state.serialize(),restore(value){state.restore(value);viewingWork=null;sync();},reset(){state.reset();active=false;reference=null;viewingWork=null;sync();},
  dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();},
 };
}
