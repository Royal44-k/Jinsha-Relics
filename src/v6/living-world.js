import * as THREE from 'three';
import {simulationDelta} from '../v8/frame-time.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLivingState,LIVING_MOMENTS} from './living-state.js';
export {sanitizeLiving} from './living-state.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);

// Original animal meshes. Geometry is batched, but bodies, vanes, eyes and fins
// have separate authored profiles; no borrowed Sky models or textures.
function creature(kind){
 const parts=[];
 function add(g,color,wing=0){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}const c=new THREE.Color(color),n=g.attributes.position.count;g.setAttribute('color',new THREE.Float32BufferAttribute(Array(n).fill([c.r,c.g,c.b]).flat(),3));g.setAttribute('aWing',new THREE.Float32BufferAttribute(Array(n).fill(wing),1));g.deleteAttribute('uv');parts.push(g);}
 function sphere(p,s,color,wing=0){const g=new THREE.SphereGeometry(1,14,10);g.scale(...s);g.translate(...p);add(g,color,wing);}
 function blade(points,width,color,wing=0){const p=[],idx=[];for(let i=0;i<points.length;i++){const v=points[i],w=Math.sin(i/(points.length-1)*Math.PI)**.7*width;p.push(v[0],v[1]+.007,v[2],v[0],v[1],v[2]-w,v[0],v[1],v[2]+w);if(i<points.length-1){const k=i*3;idx.push(k,k+1,k+3,k+1,k+4,k+3,k,k+3,k+2,k+2,k+3,k+5);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();add(g,color,wing);}
 if(kind==='bird'){
  sphere([0,0,0],[.115,.125,.34],'#a3aaa1');sphere([0,-.035,-.11],[.102,.105,.24],'#e7e3ce');
  sphere([0,.085,-.29],[.083,.13,.14],'#d8d9c9');sphere([0,.16,-.38],[.087,.085,.11],'#e9e8d7');
  for(const s of [-1,1]){sphere([s*.073,.177,-.425],[.017,.019,.014],'#131d1b');sphere([s*.078,.184,-.434],[.005,.006,.004],'#eae6c4');}
  const beak=new THREE.ConeGeometry(.027,.18,8);beak.rotateX(-Math.PI/2);beak.translate(0,.147,-.54);add(beak,'#b9a067');
  for(const s of [-1,1]){
   for(let j=0;j<8;j++){const end=.44+j*.056,z=-.13+j*.058,pts=[];for(let k=0;k<6;k++){const t=k/5;pts.push([s*(.08+(end-.08)*t),.025+Math.sin(t*Math.PI)*.025,z*t+.06*t*t]);}blade(pts,.055,j>4?'#8b9993':j%2?'#e0deca':'#c9d1c4',s);}
   for(let j=0;j<4;j++){const g=new THREE.CylinderGeometry(.003,.007,.22,5);g.rotateX(.65);g.translate(s*.045,-.1,.26);add(g,'#3d4943');}
  }
  for(let j=0;j<5;j++){const x=(j-2)*.037;blade([[0,.005,.23],[x*.5,-.01,.34],[x,-.035,.51+Math.abs(x)*.6]],.033,'#afbcb1');}
 }else{
  const g=new THREE.SphereGeometry(1,20,12),p=g.attributes.position,c=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),taper=1-smooth(.2,1,z)*.7;p.setXYZ(i,x*.085*taper,y*.12*taper,z*.39);const col=new THREE.Color().lerpColors(new THREE.Color('#c2d6c6'),new THREE.Color('#314e49'),smooth(-.5,.65,y));if(Math.abs(y)<.12)col.lerp(new THREE.Color('#d1c297'),.5);c.push(col.r,col.g,col.b);}g.computeVertexNormals();g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));const f=g.toNonIndexed();f.deleteAttribute('uv');f.setAttribute('aWing',new THREE.Float32BufferAttribute(Array(f.attributes.position.count).fill(0),1));parts.push(f);g.dispose();
  const fin=new THREE.BufferGeometry();fin.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.29,0,.17,.55,0,.035,.45,0,0,.29,0,.035,.45,0,-.035,.45,0,0,.29,0,-.035,.45,0,-.17,.55,0,.06,-.12,0,.23,.08,0,.09,.21,-.05,-.03,-.12,-.2,-.06,.05,-.06,-.04,.13,.05,-.03,-.12,.06,-.04,.13,.2,-.06,.05],3));fin.computeVertexNormals();add(fin,'#8a9f85');
  // Short gill seams and a tapered mouth read at diving distance. They belong
  // to the same batch as the body, not separate transparent overlay meshes.
  for(const side of [-1,1]){const seam=new THREE.CatmullRomCurve3([V(side*.047,-.065,-.22),V(side*.077,-.025,-.20),V(side*.079,.035,-.19),V(side*.048,.087,-.19)]);add(new THREE.TubeGeometry(seam,10,.0021,3,false),'#47635a');}
  const mouth=new THREE.CatmullRomCurve3([V(-.02,-.016,-.377),V(0,-.02,-.388),V(.02,-.016,-.377)]);add(new THREE.TubeGeometry(mouth,8,.0018,3,false),'#536d62');
  for(const side of [-1,1])for(let j=0;j<7;j++){const u=j/6,ray=new THREE.CatmullRomCurve3([V(side*.001,0,.30),V(side*.002,side*(.02+u*.08),.40),V(side*.001,side*(.035+u*.13),.45+u*.10)]);add(new THREE.TubeGeometry(ray,5,.0012,3,false),'#c0c8a2');}
  for(const s of [-1,1]){sphere([s*.056,.027,-.287],[.014,.018,.016],'#101d1a');sphere([s*.063,.034,-.296],[.004,.006,.005],'#e6dcc0');}
 }
 const result=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());result.computeBoundingSphere();return result;
}

