import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOMESTIC_HOUSE_SITE } from '../v2/world.js';
import { createCylinderIndex } from '../v8/cylinder-index.js';
import { PERCH_SITES } from '../v8/perch-sites.js';
import { createBranchGeometry as branch } from '../v8/branch-geometry.js';
import { createPerchLeafGeometry } from '../v8/perch-leaf.js';
import { createWaterSurface } from '../v9/water-surface.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
function random(seed){return()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);}

export function createTraversalWorld(scene,forest){
 const group=new THREE.Group();group.name='V3 · 水岸、风口与生活记忆';scene.add(group);
 const rand=random(631428),r=(a,b)=>a+rand()*(b-a),L=forest.length;
 const ownMaterials=new Set(),ownGeometries=new Set(),perches=[],perchVisuals=[],landmarks=[],solid=[],bridges=[],platforms=[],slabs=[],animated=[],cameraColliders=[];
 const tangent=d=>forest.path.getTangentAt(clamp(d/L,0,1));
 const right=d=>{const t=tangent(d);return V(-t.z,0,t.x);};
 const at=(fraction,lateral=0,y=0)=>forest.sample(L*fraction).addScaledVector(right(L*fraction),lateral).setY(y);
 const groundAt=p=>forest.sampleGround?forest.sampleGround(p.x,p.z):0;
 const findMaterial=predicate=>{let found;forest.group.traverse(o=>{if(!found&&o.isMesh&&predicate(o))found=o.material;});return found;};
 const woodBase=forest.surfaces?.bark||findMaterial(o=>o.material?.map?.image?.src?.includes('bark_brown'));
 const stoneBase=forest.surfaces?.rock||findMaterial(o=>o.material?.map?.image?.src?.includes('rock_boulder'));
 function mat(p){const m=new THREE.MeshStandardMaterial(p);ownMaterials.add(m);return m;}
 const wood=woodBase?woodBase.clone():mat({color:0x574936,roughness:.9});ownMaterials.add(wood);
 const darkWood=wood.clone();darkWood.color.set(0x3e4030);ownMaterials.add(darkWood);
 const stone=stoneBase?stoneBase.clone():mat({color:0x56766a,roughness:.88});ownMaterials.add(stone);
 const clay=mat({color:0x9b6647,roughness:.94}),reedMat=mat({color:0x566b35,roughness:.92,side:THREE.DoubleSide}),gold=mat({color:0xdcc084,emissive:0x8c6730,emissiveIntensity:.18,roughness:.44,metalness:.65}),fishMat=mat({vertexColors:true,metalness:.25,roughness:.66});
 // Keep the shared canopy shader and texture ownership with the forest.
 const leaf=forest.surfaces?.canopy||findMaterial(o=>o.material?.map?.image?.src?.includes('island-leaf-color'))||mat({color:0x73946b,roughness:.8,side:THREE.DoubleSide});
 clay.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vClayPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClayPosition=position;');shader.fragmentShader='varying vec3 vClayPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float clayGrain=fract(sin(dot(floor(vClayPosition*490.),vec3(127.1,311.7,74.7)))*43758.5453);
 float clayBand=sin(vClayPosition.y*130.+sin(vClayPosition.x*28.)*.4);
 float kilnMark=sin(vClayPosition.x*7.+vClayPosition.y*9.)*cos(vClayPosition.z*10.-vClayPosition.y*4.);
 diffuseColor.rgb*=.87+clayGrain*.15+clayBand*.025+kilnMark*.07;`);};
 function mesh(geo,material,parent=group,p=V(),scale=V(1,1,1)){ownGeometries.add(geo);const m=new THREE.Mesh(geo,material);m.position.copy(p);m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(material===wood||material===darkWood||material===stone){m.userData.cameraOccluder=true;cameraColliders.push(m);}return m;}
 function tube(points,radii,material=wood,parent=group,sides=8,steps=24){return mesh(branch(points,radii,sides,steps),material,parent);}
 function batch(geo,material,transforms,parent=group){ownGeometries.add(geo);const b=new THREE.InstancedMesh(geo,material,transforms.length),dummy=new THREE.Object3D();transforms.forEach((t,i)=>{dummy.position.copy(t.p);dummy.scale.copy(t.s||V(1,1,1));dummy.rotation.set(t.rx||0,t.ry||0,t.rz||0);dummy.updateMatrix();b.setMatrixAt(i,dummy.matrix);if(t.color)b.setColorAt(i,t.color);});b.computeBoundingSphere();b.castShadow=false;b.receiveShadow=true;parent.add(b);if(material===wood||material===darkWood||material===stone){b.userData.cameraOccluder=true;cameraColliders.push(b);}return b;}
 function register(id,label,position,type,detail,source='',evidence=''){landmarks.push({id,label,name:label,position:position.clone(),type,detail,source,evidence});}

 // Tangible branch forks: bark beneath the feet, leaves frame the perch rather than a floating pad.
 for(const [index,site] of PERCH_SITES.entries()){
  const siteRandom=random(831014+index*137),sr=site.legacy?r:(a,b)=>a+(b-a)*siteRandom();
  const {fraction,height}=site,side=Math.sign(site.side),origin=at(fraction,site.side+side*3.3),n=right(L*fraction).multiplyScalar(-side),base=groundAt(origin),treeHeight=site.legacy?9:height+2.3,trunkTop=origin.clone().add(V(.5,site.legacy?9:base+treeHeight,0));origin.y=base;
  const visual=new THREE.Group();visual.name=site.label+' · connected rest tree';group.add(visual);
  const trunkPoints=[origin,origin.clone().add(V(-.3,site.legacy?3:treeHeight*.44,.2)),trunkTop],trunkCurve=new THREE.CatmullRomCurve3(trunkPoints);
  tube(trunkPoints,site.legacy?[.74,.49,.16]:[.46,.31,.10],wood,visual,12,36).name='Perch host trunk';
  solid.push({type:'cylinder',x:origin.x,z:origin.z,r:site.legacy?.66:.52,bottom:base,top:base+treeHeight-.3,reason:'树干挡住了去路，绕过或飞向枝杈。'});
  const landing=origin.clone().addScaledVector(n,3.3);landing.y=site.legacy?height:base+height;
  // Branch attachment follows the actual bent host rather than its ground
  // origin; the landing target stays unchanged for saved/perch interactions.
  const attachHeight=site.legacy?base+height-1:landing.y-1,attach=trunkCurve.getPoints(120).reduce((best,p)=>Math.abs(p.y-attachHeight)<Math.abs(best.y-attachHeight)?p:best,origin);
  const restPoints=[attach,landing.clone().addScaledVector(n,-1.5).add(V(0,-.2,0)),landing,landing.clone().addScaledVector(n,1.7).add(V(0,.5,0))],restTangent=new THREE.CatmullRomCurve3(restPoints).getTangent(2/3),restHorizontalSq=restTangent.x**2+restTangent.z**2;
  tube(restPoints,site.legacy?[.43,.35,.29,.07]:[.3,.29,.29,.055],wood,visual,16,36).name='Connected resting branch';
  const split=landing.clone().addScaledVector(tangent(L*fraction),1.2).add(V(0,.35,0));tube([landing.clone().addScaledVector(n,-.6),landing,split],[.22,.17,.045],wood,visual,12,24);
  const spread=site.legacy?3:2.2,leaves=[];for(let i=0;i<(site.legacy?95:64);i++){const p=trunkTop.clone().add(V(sr(-spread,spread),sr(-1,1.6),sr(-spread,spread)));leaves.push({p,s:V(sr(.3,.7),sr(.6,1.1),1),rx:sr(.4,2.2),ry:sr(0,6.28),rz:sr(-1,1)});}
  batch(createPerchLeafGeometry(),leaf,leaves,visual).name='Perch canopy · atlas leaves';
  perches.push({id:site.id,position:landing.clone().add(V(0,.29,0)),radius:.85,label:site.label,yaw:Math.atan2(-restTangent.z,restTangent.x),slope:{x:restTangent.y*restTangent.x/restHorizontalSq,z:restTangent.y*restTangent.z/restHorizontalSq}});perchVisuals.push({object:visual,centre:landing.clone(),radius:5});
  const markerMaterial=gold.clone();markerMaterial.transparent=true;markerMaterial.depthWrite=false;ownMaterials.add(markerMaterial);
  const marker=mesh(new THREE.TorusGeometry(.32,.011,4,40),markerMaterial,visual,landing.clone().add(V(0,.32,0)));marker.name='Perch approach ring · '+site.id;marker.rotation.x=-Math.PI/2;marker.castShadow=false;animated.push({kind:'perch',object:marker,index});
  register(`perch-${index}`,site.label,landing,'perch','飞近金色枝环，按 R 收翼停栖；歇息恢复羽力，空格再次起飞。');
 }

 // A real depression crosses the path, with an optional narrow log bridge on the left.
 const gorge=at(.31),gorgeRight=right(L*.31),gorgeTangent=tangent(L*.31),bridgeCentre=gorge.clone().addScaledVector(gorgeRight,-2.9),bridgeLength=18.6,bridgeWidth=2.35;
 const bridgeStart=bridgeCentre.clone().addScaledVector(gorgeTangent,-bridgeLength/2),bridgeEnd=bridgeCentre.clone().addScaledVector(gorgeTangent,bridgeLength/2);
 for(let i=0;i<5;i++){const lateral=(i-2)*.46,a=bridgeStart.clone().addScaledVector(gorgeRight,lateral).setY(-.08),b=bridgeEnd.clone().addScaledVector(gorgeRight,lateral).setY(-.08);tube([a,a.clone().lerp(b,.5).add(V(0,.04,0)),b],[.23,.23,.23],wood);}
 for(const s of [-1,1]){for(const t of [-1,1]){const p=bridgeCentre.clone().addScaledVector(gorgeRight,s*1.2).addScaledVector(gorgeTangent,t*7.5);tube([p.clone().setY(-.3),p.clone().setY(1.1)],[.10,.07]);}tube([bridgeStart.clone().addScaledVector(gorgeRight,s*1.2).setY(1),bridgeCentre.clone().addScaledVector(gorgeRight,s*1.2).setY(.72),bridgeEnd.clone().addScaledVector(gorgeRight,s*1.2).setY(1)],[.045,.045,.045],darkWood);}
 bridges.push({centre:bridgeCentre.clone(),right:gorgeRight,tangent:gorgeTangent,length:bridgeLength,width:bridgeWidth,height:.15});
 slabs.push({centre:bridgeCentre.clone(),right:gorgeRight,tangent:gorgeTangent,length:bridgeLength,width:bridgeWidth,top:.15,bottom:-.31,reason:'桥底就在头顶。降低一些穿过，或绕到桥面继续。'});
 register('wind-gap','断岸风口',gorge,'gap','正前方可借上升气流飞越，左侧原木桥提供步行替代。');
 for(let i=0;i<13;i++){const side=i%2?1:-1,lateral=r(-6,6);if(Math.abs(lateral+2.9)<2)continue;const p=gorge.clone().addScaledVector(gorgeTangent,side*r(4.5,7.5)).addScaledVector(gorgeRight,lateral);p.y=groundAt(p)-.45;mesh(new THREE.IcosahedronGeometry(1,1),stone,group,p,V(r(.8,1.8),r(.8,1.4),r(.9,1.8)));}
 // Two broken banks with visible layered rock: no invisible wall across the gap.
 for(const side of [-1,1]){const points=[];for(let i=0;i<12;i++){const lateral=-7+i*1.27;if(Math.abs(lateral+2.9)<2)continue;const p=gorge.clone().addScaledVector(gorgeRight,lateral).addScaledVector(gorgeTangent,side*6.0);p.y=-3.0;points.push({p,s:V(r(.85,1.15),r(3.0,3.6),1.25),ry:r(0,6.28)});}batch(new THREE.IcosahedronGeometry(1,1),stone,points);}

 // The river is part of the shared terrain. Reeds signal shallows; an open channel stays swimmable.
 const reeds=[];
 for(let i=0;i<290;i++){const f=r(.16,.27),d=f*L,center=10.5+2*Math.sin(d*.027),p=at(f,center+(i%2?1:-1)*r(4.5,6.8));p.y=groundAt(p);if(p.y>-.95&&p.y<.6)reeds.push({p,s:V(r(.65,1),r(.75,1.6),r(.65,1)),ry:r(0,6.28)});}
 const reedParts=[];for(let i=0;i<4;i++){const a=i*1.6,p=V(Math.sin(a)*.13,0,Math.cos(a)*.13),g=branch([p,p.clone().add(V(.05,.9,.02)),p.clone().add(V(.19,1.65,.05))],[.009,.007,.0015],4,6);reedParts.push(g);for(let j=0;j<3;j++){const h=.35+j*.31,leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.03,.21,-.018,.46,.025,.67);leafShape.bezierCurveTo(.027,.42,.04,.2,0,0);const blade=new THREE.ShapeGeometry(leafShape,5);blade.rotateZ((j%2?-1:1)*(.48+j*.12));blade.rotateY(a);blade.translate(p.x+.03,h,p.z);reedParts.push(blade);}}
 const normalized=reedParts.map(g=>g.index?g.toNonIndexed():g);const reedGeo=mergeGeometries(normalized.map(g=>{g.deleteAttribute('normal');g.deleteAttribute('uv');g.computeVertexNormals();return g;}),false);for(const g of reedParts)g.dispose();batch(reedGeo,reedMat,reeds);
 const pool=at(.215,10.5+2*Math.sin(L*.215*.027));pool.y=-.2;
 register('river-pool','芦荡深潭',pool,'water','从低岸入水；水面可游动，按下降键潜入水下，注意气息后及时浮起。');
 const bedRocks=[];for(let i=0;i<35;i++){const p=pool.clone().add(V(r(-4,4),0,r(-9,9)));p.y=groundAt(p)+.12;bedRocks.push({p,s:V(r(.2,.7),r(.1,.3),r(.3,.9)),ry:r(0,6.28)});}batch(new THREE.IcosahedronGeometry(1,1),stone,bedRocks);
 // A tapered, compressed body, forked tail and dorsal/pectoral fins remain
 // legible in silhouette. Each school is a single animated draw call.
 const fishBody=new THREE.SphereGeometry(1,14,9);fishBody.scale(.068,.085,.28);const fp=fishBody.attributes.position,fc=[];
 for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),tail=1-THREE.MathUtils.smoothstep(z,.06,.27)*.7;fp.setXYZ(i,x*tail,y*tail,z);const color=new THREE.Color().lerpColors(new THREE.Color(0xb8b6a0),new THREE.Color(0x293e39),clamp((y+.065)/.13,0,1));if(Math.abs(y)<.02)color.multiplyScalar(1.2);fc.push(color.r,color.g,color.b);}fishBody.computeVertexNormals();fishBody.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));
 const fishTail=new THREE.BufferGeometry();const fins=[0,0,.23,0,.13,.42,0,.025,.36,0,0,.23,0,.025,.36,0,0,.32,0,0,.23,0,0,.32,0,-.025,.36,0,0,.23,0,-.025,.36,0,-.13,.42,0,.06,-.08,0,.16,.08,0,.06,.16,-.045,-.01,-.09,-.15,-.05,.04,-.05,-.02,.06,.045,-.01,-.09,.05,-.02,.06,.15,-.05,.04];fishTail.setAttribute('position',new THREE.Float32BufferAttribute(fins,3));fishTail.setAttribute('uv',new THREE.Float32BufferAttribute(Array(fins.length/3).fill([0,0]).flat(),2));fishTail.setAttribute('color',new THREE.Float32BufferAttribute(Array(fins.length/3).fill([.27,.32,.27]).flat(),3));fishTail.computeVertexNormals();fishMat.side=THREE.DoubleSide;
 const fishParts=[fishBody.toNonIndexed(),fishTail];for(const side of [-1,1]){const eye=new THREE.SphereGeometry(.012,6,4);eye.translate(side*.047,.025,-.175);eye.setAttribute('color',new THREE.Float32BufferAttribute(Array(eye.attributes.position.count).fill([.012,.016,.011]).flat(),3));fishParts.push(eye.toNonIndexed());}
 const fishGeo=mergeGeometries(fishParts,false);for(const g of fishParts)g.dispose();fishBody.dispose();
 const fish=new THREE.InstancedMesh(fishGeo,fishMat,24);fish.name='V4 · fork-tailed river school';ownGeometries.add(fishGeo);fish.frustumCulled=false;group.add(fish);const fishDummy=new THREE.Object3D(),fishTime={value:0};
 fishMat.onBeforeCompile=shader=>{shader.uniforms.uFishTime=fishTime;shader.vertexShader='uniform float uFishTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 #ifdef USE_INSTANCING
 float fishPhase=instanceMatrix[3].x*3.+instanceMatrix[3].z*2.;
 transformed.x+=sin(uFishTime*8.+position.z*13.+fishPhase)*smoothstep(-.12,.42,position.z)*.045;
 #endif`);};
 // Caustics modify the actual soil shader, avoiding intersecting transparent
 // planes at the bank. They are a restrained underwater-only light response.
 const land=forest.group.getObjectByName('Continuous sculpted soil and river bed'),originalGroundMaterial=land?.material,causticTime={value:0},causticStrength={value:0};
 if(originalGroundMaterial){const riverbed=originalGroundMaterial.clone();ownMaterials.add(riverbed);riverbed.onBeforeCompile=shader=>{originalGroundMaterial.onBeforeCompile(shader);shader.uniforms.uRiverTime=causticTime;shader.uniforms.uRiverCaustics=causticStrength;shader.vertexShader='varying vec3 vRiverPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvRiverPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='uniform float uRiverTime;uniform float uRiverCaustics;varying vec3 vRiverPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float riverNoise=sin(vRiverPosition.x*3.8+sin(vRiverPosition.z*2.1+uRiverTime*.6))+sin(vRiverPosition.z*4.1+sin(vRiverPosition.x*2.4-uRiverTime*.4));
 float riverGlow=pow(max(0.0,1.0-abs(riverNoise)*.5),12.0)*uRiverCaustics*(1.0-smoothstep(-.8,-.45,vRiverPosition.y));
 diffuseColor.rgb+=vec3(.55,.75,.59)*riverGlow;`);};riverbed.customProgramCacheKey=()=>originalGroundMaterial.customProgramCacheKey()+':riverbed-v3';land.material=riverbed;}

 // A quiet domestic interval, backed by plant archaeology rather than another gold-lit altar.
 const hamlet=at(.55,-11),farm=new THREE.Group();farm.name='Rice field · original domestic impression';farm.position.copy(hamlet);farm.rotation.y=Math.atan2(tangent(L*.55).x,tangent(L*.55).z);group.add(farm);
 const fieldSoil=mat({map:originalGroundMaterial?.map||null,normalMap:originalGroundMaterial?.normalMap||null,normalScale:new THREE.Vector2(.6,.6),color:0x736650,roughness:.92});
 const fieldGeo=new THREE.PlaneGeometry(7.6,8.8,14,16);fieldGeo.rotateX(-Math.PI/2);const fieldPos=fieldGeo.attributes.position;
 for(let i=0;i<fieldPos.count;i++){const x=fieldPos.getX(i),z=fieldPos.getZ(i);fieldPos.setXYZ(i,x+Math.sin(z*2.1)*.10,.12+Math.sin(x*7)*Math.sin(z*6)*.018,z+Math.sin(x*2.5)*.10);fieldGeo.attributes.uv.setXY(i,x/2.2,z/2.2);}fieldGeo.computeVertexNormals();mesh(fieldGeo,fieldSoil,farm);
 const rice=[];for(let x=-3.3;x<=3.3;x+=.36)for(let z=-3.7;z<=3.7;z+=.38)rice.push({p:V(x+r(-.055,.055),.15,z+r(-.055,.055)),s:V(.35,r(.42,.65),.35),ry:r(0,6.28)});const riceBladeMat=mat({color:0xa8a76c,roughness:.85,side:THREE.DoubleSide});batch(reedGeo,riceBladeMat,rice,farm);
 const panicleParts=[];for(let stem=0;stem<2;stem++){const side=stem?1:-1,curve=new THREE.CatmullRomCurve3([V(side*.12,1.3,0),V(side*.16,1.77,.03),V(side*.45,1.87,.08),V(side*.68,1.65,.13)]);panicleParts.push(branch(curve.getPoints(8),[.012,.009,.006,.003],3,8));for(let j=1;j<11;j++){const p=curve.getPoint(.27+j*.063);for(const s of [-1,1]){const grain=new THREE.OctahedronGeometry(1,0);grain.scale(.022,.062,.024);grain.rotateZ(s*.4);grain.translate(p.x+s*.035,p.y-.025,p.z);panicleParts.push(grain);}}}
 const panicleGeo=mergeGeometries(panicleParts.map(g=>{const n=g.index?g.toNonIndexed():g;n.deleteAttribute('uv');return n;}),false);for(const g of panicleParts)g.dispose();const panicleMat=mat({color:0xc6b37d,roughness:.8,side:THREE.DoubleSide});batch(panicleGeo,panicleMat,rice,farm);
 const cropTime={value:0};for(const m of [riceBladeMat,panicleMat])m.onBeforeCompile=shader=>{shader.uniforms.uCropTime=cropTime;shader.vertexShader='uniform float uCropTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 #ifdef USE_INSTANCING
 transformed.x+=sin(uCropTime*.9+instanceMatrix[3].x*.65+instanceMatrix[3].z*.4)*position.y*position.y*.035;
 #endif`);};
 const house=at(DOMESTIC_HOUSE_SITE.fraction,DOMESTIC_HOUSE_SITE.side);house.y=groundAt(house);const hut=new THREE.Group();hut.name='Timber and thatch · artistic interpretation';hut.position.copy(house);hut.rotation.y=Math.atan2(tangent(L*DOMESTIC_HOUSE_SITE.fraction).x,tangent(L*DOMESTIC_HOUSE_SITE.fraction).z);group.add(hut);
 for(const x of [-2,2])for(const z of [-1.7,1.7]){tube([V(x,-.7,z),V(x,3,z)],[.13,.11],wood,hut);const p=V(x,0,z).applyEuler(hut.rotation).add(house);solid.push({x:p.x,z:p.z,r:.13,bottom:house.y-.7,top:house.y+3,reason:'木柱撑起屋檐，请从柱间经过。'});}
 const planks=[];for(let x=-2;x<2.1;x+=.22)planks.push({p:V(x,.65,0),s:V(.19,.13,3.8)});batch(new THREE.BoxGeometry(1,1,1),wood,planks,hut);
 const hutRight=V(1,0,0).applyEuler(hut.rotation),hutForward=V(0,0,1).applyEuler(hut.rotation);
 platforms.push({centre:house.clone(),right:hutRight,tangent:hutForward,width:4.2,length:3.8,height:house.y+.715});
 slabs.push({centre:house.clone(),right:hutRight,tangent:hutForward,width:4.2,length:3.8,bottom:house.y+.585,top:house.y+.715});
 // The first tread is lower on this gently sloping court: all rises, including
 // the terrain-to-tread transition, stay inside locomotion's 28 cm step limit.
 for(const [z,top] of [[-2.75,.18],[-2.39,.44],[-2.03,.715]]){mesh(new THREE.BoxGeometry(1.25,top,.4),wood,hut,V(0,top*.5,z));platforms.push({centre:V(0,0,z).applyEuler(hut.rotation).add(house),right:hutRight,tangent:hutForward,width:1.25,length:.4,height:house.y+top});}
 for(const z of [-1.9,1.9])tube([V(-2.4,2.8,z),V(0,3.8,z),V(2.4,2.8,z)],[.10,.11,.10],wood,hut);
 const roofMat=mat({color:0x6f6250,roughness:1,side:THREE.DoubleSide});for(const side of [-1,1]){const roof=mesh(new THREE.PlaneGeometry(2.65,4.4,1,1),roofMat,hut,V(side*1.18,3.29,0));roof.rotation.x=-Math.PI/2;roof.rotation.y=side*.4;roof.userData.cameraOccluder=true;cameraColliders.push(roof);}
 const straw=[],beamDetails=[],lashings=[];
 for(const side of [-1,1])for(let row=0;row<3;row++)for(let j=0;j<80;j++){const x=.48+row*.83,z=-2.25+j*.057+r(-.012,.012);straw.push({p:V(side*x,3.88-x*.42+row*.015,z),s:V(r(.7,1.3),r(.85,1.15),1),rz:-side*(Math.PI/2+.395),color:new THREE.Color().setHSL(r(.10,.13),r(.16,.30),r(.58,.84))});}
 const strawBatch=batch(new THREE.CylinderGeometry(.019,.029,1.1,5),mat({color:0xa49b7d,roughness:1}),straw,hut);strawBatch.name='Layered thatch fibres';strawBatch.castShadow=true;
 for(const z of [-1.7,1.7]){beamDetails.push({p:V(0,2.72,z),s:V(4.5,.13,.15)});for(const x of [-2,2])for(let k=0;k<5;k++)lashings.push({p:V(x,2.65+k*.032,z),s:V(1,1,1),rx:Math.PI/2});}
 beamDetails.push({p:V(0,3.78,0),s:V(.16,.16,4.9)});for(const x of [-1.2,0,1.2])beamDetails.push({p:V(x,3.78-Math.abs(x)*.42,0),s:V(.08,.10,4.7)});
 batch(new THREE.BoxGeometry(1,1,1),wood,beamDetails,hut);
 batch(new THREE.TorusGeometry(.145,.014,4,12),mat({color:0xa1926c,roughness:1}),lashings,hut);
 // Open ceramic mouths and rolled rims replace visibly solid lathe caps.
 for(let i=0;i<4;i++){const profile=[V(.12,0),V(.24,.1),V(.32,.35),V(.29,.6),V(.18,.71),V(.2,.78),V(.185,.8),V(.16,.78),V(.15,.71),V(.25,.59),V(.28,.35),V(.2,.12),V(.1,.08)].map(p=>new THREE.Vector2(p.x,p.y));const pot=mesh(new THREE.LatheGeometry(profile,24),clay,hut,V(1.5-i*.55,.73,1.1));pot.scale.setScalar(.78+i*.075);pot.rotation.y=i*1.3;}
 register('rice-memory','稻作与陶土',hamlet,'culture','稻与粟的植物考古资料，为古蜀人的日常生活留下了线索；眼前木屋是艺术推测。','https://www.jinshasitemuseum.com/info/4877','金沙遗址黄忠小学地点的植物考古研究报告稻为主要作物、粟为辅助。这里的稻作片段据此创作，木屋形制与陈设并非考古复原。');
 // Nine-post footprint, deliberately open: the original superstructure remains debated.
 const nine=at(.84,5.6),posts=new THREE.Group();posts.position.copy(nine);posts.rotation.y=Math.atan2(tangent(L*.84).x,tangent(L*.84).z);group.add(posts);
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){const p=V(x*1.8,0,z*1.8).applyEuler(posts.rotation).add(nine),bottom=groundAt(p);mesh(new THREE.CylinderGeometry(.12,.17,3.1,10),darkWood,posts,V(x*1.8,bottom+1.55,z*1.8));mesh(new THREE.BoxGeometry(.5,.06,.5),stone,posts,V(x*1.8,bottom+.03,z*1.8));solid.push({x:p.x,z:p.z,r:.17,bottom,top:bottom+3.1,reason:'这里有木柱，请从柱间经过，或展翼越过。'});}
 register('nine-posts','九柱的留白',nine,'culture','金沙发现九个柱洞；有顶、无顶等解释仍有讨论。这里用木柱影子保留这一开放问题。','https://www.jinshasitemuseum.com/seardetail/3793','金沙祭祀区发现九个圆角方形柱洞。关于其上部建筑，有顶干栏、无顶高台等解释仍在讨论。本场景只提示柱位关系，柱高、材质表现和河岸布局均为艺术推测。');

 // Ripples and bubbles respond to actual movement, with bounded reused pools.
 const rippleMat=new THREE.MeshBasicMaterial({color:0x88ad9e,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});ownMaterials.add(rippleMat);const ripples=[];for(let i=0;i<6;i++){const material=rippleMat.clone();ownMaterials.add(material);const ring=mesh(new THREE.RingGeometry(.965,1,48),material);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.visible=false;ripples.push({object:ring,age:9});}
 const water=forest.group.getObjectByName('Reflective winding river'),originalWaterShader=water?.material?.fragmentShader,originalWaterUniform=water?.material?.uniforms?.uBelowWater;if(water?.material?.isShaderMaterial){water.material.uniforms.uBelowWater={value:0};water.material.fragmentShader='uniform float uBelowWater;\n'+water.material.fragmentShader.replace('gl_FragColor=vec4(col,.98*shore);','gl_FragColor=vec4(col,mix(.94,.34,uBelowWater)*shore);');water.material.needsUpdate=true;}
 const waterSurface=createWaterSurface(water);
 let lastRipple=0,lastMode='',rippleIndex=0;

 const supportSurfaces=[...bridges,...platforms];
 function bridgeSurface(position){for(const b of supportSurfaces){const q=position.clone().sub(b.centre);if(Math.abs(q.dot(b.right))<b.width/2&&Math.abs(q.dot(b.tangent))<b.length/2)return b.height;}return null;}
 function sample(position){
  const projection=forest.sampleMain?forest.sampleMain(position):forest.project(position),d=projection.distance,point=projection.point,delta=position.clone().sub(point),n=right(d),signed=delta.dot(n),bridge=bridgeSurface(position);
  const terrainHeight=groundAt(position),onSupport=bridge!==null&&position.y>=bridge-.28;
  const groundHeight=onSupport?Math.max(terrainHeight,bridge):terrainHeight;
  // A deck does not replace the riverbed or remove the water underneath it.
  const center=10.5+2*Math.sin(d*.027),half=d<L*.31?6.1:3.6,inRiver=d>L*.135&&d<L*.975&&Math.abs(signed-center)<half&&terrainHeight<-.21;
  const ribbonLevel=waterSurface.available?waterSurface.heightAt(position.x,position.z):inRiver?-.2:null;
  const waterLevel=ribbonLevel!==null&&terrainHeight<ribbonLevel-.01?ribbonLevel:null,waterDepth=waterLevel!==null?Math.max(0,waterLevel-terrainHeight):0;
  const fraction=d/L,zoneId=fraction<.135?'root-grove':fraction<.285?'river-wetland':fraction<.335?'wind-gap':fraction<.49?'canopy-trail':fraction<.64?'rice-hamlet':fraction<.89?'ritual-bank':'sun-clearing';
  const names={'root-grove':'根林初醒','river-wetland':'芦荡与深潭','wind-gap':'断岸风口','canopy-trail':'高枝玉径','rice-hamlet':'稻作与陶土','ritual-bank':'河岸九柱','sun-clearing':'向光的河湾'};
  const width=fraction>.145&&fraction<.285?28:24,offset=Math.hypot(delta.x,delta.z),inward=V(-delta.x,0,-delta.z);if(inward.lengthSq()<.0001)inward.copy(n);else inward.normalize();
  const boundaryDistance=width-offset,boundary=boundaryDistance<7?{distance:boundaryDistance,inward,message:position.y>7?'树冠外的风太强了，降下一些，沿河谷继续前行。':'林缘逆风渐强，沿着金羽回到河谷。'}:null;
  const wind=V();if(Math.abs(d-L*.31)<11&&Math.abs(signed)<8)wind.y=1.8*(1-smooth(4,11,Math.abs(d-L*.31)));if(boundary)wind.addScaledVector(inward,clamp((5-boundaryDistance)*.7,0,5));
  const surface=onSupport?'wood':waterLevel!==null?'mud':zoneId==='root-grove'?'litter':zoneId==='wind-gap'||zoneId==='canopy-trail'?'stone':zoneId==='rice-hamlet'?'clay':'soil';
  return {groundHeight,terrainHeight,supportHeight:bridge,waterLevel,waterDepth,zoneId,zoneName:names[zoneId],surface,boundary,wind,ceil:fraction<.14?12:14};
 }
 const cylinders=[...forest.colliders.map(c=>({type:'cylinder',x:c.x,z:c.z,r:c.r,bottom:c.minY||0,top:c.height||8,reason:c.reason||'前方是实心树干或岩壁，可绕行，或升高后越过。'})),...solid];
 // The authored sightline rocks already exist in V2. Their physical shells must
 // match their height; crossing above a boulder remains possible.
 forest.group.updateMatrixWorld(true);
 const instanceMatrix=new THREE.Matrix4(),instancePosition=V(),instanceScale=V(),instanceRotation=new THREE.Quaternion();
 for(const object of forest.cameraColliders||[]){
  const source=object.material?.map?.image?.src||'',isWood=object.material===forest.surfaces?.bark||source.includes('bark_brown'),isRock=object.material===forest.surfaces?.rock||source.includes('rock_boulder');if(!isWood&&!isRock)continue;if(isWood&&object.userData.segmentedTrunk)continue;
  const add=(matrix)=>{matrix.decompose(instancePosition,instanceRotation,instanceScale);if(isWood){cylinders.push({x:instancePosition.x,z:instancePosition.z,r:.68*Math.max(instanceScale.x,instanceScale.z),bottom:instancePosition.y,top:instancePosition.y+15*instanceScale.y,reason:'树干前请绕行，抬高一些可越过低枝。'});}else{const size=Math.max(instanceScale.x,instanceScale.z);if(size<.75)return;cylinders.push({x:instancePosition.x,z:instancePosition.z,r:size*.78,bottom:instancePosition.y-instanceScale.y*.88,top:instancePosition.y+instanceScale.y*.9,round:true,reason:'岩石就在前方，绕过它或振翼越过。'});}};
  if(object.isInstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instanceMatrix);instanceMatrix.premultiply(object.matrixWorld);add(instanceMatrix);}}else if(isRock)add(object.matrixWorld);
 }
 const cylinderIndex=createCylinderIndex(cylinders),nearbyCylinders=[];
 function resolveMotion(from,to,radius=.26){
  const result=to.clone(),steps=Math.max(1,Math.ceil(from.distanceTo(to)/.28)),delta=to.clone().sub(from).multiplyScalar(1/steps);let current=from.clone(),hit=false,normal=null,reason=null;
  for(let step=1;step<=steps;step++){const candidate=current.clone().add(delta);let cursor=-1;cylinderIndex.query(candidate.x,candidate.z,radius,nearbyCylinders);for(let i=0;i<nearbyCylinders.length;i++){const id=nearbyCylinders[i];if(id<=cursor)continue;cursor=id;const c=cylinders[id];if(candidate.y>c.top+.03||candidate.y+1.05<c.bottom)continue;const heightFactor=c.round?Math.sqrt(Math.max(.05,1-Math.pow(clamp((candidate.y+.32-(c.bottom+c.top)*.5)/((c.top-c.bottom)*.5),-1,1),2))):1;const dx=candidate.x-c.x,dz=candidate.z-c.z,d=Math.hypot(dx,dz),limit=c.r*heightFactor+radius;if(d<limit){const direction=V(dx,0,dz);if(d<.00001){direction.copy(current).sub(V(c.x,current.y,c.z));if(direction.lengthSq()<.00001)direction.set(1,0,0);}direction.normalize();candidate.x=c.x+direction.x*limit;candidate.z=c.z+direction.z*limit;hit=true;normal=direction;reason=c.reason;
    // A push can reach a neighbouring bucket. Continue in original collider
    // order from the new location, exactly as the full authored loop did.
    cylinderIndex.query(candidate.x,candidate.z,radius,nearbyCylinders);i=-1;}}
   for(const slab of slabs){
    const q=candidate.clone().sub(slab.centre),x=q.dot(slab.right),z=q.dot(slab.tangent),hx=slab.width*.5+radius,hz=slab.length*.5+radius;
    if(Math.abs(x)>=hx||Math.abs(z)>=hz)continue;
    if(current.y+1.05<=slab.bottom+.006&&candidate.y+1.05>slab.bottom){candidate.y=slab.bottom-1.055;hit=true;normal=V(0,-1,0);reason=slab.reason||'头顶是木台，请降低一些，从侧面绕行。';continue;}
    if(candidate.y>=slab.top-.3||candidate.y+1.05<slab.bottom)continue;
    const useX=hx-Math.abs(x)<hz-Math.abs(z),sign=Math.sign(useX?x:z)||1,axis=(useX?slab.right:slab.tangent).clone().multiplyScalar(sign),penetration=useX?hx-Math.abs(x):hz-Math.abs(z);candidate.addScaledVector(axis,penetration);hit=true;normal=axis;reason=slab.reason||'木台有些高，请从正面的踏步登上，或振翼落到木台。';
   }
   current.copy(candidate);}
  result.copy(current);const surface=sample(result);if(surface.boundary?.distance< -6){result.addScaledVector(surface.boundary.inward,-surface.boundary.distance-6);hit=true;normal=surface.boundary.inward.clone();reason='回流把你带回林缘。向内转身，或降低高度继续探索。';}
  return {position:result,hit,normal,reason};
 }
 const viewDirection=V(),viewDelta=V(),domesticBounds=[{object:farm,centre:hamlet.clone().add(V(0,1.2,0)),radius:7.2},{object:hut,centre:house.clone().add(V(0,2,0)),radius:5.4}];
 function update(dt,time,playerState,camera){
  const p=playerState?.position||playerState?.group?.position||V(),mode=playerState?.state?.mode||playerState?.mode||'walk',speed=playerState?.state?.speed||playerState?.speed||0,surface=sample(p),submerged=surface.waterLevel!==null&&p.y<surface.waterLevel-.6;
  // The cultivation and house used to submit their full geometry from the
  // marsh even after fog had made them invisible, including a second water
  // reflection pass. A conservative sphere plus margin removes only that
  // hidden work. Camera forward depth is used because THREE.Fog is depth-based.
  if(camera)camera.getWorldDirection(viewDirection);
  for(const item of domesticBounds){const distance=item.centre.distanceTo(p),viewDepth=camera?viewDelta.copy(item.centre).sub(camera.position).dot(viewDirection):distance-10;item.object.visible=Math.min(distance,viewDepth)<(scene.fog?.far||85)+item.radius+8;}
  for(const item of perchVisuals){const distance=item.centre.distanceTo(p),viewDepth=camera?viewDelta.copy(item.centre).sub(camera.position).dot(viewDirection):distance-10;item.object.visible=Math.min(distance,viewDepth)<(scene.fog?.far||85)+item.radius+8;}
  for(const a of animated){const perched=(playerState?.state?.perchId||playerState?.perchId)===perches[a.index].id,target=perched?0:1,material=a.object.material;material.opacity+=(target-material.opacity)*(1-Math.exp(-dt*7));a.object.visible=p.distanceTo(perches[a.index].position)<24&&material.opacity>.01;material.emissiveIntensity=.22+.08*Math.sin(time*2);}
  fishTime.value=time;cropTime.value=time;
  for(let i=0;i<24;i++){const school=Math.floor(i/8),phase=time*(.15+school*.028)+school*2.1,offset=i%8,dx=Math.sin(phase)*2.1+Math.sin(phase*2.3+school)*.6,dz=Math.sin(phase*.67+school)*3.7,headingX=Math.cos(phase)*2.1+Math.cos(phase*2.3+school)*1.38,headingZ=Math.cos(phase*.67+school)*2.48;
   fishDummy.position.set(pool.x+dx+Math.sin(offset*2.399)*(.25+offset*.11),pool.y-.85-school*.48+Math.sin(time*.5+i)*.13,pool.z+dz+Math.cos(offset*2.399)*(.3+offset*.14));
   const away=fishDummy.position.clone().sub(p),fear=1-smooth(.6,2.5,away.length());if(fear>0&&p.y<-.4){fishDummy.position.addScaledVector(away.normalize(),fear*.8);}
   // Keep the fish above the actual sloping bed and below the surface.
   fishDummy.position.y=clamp(fishDummy.position.y,Math.min(-.5,groundAt(fishDummy.position)+.26),-.48);fishDummy.rotation.set(0,Math.atan2(-headingX,-headingZ),Math.sin(time*3+i)*.035);fishDummy.scale.setScalar(.65+(i%4)*.13);fishDummy.updateMatrix();fish.setMatrixAt(i,fishDummy.matrix);}fish.instanceMatrix.needsUpdate=true;fish.visible=p.distanceTo(pool)<45;
  // The lens, not the bird's foot point, determines which side of the water
  // surface is being viewed. A shallow blend band prevents opacity popping.
  const lens=camera?.position||p,lensSurface=camera?sample(lens):surface;
  const belowWater=lensSurface.waterLevel!==null?smooth(.04,.18,lensSurface.waterLevel-lens.y):0;
  causticTime.value=time;causticStrength.value=belowWater*.08;
  if(water?.material.uniforms.uBelowWater)water.material.uniforms.uBelowWater.value=belowWater;
  const wet=surface.waterLevel!==null&&p.y<surface.waterLevel+.2;
  if(wet&&!submerged&&((speed>.2&&time-lastRipple>.65)||(mode!==lastMode))){const item=ripples[rippleIndex++%ripples.length];item.age=0;item.object.position.set(p.x,surface.waterLevel+.025,p.z);item.object.visible=true;lastRipple=time;}
  for(const item of ripples){item.age+=dt;if(item.age>1.8){item.object.visible=false;continue;}item.object.scale.setScalar(.25+item.age*.65);item.object.material.opacity=(1-item.age/1.8)*.12;}
  lastMode=mode;
 }
 function dispose(){group.removeFromParent();if(land&&originalGroundMaterial)land.material=originalGroundMaterial;if(water?.material?.isShaderMaterial){water.material.fragmentShader=originalWaterShader;if(originalWaterUniform)water.material.uniforms.uBelowWater=originalWaterUniform;else delete water.material.uniforms.uBelowWater;water.material.needsUpdate=true;}for(const geometry of ownGeometries)geometry.dispose();for(const material of ownMaterials)material.dispose();}
 return {group,sample,resolveMotion,update,perches,landmarks,dispose,bridges,pool,gorge,groundAt,cameraColliders};
}
