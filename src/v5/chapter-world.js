import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRiverReflection } from '../v6/world-water.js';
import { dawnLighting } from '../v6/dawn-lighting.js';
import { createLivingLandscape } from '../v6/world-details.js';
import { createMicroclimate } from '../v7/microclimate.js';
import { CHAPTERS, CHAPTER_HEROES, CHAPTER_KILNS } from './chapter-data.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const colourKeys=['sky','fog','sunColor','hemiSky','hemiGround'];
const numberKeys=['fogNear','fogFar','sunIntensity','hemiIntensity','environmentIntensity','exposure','night'];
const blendColour=new THREE.Color();
export function chapterLighting(progress){
 const f=clamp(Number(progress)||0,0,1),current=CHAPTERS.find(c=>f<c.to)||CHAPTERS.at(-1),result={...current};
 for(let i=1;i<CHAPTERS.length;i++){
  const edge=CHAPTERS[i].from;if(Math.abs(f-edge)>.035)continue;
  const a=CHAPTERS[i-1],b=CHAPTERS[i],t=THREE.MathUtils.smoothstep(f,edge-.035,edge+.035);
  for(const key of colourKeys)result[key]='#'+blendColour.set(a[key]).lerp(new THREE.Color(b[key]),t).getHexString();
  for(const key of numberKeys)result[key]=THREE.MathUtils.lerp(a[key],b[key],t);
 }
 return result;
}