/** Three optional embodied encounters, independent of the five main puzzles. */
export function createLivingWorld({scene,forest,traversal,onEvent=()=>{},saved}={}){
 const group=new THREE.Group();group.name='V6 · 山林回信';scene.add(group);
 const geometries=new Set(),materials=new Set(),clock={value:0},birdLift={value:0},dummy=new THREE.Object3D(),awayFromPlayer=V(),lensAxis=V(),lensDelta=V(),lensClosest=V();
 const at=(f,side=0)=>{const t=forest.path.getTangentAt(f);return forest.sample(f*forest.length).addScaledVector(V(-t.z,0,t.x),side);};
 const branch=traversal.perches?.[0],bough=branch?.position.clone()||at(.105,-2.1).setY(4.9);
 const pool=(traversal.pool?.clone()||at(.215,12)).setY(-1.1),birds=at(.665,2.8);birds.y=traversal.sample(birds).groundHeight;
 const centres={'lantern-bough':bough,'river-mirror':pool,'wing-passage':birds};
 const state=createLivingState(saved,e=>onEvent({...e,text:e.type==='complete'?e.story:hint(e.id),position:centres[e.id].toArray(),cue:e.type==='complete'?'stage':'echo'}));
 const sub=Object.fromEntries(LIVING_MOMENTS.map(m=>{const g=new THREE.Group();g.name=m.title;g.visible=false;group.add(g);return [m.id,g];}));
 let latest={position:V(0,-999,0),motion:{},listening:false},nearest=null,firstClue=false,disposed=false,elapsed=0,fishGather=0,fireGather=0,formationWeight=0,initialized=false;
 const birdFocus=birds.clone().add(V(0,2.2,0));
 const flightHeading=forest.path.getTangentAt(.665).setY(0).normalize(),previousPlayer=V(),playerDelta=V();let hasPreviousPlayer=false;
 const riverFlow=forest.path.getTangentAt(.215).setY(0).normalize(),riverRight=V(-riverFlow.z,0,riverFlow.x),fishTarget=V();
 const mt=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
 const fishMat=mt({vertexColors:true,roughness:.36,metalness:.34,side:THREE.DoubleSide});
 fishMat.onBeforeCompile=s=>{s.uniforms.uLivingTime=clock;s.vertexShader='uniform float uLivingTime;varying vec3 vLivingLocal;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLivingLocal=position;float phase=instanceMatrix[3].x*3.+instanceMatrix[3].z*2.;transformed.x+=sin(uLivingTime*7.+position.z*12.+phase)*smoothstep(-.16,.55,position.z)*.052;');s.fragmentShader='varying vec3 vLivingLocal;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float side=atan(vLivingLocal.y/.12,abs(vLivingLocal.x)/.085);
 float row=floor(vLivingLocal.z*68.);vec2 tile=vec2(fract(vLivingLocal.z*68.),fract(side*13.+mod(row,2.)*.5));
 float edge=smoothstep(.43,.49,length((tile-.5)*vec2(.85,1.)));float scaleZone=smoothstep(-.25,-.17,vLivingLocal.z)*(1.-smoothstep(.22,.34,vLivingLocal.z))*smoothstep(.025,.055,abs(vLivingLocal.x));
 diffuseColor.rgb*=1.-edge*.17*scaleZone;diffuseColor.rgb+=vec3(.035,.045,.029)*pow(max(0.,1.-length(tile-.45)*2.),5.)*scaleZone;
 `);};fishMat.customProgramCacheKey=()=> 'v6-living-fish-scales';
 const birdMat=mt({vertexColors:true,roughness:.79,metalness:.02,side:THREE.DoubleSide});
 birdMat.onBeforeCompile=s=>{s.uniforms.uLivingTime=clock;s.uniforms.uBirdLift=birdLift;s.vertexShader='uniform float uLivingTime;uniform float uBirdLift;attribute float aWing;\n'+s.vertexShader;const deform='float phase=uLivingTime*(4.9+uBirdLift*1.6)+instanceMatrix[3].x*.7;float angle=(.12+sin(phase)*(.24+uBirdLift*.43))*aWing;float ca=cos(angle),sa=sin(angle);';s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+deform+'objectNormal.xy=mat2(ca,-sa,sa,ca)*objectNormal.xy;');s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 hinge=vec2(aWing*.1,.025);transformed.xy=mat2(ca,-sa,sa,ca)*(transformed.xy-hinge)+hinge;');};birdMat.customProgramCacheKey=()=> 'v6-living-birds';
 const fishGeo=creature('fish'),birdGeo=creature('bird');geometries.add(fishGeo);geometries.add(birdGeo);
 const school=new THREE.InstancedMesh(fishGeo,fishMat,32);school.name='Silver school · embodied encounter';school.frustumCulled=false;sub['river-mirror'].add(school);
 const flock=new THREE.InstancedMesh(birdGeo,birdMat,11);flock.name='Ivory passage · companion flock';flock.frustumCulled=false;flock.castShadow=true;sub['wing-passage'].add(flock);
 const birdDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});materials.add(birdDepth);flock.customDepthMaterial=birdDepth;
 birdDepth.onBeforeCompile=s=>{s.uniforms.uLivingTime=clock;s.uniforms.uBirdLift=birdLift;s.vertexShader='uniform float uLivingTime;uniform float uBirdLift;attribute float aWing;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat phase=uLivingTime*(4.9+uBirdLift*1.6)+instanceMatrix[3].x*.7;float angle=(.12+sin(phase)*(.24+uBirdLift*.43))*aWing;float ca=cos(angle),sa=sin(angle);vec2 hinge=vec2(aWing*.1,.025);transformed.xy=mat2(ca,-sa,sa,ca)*(transformed.xy-hinge)+hinge;');};birdDepth.customProgramCacheKey=()=> 'v6-living-bird-depth';
 const glowGeo=new THREE.BufferGeometry();glowGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(72*3),3));glowGeo.setAttribute('aSeed',new THREE.Float32BufferAttribute(Array.from({length:72},(_,i)=>i*.618),1));geometries.add(glowGeo);
 const fireMat=new THREE.ShaderMaterial({uniforms:{uTime:clock,uStrength:{value:.4},uPixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.5)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:'uniform float uTime;uniform float uStrength;uniform float uPixelRatio;attribute float aSeed;varying float vGlow;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vGlow=(.45+.55*pow(.5+.5*sin(uTime*2.4+aSeed*8.),3.))*uStrength;gl_PointSize=clamp(100.*uPixelRatio/max(1.,-mv.z),2.,16.);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying float vGlow;void main(){float d=length(gl_PointCoord-.5)*2.;float a=(exp(-d*d*7.)+.4*exp(-d*d*65.))*vGlow;if(d>1.)discard;gl_FragColor=vec4(vec3(1.,.82,.31),a);}' });materials.add(fireMat);
 const sparks=new THREE.Points(glowGeo,fireMat);sparks.frustumCulled=false;sub['lantern-bough'].add(sparks);
 // Keep the light registered even at zero intensity: crossing a cell boundary
 // must not change NUM_POINT_LIGHTS and trigger whole-scene shader recompiles.
 const lantern=new THREE.PointLight('#e8c078',0,5,2);lantern.position.copy(bough).add(V(0,.6,0));group.add(lantern);
 // A few restrained rising bubbles identify the swimming hollow from the bank.
 const bubbleGeo=new THREE.SphereGeometry(.027,5,4);geometries.add(bubbleGeo);const bubbleMat=mt({color:'#cfeddf',transparent:true,opacity:.38,roughness:.15,metalness:.1});const bubbles=new THREE.InstancedMesh(bubbleGeo,bubbleMat,13);bubbles.frustumCulled=false;sub['river-mirror'].add(bubbles);
 const oldSchool=traversal.group?.getObjectByName('V4 · fork-tailed river school'),oldVisible=oldSchool?.visible;
 if(oldSchool)oldSchool.visible=false;

 function hint(id){const s=state.snapshot(id),m=latest.motion||{};
  if(s.reveal>0)return s.story;
  const where=bearing(id),again=s.done?'回信已珍藏。':'';
  if(id==='lantern-bough')return m.mode==='perched'?again+'收起脚步，开启倾听，让微光慢慢靠近。':`${where}枝头有微光。飞上根门歇脚枝，停栖后按 Q 倾听。`;
  if(id==='river-mirror')return m.mode==='diving'?again+'开启倾听，放慢游动，银鳞会围拢过来。':`${where}水下有银光。沿低岸入水，按 C 潜入，再安静倾听。`;
  if(s.invitation>=1)return '它们在等你展翼。保持倾听，起飞与鸟群同行。';
  return `${where}有低低的鸟鸣。停下脚步，按 Q 倾听它们的回应。`;
 }
 function bearing(id){const p=latest.position,c=centres[id],delta=c.clone().sub(p),distance=Math.round(delta.length());if(distance<2)return '';if(!latest.camera)return `${distance}米外，`;
  const f=latest.camera.getWorldDirection(V());f.y=0;f.normalize();const right=V(-f.z,0,f.x),angle=Math.atan2(delta.dot(right),delta.dot(f))*180/Math.PI,a=Math.abs(angle),side=angle<0?'左':'右';const word=a<25?'前方':a>150?'身后':side+(a>90?'后方':'前方');return `${word}${distance}米，`;
 }
 function avoidLens(point,radius){const c=latest.camera?.position;if(!c)return;const dy=Math.abs(point.y-c.y);if(dy>=radius)return;const dx=point.x-c.x,dz=point.z-c.z,d=Math.hypot(dx,dz),r=Math.sqrt(radius*radius-dy*dy);if(d<r){const n=d>.001?1/d:0;point.x+=(d>.001?dx*n:1)*(r-d);point.z+=(d>.001?dz*n:0)*(r-d);}}
 function leaveSubjectVisible(point){const c=latest.camera?.position;if(!c)return;const axis=lensAxis.copy(latest.position);axis.y+=.55;axis.sub(c);const length=axis.lengthSq();if(length<.01)return;const t=lensDelta.copy(point).sub(c).dot(axis)/length;if(t<0||t>1)return;const closest=lensClosest.copy(c).addScaledVector(axis,t),delta=lensDelta.copy(point).sub(closest),d=delta.length();if(d<.85){if(d>.001)delta.multiplyScalar(1/d);else delta.set(1,0,0);point.addScaledVector(delta,.85-d);}}
 function update(dt,time,input={}){
  if(disposed)return;latest={...latest,...input};const p=latest.position,m=latest.motion||{};dt=simulationDelta(dt);
  if(latest.playing){elapsed+=dt;clock.value+=dt*(latest.reduced?.45:1);}
  if(input.adventure?.inventory?.carried||input.adventure?.stages?.[0]?.progress>0||input.adventure?.stages?.[0]?.done)firstClue=true;
  if(state.serialize().discovered.includes('lantern-bough'))firstClue=true;
  const list=LIVING_MOMENTS.map(def=>({id:def.id,distance:p.distanceTo(centres[def.id])})).sort((a,b)=>a.distance-b.distance);
  nearest=list.find(n=>n.distance<15&&(n.id!=='lantern-bough'||firstClue)&&!(n.id==='wing-passage'&&input.adventure?.challenge?.active))||null;
  state.update(dt,{...nearest,playing:latest.playing,listening:latest.listening,mode:m.mode,speed:m.speed||0});
  for(const id of Object.keys(sub))sub[id].visible=p.distanceTo(centres[id])<50;
  // Photo/atlas/menu camera movement must not re-arrange an animal formation.
  if(!latest.playing&&initialized)return;initialized=true;
  if(hasPreviousPlayer){playerDelta.copy(p).sub(previousPlayer).setY(0);if(playerDelta.lengthSq()>.0004&&playerDelta.lengthSq()<4)flightHeading.lerp(playerDelta.normalize(),1-Math.exp(-dt*3)).normalize();}previousPlayer.copy(p);hasPreviousPlayer=true;
  const t=clock.value,fr=state.snapshot('lantern-bough'),sr=state.snapshot('river-mirror'),br=state.snapshot('wing-passage');
  if(oldSchool)oldSchool.visible=false; // traversal's update otherwise re-enables it.
  const calm=latest.listening?1:0,ease=latest.playing?1-Math.exp(-dt*2):0;
  fireGather=lerp(fireGather,fr.reveal>0?smooth(0,2,fr.reveal):fr.progress,ease);
  fireMat.uniforms.uStrength.value=(fr.reveal>0?.95:.34)+calm*.15;lantern.intensity=fr.reveal>0?.32:0;
  if(sub['lantern-bough'].visible)for(let i=0;i<72;i++){
   const a=i*2.399+t*(.08+(i%5)*.018),h=(i%18)/18,r=lerp(1.3+(i%6)*.31,.65+Math.sin(h*Math.PI)*.8,fireGather);
   const x=bough.x+Math.sin(a)*r,y=bough.y-.2+h*2.8+Math.sin(t*.55+i)*.15,z=bough.z+Math.cos(a)*r;
   glowGeo.attributes.position.setXYZ(i,x,y,z);
  }glowGeo.attributes.position.needsUpdate=true;sparks.geometry.setDrawRange(0,latest.quality==='low'?40:72);
  fishGather=lerp(fishGather,sr.reveal>0?smooth(0,2,sr.reveal):sr.progress*.8,ease);
  const gather=fishGather;
  const fishCount=latest.quality==='low'?20:32;
  if(sub['river-mirror'].visible)for(let i=0;i<fishCount;i++){
   const a=t*(.27+gather*.12)+i*2.399,r=2.1+(i%5)*.4,x=pool.x+Math.sin(a)*r,z=pool.z+Math.cos(a)*r;
   dummy.position.set(x,pool.y-.25-(i%3)*.18+Math.sin(t*.9+i)*.09,z);
   fishTarget.copy(p).addScaledVector(riverFlow,1.4+Math.cos(a)*(1.05+(i%2)*.2)).addScaledVector(riverRight,Math.sin(a)*(2.1+(i%4)*.22));fishTarget.y=dummy.position.y;
   dummy.position.lerp(fishTarget,gather*(i%6===0?.48:1));
   const away=awayFromPlayer.copy(dummy.position).sub(p),fear=(1-smooth(.5,2.1,away.length()))*(m.speed>1.1||!latest.listening?1:0);if(fear>0)dummy.position.addScaledVector(away.normalize(),fear*.7);
   leaveSubjectVisible(dummy.position);avoidLens(dummy.position,2.25);const bed=traversal.groundAt?traversal.groundAt(dummy.position):traversal.sample(dummy.position).groundHeight;dummy.position.y=Math.min(-.6,Math.max(bed+.22,dummy.position.y));
   const fx=riverRight.x*Math.cos(a)*2.1-riverFlow.x*Math.sin(a)*1.05,fz=riverRight.z*Math.cos(a)*2.1-riverFlow.z*Math.sin(a)*1.05,yawBase=Math.atan2(-Math.cos(a),Math.sin(a)),yawFlow=Math.atan2(-fx,-fz);
   dummy.rotation.set(0,yawBase+Math.atan2(Math.sin(yawFlow-yawBase),Math.cos(yawFlow-yawBase))*gather,Math.sin(t*1.3+i)*.025);dummy.scale.setScalar(.56+(i%5)*.055);dummy.updateMatrix();school.setMatrixAt(i,dummy.matrix);
  }school.instanceMatrix.needsUpdate=true;school.count=fishCount;
  if(sub['river-mirror'].visible)for(let i=0;i<13;i++){const phase=(t*.22+i*.077)%1;dummy.position.set(pool.x+Math.sin(i*4.7)*1.1,-1.6+phase*1.35,pool.z+Math.cos(i*2.9)*1.3);dummy.rotation.set(0,0,0);dummy.scale.setScalar(.6+Math.sin(phase*Math.PI)*.9);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);}bubbles.instanceMatrix.needsUpdate=true;
  const follow=br.reveal>0?smooth(0,2,br.reveal):!br.done?br.invitation*.45:0,flockCenter=birds.clone(),airborne=['flying','gliding','rising'].includes(m.mode);
  if(follow>0){flockCenter.lerp(p,follow*.8);flockCenter.y=lerp(birds.y+2.2,Math.max(birds.y+3.4,p.y+1.8),follow);}
  else flockCenter.y=birds.y+2.2;
  birdFocus.lerp(flockCenter,ease);birdLift.value=follow;formationWeight=lerp(formationWeight,airborne?smooth(.35,.9,follow):0,ease);const flightRight=V(-flightHeading.z,0,flightHeading.x),formationBlend=formationWeight;
  if(sub['wing-passage'].visible)for(let i=0;i<11;i++){
   const a=t*(.26+(i%4)*.013)+i*2.399,r=follow>0?3.1+(i%3)*.4:2.2+(i%3)*.5;
   dummy.position.copy(birdFocus).add(V(Math.sin(a)*r,Math.sin(a*2+i)*.28+(i%3)*.23,Math.cos(a)*r*.75));
   if(formationBlend>0){const row=Math.floor((i+1)/2),side=i===0?0:i%2?-1:1,target=p.clone().addScaledVector(flightHeading,7-row*.8).addScaledVector(flightRight,side*(.8+row*.65));target.y=Math.max(birds.y+3,p.y+1.35)+row*.22+Math.sin(t+i)*.1;dummy.position.lerp(target,formationBlend);}
   avoidLens(dummy.position,2.25);const yaw0=Math.atan2(-Math.cos(a),Math.sin(a)*.75),yaw1=Math.atan2(-flightHeading.x,-flightHeading.z),angle=yaw0+Math.atan2(Math.sin(yaw1-yaw0),Math.cos(yaw1-yaw0))*formationBlend;
   dummy.rotation.set(airborne&&follow>0?-.08:0,angle,Math.sin(a)*.12*(1-formationBlend));dummy.scale.setScalar(.62+(i%3)*.10);dummy.updateMatrix();flock.setMatrixAt(i,dummy.matrix);
  }flock.instanceMatrix.needsUpdate=true;flock.count=latest.quality==='low'?7:11;
 }
 function snapshot(){const moments=state.all();return {completed:moments.filter(m=>m.done).length,total:3,moments: moments.map(m=>({...m,position:m.discovered?centres[m.id].toArray():null})),nearest:nearest?{...state.snapshot(nearest.id),hint:hint(nearest.id),distance:nearest.distance,position:centres[nearest.id].toArray()}:null};}
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());if(oldSchool)oldSchool.visible=oldVisible;}
 return {group,update,snapshot,serialize:state.serialize,restore(data){state.restore(data);firstClue=state.serialize().discovered.includes('lantern-bough');fishGather=fireGather=formationWeight=0;initialized=hasPreviousPlayer=false;birdFocus.copy(birds).y+=2.2;},reset(){state.reset();firstClue=false;nearest=null;initialized=hasPreviousPlayer=false;elapsed=fishGather=fireGather=formationWeight=clock.value=0;birdFocus.copy(birds).y+=2.2;},dispose,debug:()=>({moments:LIVING_MOMENTS.map(m=>({...m,position:centres[m.id].toArray()})),branchId:branch?.id,drawCalls:4,shadowDraws:1,triangles:{fish:fishGeo.attributes.position.count/3,bird:birdGeo.attributes.position.count/3}})};
}
