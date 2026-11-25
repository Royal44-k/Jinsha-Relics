import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
function seeded(seed){return()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);}

// These are original, low polygon botanical impressions, not taxonomic or
// archaeological reconstructions. Four batches per cell, at most three cells.
export function createEnvironmentPolish(scene,forest,traversal){
 const random=seeded(271198),r=(a,b)=>a+(b-a)*random();
 const group=new THREE.Group();group.name='V4 · 林下层与水岸碎物';scene.add(group);
 const geometries=new Set(),materials=new Set(),cells=[];
 const timeUniform={value:0},playerUniform={value:V(1000,1000,1000)};
 const geometry=g=>(geometries.add(g),g);
 const material=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
 const dummy=new THREE.Object3D(),L=forest.length;
 const at=(d,side)=>{const t=forest.path.getTangentAt(clamp(d/L,0,1));return forest.sample(d).add(V(-t.z*side,0,t.x*side));};
 function combine(parts){const normalized=parts.map(g=>{const n=g.index?g.toNonIndexed():g;n.computeVertexNormals();if(!n.getAttribute('color'))n.setAttribute('color',new THREE.Float32BufferAttribute(Array(n.getAttribute('position').count).fill([1,1,1]).flat(),3));return n;});const merged=geometry(mergeGeometries(normalized,false));for(const g of new Set([...parts,...normalized]))g.dispose();return merged;}
 function colour(g,c){const a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return g;}
 function stem(a,b,width,c){const g=new THREE.CylinderGeometry(width*.55,width,a.distanceTo(b),4);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().lerp(b,.5).toArray());for(let i=0;i<g.attributes.uv.count;i++)g.attributes.uv.setXY(i,.5,.5);return colour(g,c);}
 // A folded blade has a raised midrib and a tapered outline, rather than a card.
 function blade(length,width){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-width,.32*length,.025,0,.45*length,.035,width,.32*length,.025,-width*.72,.7*length,.02,0,length,-.04,width*.72,.7*length,.02],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.32,.5,.45,1,.32,.14,.7,.5,1,.86,.7],2));g.setIndex([0,1,2,0,2,3,1,4,2,4,5,2,2,5,6,2,6,3]);g.computeVertexNormals();return g;}
 const foliageParts=[];
 for(let i=0;i<5;i++){
  const angle=i*2.399,height=r(.36,.83),base=V(r(-.1,.1),0,r(-.1,.1)),tip=V(Math.cos(angle)*r(.2,.45),height,Math.sin(angle)*r(.2,.45));
  foliageParts.push(stem(base,tip,.012,new THREE.Color('#706443')));
  for(let j=0;j<5;j++){
   const a=angle+j*2.4,p=base.clone().lerp(tip,.25+j*.15),g=blade(r(.22,.38),r(.055,.105));
   g.rotateX(.7+j*.13);g.rotateY(a);g.translate(...p.toArray());
   foliageParts.push(colour(g,new THREE.Color().setHSL(r(.19,.25),r(.18,.31),r(.35,.57))));
  }
 }
 const shrubGeo=combine(foliageParts);
 let leafMap;forest.group.traverse(o=>{if(!leafMap&&o.material?.map?.isCanvasTexture)leafMap=o.material.map;});
 const shrubMat=material({map:leafMap,alphaTest:.3,color:0xe8e2be,vertexColors:true,roughness:.71,side:THREE.DoubleSide});
 shrubMat.onBeforeCompile=shader=>{
  shader.uniforms.uDetailTime=timeUniform;shader.uniforms.uDetailPlayer=playerUniform;
  shader.vertexShader='uniform float uDetailTime;uniform vec3 uDetailPlayer;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
    vec3 detailWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
    float breeze=sin(uDetailTime*.95+detailWorld.x*.53+detailWorld.z*.38);
    vec2 away=detailWorld.xz-uDetailPlayer.xz;
    float nearPlayer=(1.-smoothstep(.25,1.5,length(away)))*(1.-smoothstep(1.,2.5,abs(detailWorld.y-uDetailPlayer.y)));
    transformed.xz+=position.y*position.y*(vec2(breeze*.065,cos(uDetailTime*.7+detailWorld.z)*.04)+normalize(away+vec2(.001))*nearPlayer*.32);
   #endif`);
 };
 shrubMat.customProgramCacheKey=()=> 'v4-responsive-understory';
 const leafParts=[];
 for(let i=0;i<4;i++){const g=blade(r(.12,.22),r(.035,.06));g.rotateX(-Math.PI*.5+r(-.3,.3));g.rotateY(i*2.3);g.translate(r(-.11,.11),.015,r(-.11,.11));leafParts.push(colour(g,new THREE.Color().setHSL(r(.07,.12),.27,r(.25,.46))));}
 const litterGeo=combine(leafParts),litterMat=material({map:leafMap,alphaTest:.3,color:0xc2a786,vertexColors:true,roughness:1,side:THREE.DoubleSide});
 // Rounded river gravel needs a different silhouette from a broken rock face.
 // One shared 80-triangle shape keeps the same instanced draw budget.
 const pebbleBase=new THREE.IcosahedronGeometry(1,1);pebbleBase.deleteAttribute('uv');
 const pebbleGeo=geometry(mergeVertices(pebbleBase));pebbleBase.dispose();
 const pebblePositions=pebbleGeo.attributes.position;
 for(let i=0;i<pebblePositions.count;i++){
  const x=pebblePositions.getX(i),y=pebblePositions.getY(i),z=pebblePositions.getZ(i),shape=.91+.09*Math.sin(x*3+y*4)*Math.cos(z*3.5);
  pebblePositions.setXYZ(i,x*shape,y*(.82+.04*Math.cos(x*4-z*3)),z*.94*shape);
 }
 pebbleGeo.computeVertexNormals();
 const pebbleMat=material({color:0x918d7e,roughness:.9});
 const twigParts=[];
 twigParts.push(stem(V(-.6,.035,0),V(.62,.07,.09),.032,new THREE.Color('#6d604d')));
 twigParts.push(stem(V(-.1,.06,.03),V(.27,.08,.46),.018,new THREE.Color('#8f8166')));
 twigParts.push(stem(V(.31,.07,.065),V(.55,.15,-.21),.011,new THREE.Color('#99876b')));
 const twigGeo=combine(twigParts),twigMat=material({color:0xc0b5a0,vertexColors:true,roughness:.96});
 function batch(geo,mat,list,parent){if(!list.length)return;const b=new THREE.InstancedMesh(geo,mat,list.length);b.name=geo===shrubGeo?'Responsive broadleaf understory':geo===litterGeo?'Curled fallen leaves':geo===twigGeo?'Fallen twigs':'Shore gravel';for(let i=0;i<list.length;i++){const t=list[i];dummy.position.copy(t.p);dummy.scale.copy(t.s);dummy.rotation.set(t.rx||0,t.ry||0,t.rz||0);dummy.updateMatrix();b.setMatrixAt(i,dummy.matrix);if(t.color)b.setColorAt(i,t.color);}b.computeBoundingSphere();b.receiveShadow=true;parent.add(b);return b;}
 for(let c=0;c<16;c++){
  const cell=new THREE.Group();cell.name=`Detail patch ${c}`;group.add(cell);
  const start=c/16*L,end=(c+1)/16*L,centre=forest.sample((start+end)/2);
  const shrubs=[],leaves=[],pebbles=[],twigs=[];
  for(let i=0;i<95;i++){
   const d=r(start,end),side=(i%2?1:-1)*r(3.6,11.5),p=at(d,side),n=forest.project(p),ground=forest.sampleGround(p.x,p.z);
   // Broken islands of vegetation; the path and domestic clearing stay legible.
   const patch=Math.sin(p.x*.7+p.z*.23)+Math.cos(p.z*.38-p.x*.19);
   if(n.offset<3.4||ground<-.17||patch<-.2||(d/L>.53&&d/L<.60&&side< -5)||(d/L>.546&&d/L<.595&&side<-.9&&side> -15.7)||(d/L>.397&&d/L<.437&&side<-.8&&side> -6.9))continue;
   p.y=ground-.015;const s=r(.7,1.5);shrubs.push({p,s:V(s,s*r(.65,1.15),s),ry:r(0,6.28),color:new THREE.Color().setHSL(r(.17,.24),r(.1,.25),r(.67,.9))});
  }
  for(let i=0;i<160;i++){
   const d=r(start,end),p=at(d,r(-8,8)),ground=forest.sampleGround(p.x,p.z);if(ground<-.21||ground>1)continue;
   if(Math.sin(p.x*.9+p.z*.37)<-.45)continue;
   if(d/L>.53&&d/L<.60&&forest.sampleMain(p).signed< -5)continue;
   p.y=ground+.018;const s=r(.5,1.1);leaves.push({p,s:V(s,s*.6,s),ry:r(0,6.28),rx:r(-.08,.08)});
  }
  for(let i=0;i<90;i++){
   const d=r(start,end),riverSide=10.5+2*Math.sin(d*.027)-(d<L*.31?6.1:3.6),p=at(d,i%3===0?r(-4,4):riverSide+r(-1.2,1.6)),ground=forest.sampleGround(p.x,p.z);
   if(ground<-.7||ground>.5||d<L*.14)continue;p.y=ground+.025;
   pebbles.push({p,s:V(r(.045,.15),r(.035,.09),r(.07,.23)),ry:r(0,6.28),color:new THREE.Color().setHSL(r(.08,.16),r(.04,.17),r(.45,.76))});
  }
  for(let i=0;i<17;i++){
   const d=r(start,end),p=at(d,(i%2?1:-1)*r(3.1,8.5)),ground=forest.sampleGround(p.x,p.z);if(ground<-.15||ground>.5)continue;p.y=ground+.03;const s=r(.5,1.4);twigs.push({p,s:V(s,s,s),ry:r(0,6.28)});
  }
  batch(shrubGeo,shrubMat,shrubs,cell);batch(litterGeo,litterMat,leaves,cell);batch(pebbleGeo,pebbleMat,pebbles,cell);batch(twigGeo,twigMat,twigs,cell);
  cells.push({group:cell,centre,distance:Infinity});
 }
 let quality='high';
 function setQuality(value){quality=value==='low'?'low':'high';}
 function update(dt,time,player,camera,value){
  if(value)setQuality(value);timeUniform.value=time;
  const p=player?.position||player?.group?.position||player||V();playerUniform.value.copy(p);
  // A bounded active set is important in the bends, where many route cells are
  // physically close. Visibility follows the viewer as well as the traveller.
  for(const cell of cells){cell.distance=Math.min(cell.centre.distanceTo(p),camera?cell.centre.distanceTo(camera.position):Infinity);cell.group.visible=false;}
  const nearby=cells.slice().sort((a,b)=>a.distance-b.distance),limit=quality==='low'?2:3;
  for(let i=0;i<limit;i++)if(nearby[i].distance<(quality==='low'?27:39)){nearby[i].group.visible=true;for(const mesh of nearby[i].group.children){mesh.visible=quality!=='low'||mesh.geometry!==twigGeo;mesh.count=quality==='low'?Math.ceil(mesh.instanceMatrix.count*.55):mesh.instanceMatrix.count;}}
 }
 function dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 return {group,update,setQuality,dispose,ready:Promise.resolve(),stats:()=>({quality,activeCells:cells.filter(c=>c.group.visible).length,activeDraws:cells.filter(c=>c.group.visible).reduce((sum,c)=>sum+c.group.children.filter(o=>o.visible).length,0)})};
}