// The main renderer owns background, fog and the key lights. This component
// supplies their continuous art direction and owns only local chapter assets.
export function createChapterWorld({scene,forest,traversal}){
 const group=new THREE.Group();group.name='V6 · 五境环境';scene.add(group);
 const living=createLivingLandscape({scene,forest,traversal}),reflection=createRiverReflection({scene,forest}),microclimate=createMicroclimate({scene,forest});
 const geometries=new Set(),materials=new Set(),textures=new Set(),cells=[],animations=[],loadErrors=[],replacedPlants=[];
 const L=forest.length,dummy=new THREE.Object3D(),clock={value:0},restoration={value:0},night={value:0},playerUniform={value:V(1000,0,1000)};
 const riverMaterial=forest.group.getObjectByName('Reflective winding river')?.material;
 const originalRiverSky=riverMaterial?.uniforms?.uSky?.value.clone(),originalRiverDeep=riverMaterial?.uniforms?.uDeep?.value.clone(),dayWater=new THREE.Color('#123b37'),nightWater=new THREE.Color('#102c3b');
 let seed=562919,disposed=false,assetsLoaded=0,quality='high';
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),r=(a,b)=>a+(b-a)*random();
 const geo=g=>(geometries.add(g),g),mat=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
 const tangent=f=>forest.path.getTangentAt(clamp(f,0,1)),right=f=>{const t=tangent(f);return V(-t.z,0,t.x);};
 const at=(f,side=0)=>forest.sample(f*L).addScaledVector(right(f),side);
 const ground=p=>forest.sampleGround(p.x,p.z);
 const cell=(name,f)=>{const g=new THREE.Group();g.name=name;group.add(g);const c={group:g,f,centre:at(f),distance:Infinity};cells.push(c);return c;};
 const mesh=(geometry,material,parent,p=V(),scale=V(1,1,1))=>{const o=new THREE.Mesh(geo(geometry),material);o.position.copy(p);o.scale.copy(scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const merge=parts=>{const normalized=parts.map(g=>g.index?g.toNonIndexed():g),result=geo(mergeGeometries(normalized,false));for(const g of new Set([...parts,...normalized]))g.dispose();return result;};
 const cylinder=(a,b,radius,sides=6)=>{const g=new THREE.CylinderGeometry(radius*.7,radius,a.distanceTo(b),sides);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().lerp(b,.5).toArray());return g;};
 const tube=(points,radius,steps=16,sides=5)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),steps,radius,sides,false);
 function batch(geometry,material,list,parent,name){if(!list.length)return null;geo(geometry);const o=new THREE.InstancedMesh(geometry,material,list.length);o.name=name;for(let i=0;i<list.length;i++){const t=list[i];dummy.position.copy(t.p);dummy.scale.copy(t.s||V(1,1,1));dummy.rotation.set(t.rx||0,t.ry||0,t.rz||0);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(t.colour)o.setColorAt(i,t.colour);}o.computeBoundingSphere();o.receiveShadow=true;o.userData.fullCount=list.length;parent.add(o);return o;}
 let barkBase=forest.surfaces?.bark,rockBase=forest.surfaces?.rock;forest.group.traverse(o=>{const src=o.material?.map?.image?.src||'';if(!barkBase&&src.includes('bark_brown'))barkBase=o.material;if(!rockBase&&src.includes('rock_boulder'))rockBase=o.material;});
 const wood=mat({map:barkBase?.map,normalMap:barkBase?.normalMap,normalScale:new THREE.Vector2(.75,.75),color:'#a89d85',roughness:.92});
 const rootMat=mat({map:barkBase?.map,normalMap:barkBase?.normalMap,color:'#858879',roughness:.97});
 const reedMat=mat({color:'#858d68',roughness:.81,side:THREE.DoubleSide});
 const plumeMat=mat({color:'#cfc8ab',roughness:.85,side:THREE.DoubleSide});
 const fungusMat=mat({color:'#ba986c',roughness:.93});
 const clay=mat({map:rockBase?.map,normalMap:rockBase?.normalMap,normalScale:new THREE.Vector2(.3,.3),color:'#ae8865',roughness:.97,side:THREE.DoubleSide});
 clay.onBeforeCompile=s=>{s.vertexShader='varying vec3 vKilnLocal;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKilnLocal=position;');s.fragmentShader='varying vec3 vKilnLocal;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float grain=fract(sin(dot(floor(vKilnLocal*220.),vec3(12.9898,78.233,37.719)))*43758.5453);
 float scorch=(1.-smoothstep(.1,1.25,vKilnLocal.y))*.30;
 diffuseColor.rgb*=.81+grain*.20-scorch;`);};
 clay.customProgramCacheKey=()=> 'v5-fired-clay';
 const coal=mat({color:'#241d18',emissive:'#b63f13',emissiveIntensity:.28,roughness:1});
 const innerClay=mat({map:rockBase?.map,normalMap:rockBase?.normalMap,color:'#55493c',roughness:1,side:THREE.DoubleSide});
 const glow=mat({color:'#dcb26c',emissive:'#c47b27',emissiveIntensity:.5,roughness:.7});
 const rockBack=mat({map:rockBase?.map,normalMap:rockBase?.normalMap,normalScale:new THREE.Vector2(.7,.7),color:'#9d9d8f',roughness:.93,side:THREE.DoubleSide});
 // The horizon colour equals distance fog. The zenith then changes above the
 // tree line, avoiding the old hard silhouette between terrain and flat sky.
 const skyMat=new THREE.ShaderMaterial({uniforms:{uHorizon:{value:new THREE.Color(CHAPTERS[0].fog)},uZenith:{value:new THREE.Color(CHAPTERS[0].sky)},uTime:clock,uNight:night},vertexShader:'varying vec3 vSkyDirection;void main(){vSkyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uTime;uniform float uNight;varying vec3 vSkyDirection;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec3 d=normalize(vSkyDirection);float h=smoothstep(.02,.6,d.y);vec3 col=mix(uHorizon,uZenith,h);vec2 uv=d.xz/max(.16,d.y+.22);float n=noise(uv*2.1+vec2(uTime*.0015,0.))*.60+noise(uv*5.3)*.27+noise(uv*11.1)*.13;float cloud=smoothstep(.53,.76,n)*smoothstep(.015,.19,d.y);col=mix(col,mix(vec3(.88,.87,.80),vec3(.35,.43,.51),uNight),cloud*.22);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,side:THREE.BackSide,depthWrite:false,fog:false});
 skyMat.fragmentShader=skyMat.fragmentShader.replaceAll('#include','\n#include');materials.add(skyMat);const sky=mesh(new THREE.SphereGeometry(120,40,24),skyMat,group);sky.name='Continuous fog horizon and layered cloud sky';sky.renderOrder=-100;sky.castShadow=sky.receiveShadow=false;sky.frustumCulled=false;
 function windMaterial(material,strength){material.onBeforeCompile=s=>{s.uniforms.uChapterTime=clock;s.vertexShader='uniform float uChapterTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 #ifdef USE_INSTANCING
 vec3 wp=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
 transformed.x+=sin(uChapterTime*.77+wp.x*.45+wp.z*.21)*position.y*position.y*${strength};
 transformed.z+=cos(uChapterTime*.62+wp.z*.31)*position.y*${strength*.55};
 #endif`);};material.customProgramCacheKey=()=>`v5-grass-${strength}`;}
 windMaterial(reedMat,.035);windMaterial(plumeMat,.035);

 // Root curtains are an asymmetrical frame; the central arch and leftward
 // path remain visibly open. Shelf fungi give a readable near-field scale.
 const roots=cell('01 · 根穹垂须与腐木',.078),rootParts=[],fungi=[];
 for(let i=0;i<30;i++){
  const strand=i%7,z=(strand-3)*.82,bend=.3*Math.sin(strand*2),curve=new THREE.CatmullRomCurve3([V(-5.9,5.9,-.2),V(-4.1,8.1,.1),V(-2.2,9.6,.65),V(.5,10.4,.2),V(2.4,11.5,-.8)]),t=tangent(.09),angle=Math.atan2(t.x,t.z);
  const p=curve.getPoint(r(.28,.86)).add(V(r(-.18,.18),-.12,r(-.25,.25))).applyAxisAngle(V(0,1,0),angle).add(at(.09)),len=Math.min(r(1.1,2.9),p.y-2.7);
  rootParts.push(tube([p,p.clone().add(V(.13,-len*.35,.17)),p.clone().add(V(.3,-len*.72,.23)),p.clone().add(V(.22,-len,.35))],r(.016,.042),12,5));
  if(i%3===0)for(let j=0;j<3;j++){const q=at(.085+r(-.008,.008),(i%2?1:-1)*r(5.4,6.5));q.y=ground(q)+.18+j*.18;fungi.push({p:q,s:V(r(.25,.48),r(.06,.10),r(.2,.36)),ry:r(0,6.28)});}
 }
 mesh(merge(rootParts),rootMat,roots.group).castShadow=false;
 batch(new THREE.SphereGeometry(1,14,7,0,Math.PI*2,0,Math.PI*.53),fungusMat,fungi,roots.group,'Bracket fungi at old roots');

 // A reed clump has folded blades and tapered plume barbs, not a flat bush.
 const reedParts=[],plumeParts=[];
 for(let i=0;i<4;i++){
  const a=i*2.399,h=1.55+i*.14,b=V(Math.cos(a)*.13,0,Math.sin(a)*.13),top=b.clone().add(V(.15,h,.04));
  reedParts.push(cylinder(b,top,.013,5));
  for(let j=0;j<3;j++){
   const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.045,.21,-.035,.53,.025,.72);shape.bezierCurveTo(.065,.45,.06,.17,0,0);
   const leaf=new THREE.ShapeGeometry(shape,5);leaf.rotateZ((j%2?1:-1)*(.5+j*.15));leaf.rotateY(a+j);leaf.translate(b.x,.3+j*.28,b.z);reedParts.push(leaf);
  }
  plumeParts.push(cylinder(top.clone().add(V(0,-.05,0)),top.clone().add(V(.08,.48,.04)),.018,5));
  for(let j=0;j<11;j++)for(const side of [-1,1]){
   const y=j/11*.44,w=Math.sin((j+1)/13*Math.PI)*.13,g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute([top.x,top.y+y,top.z,top.x+side*w,top.y+y+.055,top.z+.015,top.x+.045,top.y+y+.10,top.z+.03],3));
   g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));g.computeVertexNormals();g.rotateY(a);plumeParts.push(g);
  }
 }
 const reedGeo=merge(reedParts),plumeGeo=merge(plumeParts);
 for(const [name,a,b,count] of [['02 · 银芦前汀',.17,.245,175],['02 · 银芦后汀',.245,.33,150],['05 · 暮湾芦影',.785,.885,100],['05 · 夕照湾口',.89,.97,85]]){
  const c=cell(name,(a+b)/2),list=[];
  for(let i=0;i<count;i++){
   const f=r(a,b),d=f*L,centre=10.5+2*Math.sin(d*.027),half=f<.31?6.1:3.6,p=at(f,centre+(i%3===0?1:-1)*(half+r(-.4,1.1))),y=ground(p);
   if(y<-.55||y>.55)continue;if(f>.185&&f<.23&&i%4===0)continue;
   if(Math.sin(p.x*.62+p.z*.35)+Math.sin(p.z*.24)<-.35)continue;
   p.y=y-.035;const s=r(.58,1.24);list.push({p,s:V(s,s*r(.65,1.1),s),ry:r(0,6.28),colour:new THREE.Color().setHSL(r(.12,.18),r(.10,.22),r(.48,.72))});
  }
  batch(reedGeo,reedMat,list,c.group,'Folded silver reeds');batch(plumeGeo,plumeMat,list,c.group,'Fine reed plumes');
 }

 // Smoke/fog uses a handful of soft volumetric-looking cards. No opaque
 // loading veil and no depth-writing edges across the player's route.
 function atmosphere(parent,centre,size,colour,opacity,speed=.08){
  const m=new THREE.ShaderMaterial({uniforms:{uTime:clock,uColour:{value:new THREE.Color(colour)},uOpacity:{value:opacity}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uTime;uniform vec3 uColour;uniform float uOpacity;varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  void main(){vec2 p=vUv*2.-1.;float rim=pow(max(0.,1.-dot(p,p)),2.2);vec2 drift=vUv*vec2(3.8,3.4)-vec2(uTime*${speed*.2},uTime*${speed});float curls=noise(drift)*.64+noise(drift*2.3+4.)*.26+noise(drift*5.2)*.1;gl_FragColor=vec4(uColour,rim*smoothstep(.2,.78,curls)*uOpacity);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  m.fragmentShader=m.fragmentShader.replaceAll('#include','\n#include');materials.add(m);const o=mesh(new THREE.PlaneGeometry(size.x,size.y),m,parent,centre);o.castShadow=o.receiveShadow=false;animations.push({kind:'billboard',object:o});return o;
 }
 // V7's sparse waterline strata replace the former three overlapping cards.

 // Two small scoop-like pottery kilns and drying furniture are interpretive
 // domestic impressions, not a claim to reconstruct an excavated building.
 function kilnShell(inset=0){
  const positions=[],uv=[],indices=[],columns=72,rows=22,rx=1.42-inset,h=1.5-inset,rz=1.62-inset;
  // Each radial strip ends on the exact mouth arch. There are no deleted
  // coarse triangles, serrated cutout edges, or alpha holes at the entrance.
  for(let i=0;i<=columns;i++){const phi=-Math.PI+i/columns*Math.PI*2,opening=Math.abs(phi)<.50?.80*Math.sqrt(Math.max(0,1-(phi/.50)**2)):0,thetaMax=Math.acos(clamp(opening/h,0,1));for(let j=0;j<=rows;j++){const theta=j/rows*thetaMax,x=rx*Math.sin(theta)*Math.sin(phi),y=h*Math.cos(theta),z=rz*Math.sin(theta)*Math.cos(phi);positions.push(x,y,z);uv.push(i/columns*2,j/rows);if(i<columns&&j<rows){const a=i*(rows+1)+j,b=a+rows+1;indices.push(a,a+1,b,a+1,b+1,b);}}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const potProfile=[[.12,0],[.24,.06],[.36,.23],[.39,.46],[.30,.64],[.20,.70],[.22,.77],[.18,.80],[.155,.76],[.17,.70],[.25,.61],[.34,.45],[.32,.23],[.20,.10]].map(p=>new THREE.Vector2(...p));
 const potGeo=geo(new THREE.LatheGeometry(potProfile,28));
 for(const a of CHAPTER_KILNS){
  const c=cell('04 · '+a.id+' 陶火生活记忆',a.fraction),p=at(a.fraction,a.side);p.y=ground(p);const kiln=new THREE.Group();kiln.name='Scoop kiln · artistic interpretation';kiln.position.copy(p);kiln.rotation.y=Math.atan2(right(a.fraction).x,right(a.fraction).z)+a.yaw;kiln.scale.setScalar(a.scale);c.group.add(kiln);
  mesh(kilnShell(),clay,kiln);
  mesh(kilnShell(.10),innerClay,kiln);
  const mouth=[];for(let i=0;i<=32;i++){const phi=-.5+i/32,opening=.8*Math.sqrt(Math.max(0,1-(phi/.5)**2)),theta=Math.acos(opening/1.5);mouth.push(V(1.42*Math.sin(theta)*Math.sin(phi),opening,1.62*Math.sin(theta)*Math.cos(phi)));}
  mesh(tube(mouth,.075,40,7),clay,kiln);
  const floor=mesh(new THREE.CircleGeometry(1.35,32),clay,kiln,V(0,.018,0));floor.rotation.x=-Math.PI/2;
  const coals=[];for(let i=0;i<25;i++)coals.push({p:V(r(-.55,.55),r(.03,.10),r(.25,1.18)),s:V(r(.07,.18),r(.035,.075),r(.08,.15)),ry:r(0,6.28)});
  batch(new THREE.IcosahedronGeometry(1,1),coal,coals,kiln,'Low embers inside the mouth');
  const light=new THREE.PointLight('#ffab62',.85,5,2);light.position.set(0,.4,1.0);kiln.add(light);animations.push({kind:'fire',object:light});
  // Thin posts and a woven drying shelf sit against the kiln's protected back.
  const rackParts=[];for(const x of [-.95,.95])for(const z of [-2.3,-3.0])rackParts.push(cylinder(V(x,0,z),V(x,1.05,z),.048));
  for(let z=-3.05;z< -2.2;z+=.09)rackParts.push(cylinder(V(-1.06,.88,z),V(1.06,.88,z),.018,4));
  for(const x of [-.95,.95])rackParts.push(cylinder(V(x,.86,-3.08),V(x,.86,-2.2),.045));
  mesh(merge(rackParts),wood,kiln);
  const pots=[];for(let i=0;i<6;i++)pots.push({p:V(-.78+(i%3)*.76,.9,-2.48-Math.floor(i/3)*.35),s:V(.42,.42,.42),ry:r(0,6.28)});
  batch(potGeo,clay,pots,kiln,'Thrown clay drying on the rack');
  const smoke=p.clone().add(V(.2,2.4,0));atmosphere(c.group,smoke,V(2.4,4.8),'#b9b1a1',.14,.2);
  if(a.id==='kiln-a')traversal.landmarks.push({id:'pottery-court-v5',label:'陶火与泥土',name:'陶火与泥土',position:p.clone(),type:'culture',detail:'泥土经火，成为盛水、储粮和日常使用的器物。晾架上的陶坯与窑口的余温，让这段记忆不只属于珍贵金玉，也属于普通人的劳动。',evidence:'馆方资料介绍金沙发现的小型陶窑约六平方米、前低后高，形似撮箕，并讨论家庭制陶与集中生产的可能。这里的窑体、晾架和摆放关系为文化主题的艺术演绎。',source:'https://www.jinshasitemuseum.com/info/706'});
 }

 // A few small field birds are readable animated silhouettes, keeping the
 // marsh alive without collecting dozens of independent draw calls.
 const birds=cell('02 · 掠水鸟影',.245),birdShape=new THREE.BufferGeometry();
 birdShape.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.2,-.68,.04,-.06,-.25,.02,-.18,0,0,.2,.25,.02,-.18,.68,.04,-.06,0,.04,.27,-.07,0,-.22,.07,0,-.22],3));birdShape.computeVertexNormals();
 const birdMat=mat({color:'#b8c1b2',roughness:.9,side:THREE.DoubleSide});
 birdMat.onBeforeCompile=s=>{s.uniforms.uChapterTime=clock;s.vertexShader='uniform float uChapterTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=abs(position.x)*sin(uChapterTime*5.5+instanceMatrix[3].x)*.46;');};birdMat.customProgramCacheKey=()=> 'v5-marsh-birds';
 const birdList=Array.from({length:6},()=>({p:V(),s:V(.65,.65,.65)})),birdBatch=batch(birdShape,birdMat,birdList,birds.group,'Six distant waterbirds');birdBatch.frustumCulled=false;birdBatch.receiveShadow=false;animations.push({kind:'birds',object:birdBatch,centre:at(.24,13)});

 function moteCloud(c,count,colour,brightness=.7){
  const positions=[],phases=[];for(let i=0;i<count;i++){const f=clamp(c.f+r(-.045,.045),0,1),p=at(f,r(-10,15));p.y=Math.max(ground(p),-.2)+r(.3,3.2);positions.push(...p.toArray());phases.push(r(0,6.28),r(.65,1.35));}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,2));
  const m=new THREE.ShaderMaterial({uniforms:{uTime:clock,uRestored:restoration,uNight:night,uColour:{value:new THREE.Color(colour)},uBrightness:{value:brightness}},vertexShader:`uniform float uTime;attribute vec2 aPhase;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.31+aPhase.x)*.3;p.y+=sin(uTime*.7+aPhase.x)*.18;p.z+=cos(uTime*.21+aPhase.x)*.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(26.*aPhase.y/(-mv.z),1.2,5.);vAlpha=.28+.72*pow(.5+.5*sin(uTime*1.5+aPhase.x),2.);}`,fragmentShader:`uniform vec3 uColour;uniform float uRestored;uniform float uNight;uniform float uBrightness;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),1.8)*vAlpha*uBrightness*(.45+uNight*.55+uRestored*.2);gl_FragColor=vec4(uColour,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  m.fragmentShader=m.fragmentShader.replaceAll('#include','\n#include');materials.add(m);const o=new THREE.Points(g,m);c.group.add(o);return o;
 }
 moteCloud(roots,48,'#c7dc9a',.55);
 moteCloud(cell('04 · 稻火微光',.585),72,'#eac182',.8);
 moteCloud(cell('05 · 暮湾萤迹',.825),96,'#dfbd72',1);
 moteCloud(cell('05 · 日轮余辉',.945),78,'#eed095',1);

 // CC0 scans are shared templates: two texture sets, seven placements. Local
 // fallback silhouettes remain visible if an asset cannot load, with errors
 // exposed in stats rather than breaking entry to the chapter.
 const heroSlots=[];
 for(const a of CHAPTER_HEROES){
  const c=cell('Hero · '+a.id,a.fraction),p=at(a.fraction,a.side);p.y=ground(p)-.05;
  const holder=new THREE.Group();holder.name=a.id;holder.position.copy(p);holder.rotation.y=Math.atan2(right(a.fraction).x,right(a.fraction).z)+a.yaw;c.group.add(holder);
  const fallbackGeo=a.asset==='rock_face_01'?new THREE.BoxGeometry(a.width,a.height,a.width*.42,3,2,2):new THREE.CylinderGeometry(a.width*.18,a.width*.4,a.height,9,2);
  if(a.asset==='rock_face_01'){const p=fallbackGeo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+Math.sin(x*2.2+y*3.1)*.36);}fallbackGeo.computeVertexNormals();}
  const fallback=mesh(fallbackGeo,a.asset==='rock_face_01'?mat({map:rockBase?.map,normalMap:rockBase?.normalMap,color:'#8b8d83',roughness:.95}):wood,holder,V(0,a.height*.5,0));fallback.name='Asset loading silhouette';
  heroSlots.push({a,c,holder,fallback});
 }
 const loader=new GLTFLoader();
 const ready=Promise.allSettled(['rock_face_01','tree_stump_01','fern_02'].map(async asset=>{
  try{
   const loaded=await loader.loadAsync(`/assets/v5/${asset}/${asset}.gltf`);if(disposed){loaded.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])m[k]?.dispose();m.dispose();}}});return;}
   const template=loaded.scene,box=new THREE.Box3().setFromObject(template),size=box.getSize(V()),centre=box.getCenter(V());
   template.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material])){materials.add(m);m.roughness=Math.max(.85,m.roughness);m.metalness=0;m.normalScale?.set(.85,.85);for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[key]){m[key].anisotropy=4;textures.add(m[key]);}}o.castShadow=o.receiveShadow=true;}});
   if(asset==='fern_02'){
    const variants=[];let fernMaterial;
    template.traverse(o=>{if(o.isMesh){const g=geo(o.geometry.clone());g.scale(1.85,1.85,1.85);variants.push(g);fernMaterial=o.material;}});
    fernMaterial.color.set('#ced6b9');fernMaterial.emissive.set('#30451e');fernMaterial.emissiveIntensity=.12;fernMaterial.normalScale.set(.48,.48);fernMaterial.roughness=.86;
    fernMaterial.onBeforeCompile=s=>{s.uniforms.uChapterTime=clock;s.uniforms.uChapterPlayer=playerUniform;s.vertexShader='uniform float uChapterTime;uniform vec3 uChapterPlayer;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     #ifdef USE_INSTANCING
     vec3 wp=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;vec2 away=wp.xz-uChapterPlayer.xz;
     float playerNear=(1.-smoothstep(.3,1.5,length(away)))*(1.-smoothstep(1.,2.5,abs(wp.y-uChapterPlayer.y)));
     transformed.xz+=position.y*position.y*(vec2(sin(uChapterTime*.8+wp.x*.5+wp.z*.3)*.085,cos(uChapterTime*.65+wp.z*.4)*.055)+normalize(away+vec2(.001))*playerNear*.26);
     #endif`);};fernMaterial.customProgramCacheKey=()=> 'v5-scanned-responsive-fern';
    let index=0;scene.traverse(o=>{if(!o.isInstancedMesh||!['Procedural fern instances','Responsive broadleaf understory'].includes(o.name))return;const small=o.name==='Responsive broadleaf understory';replacedPlants.push({object:o,geometry:o.geometry,material:o.material,name:o.name});o.geometry=variants[small?2+(index++%2):index++%variants.length];o.material=fernMaterial;o.name='CC0 detailed fern instances';o.computeBoundingSphere();});
   }
   for(const slot of heroSlots.filter(s=>s.a.asset===asset)){
    const model=template.clone(true),a=slot.a,scale=a.width/Math.max(size.x,size.z),sy=a.height/size.y;model.scale.set(scale,sy,scale);model.position.set(-centre.x*scale,-box.min.y*sy-.16,-centre.z*scale);model.name='CC0 scan · '+asset;slot.holder.add(model);model.traverse(o=>{if(o.isMesh){o.userData.cameraOccluder=true;forest.cameraColliders.push(o);}});slot.fallback.visible=false;
    if(asset==='rock_face_01'){
     // Close an open photogrammetry patch down to the soil, so its edge never
     // reads as a floating sheet when approached from the side or above.
     const edges=new Map(),skirt=[],uv=[];template.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index?.array||Array.from({length:p.count},(_,i)=>i);for(let i=0;i<index.length;i+=3)for(const [a,b] of [[index[i],index[i+1]],[index[i+1],index[i+2]],[index[i+2],index[i]]]){const key=a<b?a+':'+b:b+':'+a,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1,p});}});
     for(const e of edges.values()){if(e.count!==1)continue;const a=V((e.p.getX(e.a)-centre.x)*scale,(e.p.getY(e.a)-box.min.y)*sy-.16,(e.p.getZ(e.a)-centre.z)*scale),b=V((e.p.getX(e.b)-centre.x)*scale,(e.p.getY(e.b)-box.min.y)*sy-.16,(e.p.getZ(e.b)-centre.z)*scale),c=V(a.x,-.45,a.z),d=V(b.x,-.45,b.z);for(const v of [a,c,b,b,c,d]){skirt.push(...v.toArray());uv.push((v.x+v.z)*.34,v.y*.34);}}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(skirt,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(g,rockBack,slot.holder).name='Closed earthward rock volume';
    }
   }
   assetsLoaded++;
  }catch(error){loadErrors.push(`${asset}: ${error.message}`);}
 }));

 let lastProgress=0,dawnAmount=0;
 function lighting(progress){return dawnLighting(chapterLighting(progress),dawnAmount,progress);}
 function update(dt,time,{position,camera,adventure,quality:value,reduced=false}={}){
  if(disposed)return;dawnAmount=adventure?.completed?(reduced?1:THREE.MathUtils.damp(dawnAmount,1,.38,dt)):0;if(value)quality=value==='low'?'low':'high';clock.value=reduced?0:time;
  forest.bamboo?.update(dt,time,position||camera?.position||at(.02),{camera,quality,reduced});microclimate.update(dt,time,{position:position||camera?.position||at(.02),camera,quality,reduced});living.update(dt,time,{position:position||camera?.position||at(.02),camera,quality,reduced});reflection.update(dt,time,{position:position||camera?.position||at(.02),camera,quality});
  const p=position||camera?.position||at(.02);playerUniform.value.copy(p);lastProgress=forest.project(p).distance/L;const light=lighting(lastProgress);night.value=light.night;
  sky.position.copy(camera?.position||p);skyMat.uniforms.uHorizon.value.set(light.fog);skyMat.uniforms.uZenith.value.set(light.sky);
  if(riverMaterial?.uniforms?.uSky){riverMaterial.uniforms.uSky.value.set(light.fog);riverMaterial.uniforms.uDeep.value.copy(dayWater).lerp(nightWater,light.night);}
  const completed=(adventure?.stages||[]).filter(s=>s.done).length;restoration.value=THREE.MathUtils.damp(restoration.value,completed/5,2,dt);
  const range=quality==='low'?48:69;
  for(const c of cells){c.distance=Math.min(c.centre.distanceTo(p),camera?c.centre.distanceTo(camera.position):Infinity);c.group.visible=c.distance<range&&Math.abs(c.f-lastProgress)<.24;for(const o of c.group.children)if(o.isInstancedMesh&&o.userData.fullCount)o.count=quality==='low'?Math.ceil(o.userData.fullCount*.55):o.userData.fullCount;}
  for(const a of animations){
   if(a.kind==='billboard'&&camera)a.object.quaternion.copy(camera.quaternion);
   if(a.kind==='fire')a.object.intensity=(quality==='low'?0:1)*(.78+(reduced?0:Math.sin(time*4.3)*.10+Math.sin(time*7.1)*.08));
   if(a.kind==='birds')for(let i=0;i<6;i++){const t=clock.value*.15+i*.16;dummy.position.copy(a.centre).add(V(Math.sin(t)*6+i*.42,4.8+Math.sin(clock.value*.4+i)*.2,Math.cos(t)*8+i*.25));dummy.rotation.set(0,Math.atan2(Math.cos(t)*6,-Math.sin(t)*8),Math.cos(t)*.08);dummy.scale.setScalar(.65);dummy.updateMatrix();a.object.setMatrixAt(i,dummy.matrix);a.object.instanceMatrix.needsUpdate=true;}
  }
 }
 function stats(){let activeDraws=0,triangles=0;group.traverseVisible(o=>{if(o.isMesh||o.isPoints){activeDraws++;if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {dawn:dawnAmount,reflection:reflection.stats(),living:living.stats(),microclimate:microclimate.stats(),quality,disposed,assetsLoaded,loadErrors:loadErrors.slice(),replacedPlantBatches:replacedPlants.length,activeCells:cells.filter(c=>c.group.visible).length,activeDraws,triangles:Math.round(triangles),region:chapterLighting(lastProgress).id};}
 function dispose(){reflection.dispose();living.dispose();microclimate.dispose();disposed=true;group.removeFromParent();if(originalRiverSky){riverMaterial.uniforms.uSky.value.copy(originalRiverSky);riverMaterial.uniforms.uDeep.value.copy(originalRiverDeep);}const place=traversal.landmarks.findIndex(p=>p.id==='pottery-court-v5');if(place>=0)traversal.landmarks.splice(place,1);for(const p of replacedPlants){p.object.geometry=p.geometry;p.object.material=p.material;p.object.name=p.name;p.object.computeBoundingSphere();}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 update(0,0,{position:forest.sample(0)});
 return {group,ready,update,lighting,dispose,stats,warmup:(renderer,camera)=>reflection.warmup?.(renderer,camera)};
}
