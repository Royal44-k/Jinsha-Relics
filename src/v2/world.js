import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadDetailedRelics } from '../v4/relic-loader.js';
import { traversalHeight } from '../v3/terrain-field.js';
import { CHAPTER_HEROES, CHAPTER_KILNS, chapterHeroFootprint } from '../v5/chapter-data.js';
import { createBambooGrove, BAMBOO_STANDS } from '../v7/bamboo-grove.js';
import { createPathIndex } from '../v8/path-index.js';
import { ENCOUNTERS } from '../v9/expedition-state.js';
import { riverBankExtent } from '../v9/river-bank.js';

// Editable, deterministic environment production source. Distances are world metres.
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const UP = V(0,1,0);
const clamp = THREE.MathUtils.clamp;
const smooth = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);
// Shared by vegetation clearance and traversal geometry/solids. The house sits
// downstream of the canal field, beside the pottery court rather than on its outlet.
export const DOMESTIC_HOUSE_SITE=Object.freeze({fraction:.635,side:-7});
function generator(seed) { return () => ((seed=(1664525*seed+1013904223)>>>0)/4294967296); }

export function taperedBranch(points, radii, segments=18, sides=7) {
  const curve = new THREE.CatmullRomCurve3(points);
  // Match the authored parameter-space centres. Arc-length tangents skewed
  // rings along unevenly spaced knots, especially at roots and branch forks.
  const frames=THREE.Curve.prototype.computeFrenetFrames.call({getTangentAt(t,target){return curve.getTangent(t,target);}},segments,false);
  const positions=[], normals=[], uv=[], indices=[];
  for(let i=0;i<=segments;i++) {
    const t=i/segments, p=curve.getPoint(t), rIndex=t*(radii.length-1), k=Math.min(radii.length-2,Math.floor(rIndex));
    const radius=THREE.MathUtils.lerp(radii[k],radii[k+1],rIndex-k);
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2, n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));
      const flute=1+.10*Math.sin(a*5+t*1.9)+.045*Math.sin(a*9-t*2.8),rootFlare=1+.12*Math.exp(-t*7)*Math.pow(.5+.5*Math.cos(a*4+.7),2);
      const q=p.clone().addScaledVector(n,radius*flute*rootFlare);
      positions.push(q.x,q.y,q.z); normals.push(n.x,n.y,n.z); uv.push(j/sides*2,t*curve.getLength()*.47);
      if(i<segments&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const normal=g.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3();
  for(let i=0;i<=segments;i++){const first=i*(sides+1),last=first+sides;a.fromBufferAttribute(normal,first).add(b.fromBufferAttribute(normal,last)).normalize();normal.setXYZ(first,a.x,a.y,a.z);normal.setXYZ(last,a.x,a.y,a.z);}
  return g;
}

function leafGeometry() {
  const g=new THREE.BufferGeometry(),p=[],uv=[],indices=[];
  for(let row=0;row<3;row++)for(let col=0;col<2;col++){p.push((col-.5)*.8,row*.5,row===1?.12:row*.025);uv.push(col,row*.5);if(row<2&&col===0){const i=row*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}}
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function paintedLeaf() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(16,0,112,0);gradient.addColorStop(0,'#82915a');gradient.addColorStop(.46,'#9ba774');gradient.addColorStop(.51,'#536345');gradient.addColorStop(1,'#86956a');ctx.fillStyle=gradient;
  ctx.beginPath();ctx.moveTo(64,4);ctx.bezierCurveTo(23,43,4,133,43,206);ctx.quadraticCurveTo(57,229,64,252);ctx.quadraticCurveTo(72,230,89,202);ctx.bezierCurveTo(125,119,101,42,64,4);ctx.fill();
  ctx.strokeStyle='rgba(203,213,150,.38)';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(64,8);ctx.lineTo(64,246);ctx.stroke();
  for(let y=38;y<224;y+=18){const extent=Math.sin(y/256*Math.PI)*41;ctx.strokeStyle='rgba(48,76,33,.38)';ctx.beginPath();ctx.moveTo(64,y+11);ctx.quadraticCurveTo(64-extent*.4,y,64-extent,y-16);ctx.moveTo(64,y+11);ctx.quadraticCurveTo(64+extent*.4,y,64+extent,y-16);ctx.stroke();}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function combine(parts) {const merged=mergeGeometries(parts,false); for(const p of parts)p.dispose();return merged;}
function transformed(g, position, scale, rotation=V()) {const m=new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z)),scale);return g.clone().applyMatrix4(m);}

function plantAssets(random) {
  const leaf=leafGeometry(), leafRects=[[15,15,151,435],[175,16,347,417],[367,24,501,379],[533,40,668,382],[707,13,850,439],[10,623,198,1020],[219,580,379,1010],[418,606,577,1017]], fernParts=[], grassParts=[], treeVariants=[];
  const r=(a,b)=>a+(b-a)*random();
  for(let f=0;f<7;f++) {
    const angle=f*Math.PI*2/7+r(-.2,.2), length=r(.9,1.4), points=[];
    for(let j=0;j<=12;j++) {const t=j/12;points.push(V(Math.sin(angle)*t*length,Math.sin(t*Math.PI*.78)*.68+.05,Math.cos(angle)*t*length));}
    fernParts.push(taperedBranch(points,[.015,.011,.003],12,3));
    for(let j=1;j<12;j++) for(const side of [-1,1]) {
      const t=j/12, p=points[j], width=Math.sin(t*Math.PI)*.30+.025;
      const g=leaf.clone(), ps=g.attributes.position;
      for(let i=0;i<ps.count;i++) {const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i);ps.setXYZ(i,p.x+Math.cos(angle)*side*y*width+Math.sin(angle)*x*.25,p.y+y*.08+z*.3,p.z-Math.sin(angle)*side*y*width+Math.cos(angle)*x*.25+t*.03);}
      g.computeVertexNormals();fernParts.push(g);
    }
  }
  for(let j=0;j<9;j++)grassParts.push(transformed(leaf,V(r(-.16,.16),0,r(-.16,.16)),V(.09,r(.4,.95),.6),V(r(.12,.6),r(0,6.28),r(-.3,.3))));
  for(let variant=0;variant<3;variant++) {
    const wood=[], leaves=[], h=variant===0?r(15,19):variant===1?r(10,13):r(12,16), drift=V(r(-1.6,1.6),0,r(-1.4,1.4));
    const stem=[V(),V(.15,h*.22,.08),V(drift.x*.65,h*.48,drift.z*.75),V(drift.x,h*.74,drift.z),V(drift.x*.65,h,drift.z*1.4)],stemRadii=[.72,.56,.37,.23,.028];
    wood.push(taperedBranch(stem,stemRadii,27,11));
    for(let root=0;root<7;root++){const a=root/7*Math.PI*2;wood.push(taperedBranch([V(drift.x*.04,.7,drift.z*.04),V(Math.cos(a)*.9,.21,Math.sin(a)*.9),V(Math.cos(a)*2.8,-.07,Math.sin(a)*2.8)],[.31,.16,.014],7,5));}
    for(let b=0;b<11;b++) {
      const a=b*2.399+variant, y=h*((variant===0?.46:variant===1?.34:.38)+b*(variant===0?.043:.049)), span=r(3.3,5.5)*(variant===1?1.33:variant===0?.79:1.1)*(1-b*.025), origin=V(drift.x*y/h,y,drift.z*y/h);
      const tip=origin.clone().add(V(Math.cos(a)*span,r(1.8,3.4),Math.sin(a)*span));
      const middle=origin.clone().lerp(tip,.55).add(V(0,-.6,0));
      wood.push(taperedBranch([origin,middle,tip],[.18,.09,.012],9,5));
      for(let twig=0;twig<3;twig++) {
        const start=middle.clone().lerp(tip,twig/3), theta=a+(twig-1)*.9, end=start.clone().add(V(Math.cos(theta)*r(1.3,2.6),r(.4,1.3),Math.sin(theta)*r(1.3,2.6)));
        wood.push(taperedBranch([start,start.clone().lerp(end,.6).add(V(0,.35,0)),end],[.045,.025,.002],5,3));
        for(let l=0;l<23;l++) {
          const scatter=V(r(-1.5,1.5),r(-.35,.65),r(-1.5,1.5)),theta=l*2.399,rad=Math.sqrt((l+.5)/23);
          const pos=end.clone().add(V(Math.cos(theta)*rad*1.65+scatter.x*.23,scatter.y*.72+Math.sin(rad*Math.PI)*.28,Math.sin(theta)*rad*1.45+scatter.z*.23));
          const g=transformed(leaf,pos,V(r(.42,.75),r(.62,1.02),1),V(r(.55,1.9),r(0,6.28),r(-1,1)));
          const rect=leafRects[Math.floor(random()*leafRects.length)],uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,(rect[0]+uv.getX(k)*(rect[2]-rect[0]))/1024,1-(rect[3]-uv.getY(k)*(rect[3]-rect[1]))/1024);leaves.push(g);
        }
      }
    }
    treeVariants.push({wood:combine(wood),leaves:combine(leaves),stem,stemRadii});
  }
  return {leaf,fern:combine(fernParts),grass:combine(grassParts),trees:treeVariants};
}

function birdRelic(material, dark) {
  const group=new THREE.Group(), parts=[];
  const body=new THREE.SphereGeometry(1,20,14);
  parts.push(transformed(body,V(0,.78,0),V(.24,.43,.27)));
  parts.push(taperedBranch([V(0,.93,0),V(0,1.35,-.08),V(0,1.64,-.22)],[.15,.11,.13],15,10));
  parts.push(transformed(body,V(0,1.65,-.24),V(.18,.19,.18)));
  const beak=new THREE.ConeGeometry(.105,.42,12);beak.rotateX(-Math.PI/2);beak.translate(0,1.65,-.56);parts.push(beak);
  for(const side of [-1,1]) {
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.35,.08,.46,.48,.22,.88);shape.bezierCurveTo(.35,.47,.08,.26,0,0);
    const wing=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:14});wing.rotateY(side*Math.PI/2);wing.translate(side*.17,.62,.08);parts.push(wing);
    parts.push(taperedBranch([V(side*.1,.5,0),V(side*.12,.15,.02),V(side*.12,.07,-.2)],[.045,.036,.025],8,6));
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.047,12,8),dark);eye.position.set(side*.163,1.7,-.29);group.add(eye);
  }
  const tail=new THREE.Shape();tail.moveTo(-.14,0);tail.lineTo(.14,0);tail.lineTo(.09,-.72);tail.lineTo(-.09,-.72);tail.closePath();const tailGeo=new THREE.ExtrudeGeometry(tail,{depth:.045,bevelEnabled:false});tailGeo.rotateX(-.46);tailGeo.translate(0,.9,.25);parts.push(tailGeo);
  const sculpture=new THREE.Mesh(combine(parts.map(p=>p.index?p.toNonIndexed():p)),material);sculpture.castShadow=true;group.add(sculpture);body.dispose();return group;
}

export function createForest(scene) {
  const relicsReady=loadDetailedRelics();
  const random=generator(73192), r=(a,b)=>a+(b-a)*random();
  const group=new THREE.Group();group.name='林河寻光 · continuous forest';scene.add(group);
  const controls=[[0,12],[-2,-3],[-12,-14],[-18,-26],[-10,-39],[8,-48],[15,-65],[5,-78],[-9,-86],[-22,-101],[-21,-121],[-5,-137],[13,-147],[23,-167],[14,-186],[-5,-193],[-17,-213],[-10,-232],[9,-244],[18,-265],[6,-282],[0,-302]];
  const path=new THREE.CatmullRomCurve3(controls.map(([x,z])=>V(x,0,z)),false,'centripetal');path.arcLengthDivisions=1800;path.updateArcLengths();
  const length=path.getLength(), sample=d=>path.getPointAt(clamp(d/length,0,1));
  const tangent=d=>path.getTangentAt(clamp(d/length,0,1));
  const right=d=>{const t=tangent(d);return V(-t.z,0,t.x);};
  const width=d=>3.4+1.15*Math.pow(Math.sin(d*.035),2)+3.1*(1-smooth(3,10,Math.abs(d-length*.94)));
  const routes=[{points:path.getSpacedPoints(700),start:0,end:length,width:0}];
  const sidePaths=[];
  for(const [a,b,side] of [[.045,.135,-1],[.34,.46,-1]]) {
    const points=[];
    for(let j=0;j<=14;j++){const u=j/14,d=length*(a+(b-a)*u);points.push(sample(d).addScaledVector(right(d),side*Math.sin(u*Math.PI)*10));}
    const curve=new THREE.CatmullRomCurve3(points);curve.arcLengthDivisions=300;
    const route={points:curve.getSpacedPoints(100),start:a*length,end:b*length,width:2.2,curve};routes.push(route);sidePaths.push(route);
  }
  const segments=[];
  for(const route of routes)for(let i=0;i<route.points.length-1;i++)segments.push({a:route.points[i],b:route.points[i+1],d0:route.start+(route.end-route.start)*i/(route.points.length-1),d1:route.start+(route.end-route.start)*(i+1)/(route.points.length-1),width:route.width,side:route!==routes[0]});
  const pathIndex=createPathIndex(segments,{width,maxWidth:7.65});
  const nearest=(position,mainOnly=false,corridor=false)=>pathIndex.nearest(position,mainOnly,corridor);
  const project=p=>{const n=nearest(p);return {distance:n.distance,point:n.point,offset:n.offset};};
  const colliders=[], cameraColliders=[];
  // Reserve authored play spaces before instancing AND collider registration.
  // A soft edge preserves irregular vegetation instead of a cut-out circle.
  const interactionSites=[{fraction:.182,lateral:-2.4,tree:4.0,rock:3.2,plant:2.3},...ENCOUNTERS.map(e=>({...e,tree:5.1,rock:3.5,plant:2.9}))].map(a=>({...a,position:sample(a.fraction*length).addScaledVector(right(a.fraction*length),a.lateral)}));
  const interactionDensity=(p,kind,padding=0)=>{let factor=1;for(const site of interactionSites){const d=Math.hypot(p.x-site.position.x,p.z-site.position.z),radius=site[kind]+padding;factor*=smooth(radius,radius+2.4,d);}return factor;};
  function constrain(position) {
    const p=position.clone(), n=nearest(p,false,true), limit=n.width||width(n.distance);
    if(n.offset>limit){const direction=p.clone().sub(n.point);direction.y=0;direction.normalize();p.x=n.point.x+direction.x*limit;p.z=n.point.z+direction.z*limit;}
    for(const c of colliders){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz);if(d<c.r&&p.y<c.height){p.x=c.x+dx/(d||1)*c.r;p.z=c.z+dz/(d||1)*c.r;}}
    return p;
  }

  const textures=[], pending=[];
  const loader=new THREE.TextureLoader();
  function texture(file,color=true) {let resolve;pending.push(new Promise(r=>resolve=r));const t=loader.load(`/assets/environment/${file}`,()=>resolve(),undefined,()=>resolve());t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(color)t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t;}
  const floorMap=texture('forest_floor_diff_1k.webp'), floorNormal=texture('forest_floor_nor_gl_1k.webp',false);
  const barkMap=texture('bark_brown_02_diff_1k.webp'), barkNormal=texture('bark_brown_02_nor_gl_1k.webp',false);
  const rockMap=texture('rock_boulder_dry_diff_1k.webp'), rockNormal=texture('rock_boulder_dry_nor_gl_1k.webp',false);
  const meadowMap=texture('../v5/ground/aerial_grass_rock_diff_1k.webp'),meadowNormal=texture('../v5/ground/aerial_grass_rock_nor_gl_1k.webp',false);
  const leafMap=paintedLeaf();textures.push(leafMap);
  const canopyMap=texture('../v6/canopy/island-leaf-color.webp'),canopyNormal=texture('../v6/canopy/island-leaf-normal.webp',false);
  const materials={
    ground:new THREE.MeshStandardMaterial({map:floorMap,normalMap:floorNormal,normalScale:new THREE.Vector2(.72,.72),color:0xa6a090,roughness:.92,vertexColors:true}),
    bark:new THREE.MeshStandardMaterial({map:barkMap,normalMap:barkNormal,normalScale:new THREE.Vector2(.85,.85),color:0xa69c88,roughness:.94}),
    rock:new THREE.MeshStandardMaterial({map:rockMap,normalMap:rockNormal,normalScale:new THREE.Vector2(.8,.8),color:0xa0a397,roughness:.83}),
    moss:new THREE.MeshStandardMaterial({map:floorMap,normalMap:floorNormal,normalScale:new THREE.Vector2(.4,.4),color:0x72805a,roughness:.98}),
    leaf:new THREE.MeshStandardMaterial({map:canopyMap,normalMap:canopyNormal,normalScale:new THREE.Vector2(.24,.24),alphaTest:.42,color:0xbcc4a5,roughness:.79,side:THREE.DoubleSide}),
    fern:new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.45,color:0xb2bf9b,roughness:.73,side:THREE.DoubleSide}),
    grass:new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.45,color:0xb1b68f,roughness:.89,side:THREE.DoubleSide}),
    litter:new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.45,color:0x9e7644,roughness:1,side:THREE.DoubleSide}),
    bronze:new THREE.MeshStandardMaterial({map:rockMap,normalMap:rockNormal,normalScale:new THREE.Vector2(.12,.12),color:0x547661,metalness:.55,roughness:.65}),
    gold:new THREE.MeshStandardMaterial({color:0xd7ae65,metalness:.82,roughness:.29,emissive:0x79501b,emissiveIntensity:.16}),
    dark:new THREE.MeshStandardMaterial({color:0x152e27,roughness:.7}),
  };
  const wind={value:0};
  materials.ground.onBeforeCompile=shader=>{
    shader.uniforms.uMeadowMap={value:meadowMap};shader.uniforms.uMeadowNormal={value:meadowNormal};
    shader.vertexShader='attribute vec3 aChapterSoil;varying vec3 vChapterSoil;varying vec3 vChapterSoilPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvChapterSoil=aChapterSoil;vChapterSoilPosition=position;');
    shader.fragmentShader='uniform sampler2D uMeadowMap;uniform sampler2D uMeadowNormal;varying vec3 vChapterSoil;varying vec3 vChapterSoilPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float soilLuma=dot(diffuseColor.rgb,vec3(.27,.58,.15));
      diffuseColor.rgb=mix(vec3(soilLuma)*vec3(1.10,1.03,.89),diffuseColor.rgb,.45);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.155,.137,.107)+diffuseColor.rgb*.36,(1.-vChapterSoil.x)*.34);
      vec3 meadow=texture2D(uMeadowMap,vChapterSoilPosition.xz/11.).rgb;
      meadow=mix(meadow*vec3(.62,1.20,.71),meadow*vec3(.76,1.13,.68),vChapterSoil.z);
      diffuseColor.rgb=mix(diffuseColor.rgb,meadow*.72,vChapterSoil.x);
      float soilMacro=.5+.5*sin(vChapterSoilPosition.x*.37+sin(vChapterSoilPosition.z*.19))*cos(vChapterSoilPosition.z*.29-vChapterSoilPosition.x*.11);
      diffuseColor.rgb*=mix(.86,1.08,soilMacro)*(1.-vChapterSoil.y*.23);
      float soilWet=smoothstep(.63,.89,soilMacro)*(1.-vChapterSoil.x)*vChapterSoil.y;
      diffuseColor.rgb*=1.-soilWet*.18;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float wetNoise=.5+.5*sin(vChapterSoilPosition.x*.37+sin(vChapterSoilPosition.z*.19))*cos(vChapterSoilPosition.z*.29-vChapterSoilPosition.x*.11);
      float wetSoil=smoothstep(.63,.89,wetNoise)*(1.-vChapterSoil.x)*vChapterSoil.y;
      roughnessFactor=mix(roughnessFactor,.32,wetSoil*.72);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      #ifdef USE_NORMALMAP_TANGENTSPACE
      vec3 meadowN=texture2D(uMeadowNormal,vChapterSoilPosition.xz/11.).xyz*2.-1.;meadowN.xy*=.48;
      mat3 meadowFrame=getTangentFrame(-vViewPosition,normalize(vNormal),vChapterSoilPosition.xz/11.);
      normal=normalize(mix(normal,normalize(meadowFrame*meadowN),vChapterSoil.x));
      #endif`);
  };
  materials.ground.customProgramCacheKey=()=> 'v7-soil-moisture-macro';
  // A mottled lower-trunk tint follows bark texture and geometry. No extra moss
  // shells or transparent decals are required for hundreds of tree instances.
  materials.bark.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vBarkLocal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBarkLocal=position;');
    shader.fragmentShader='varying vec3 vBarkLocal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float barkPatch=sin(vBarkLocal.x*14.+sin(vBarkLocal.y*4.))*cos(vBarkLocal.z*11.+vBarkLocal.y*2.);
      float lowMoss=(1.-smoothstep(.3,3.3,vBarkLocal.y))*smoothstep(-.25,.45,barkPatch)*.42;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.76,1.10,.68),lowMoss);`);
  };
  for(const material of [materials.leaf,materials.fern,materials.grass]) {
    material.onBeforeCompile=shader=>{shader.uniforms.uForestTime=wind;shader.vertexShader='uniform float uForestTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 forestWorld = (instanceMatrix * vec4(position,1.0)).xyz;
      transformed.x += sin(uForestTime * .7 + forestWorld.x * .34 + forestWorld.z * .25) * min(position.y*.035,.16);
      transformed.z += cos(uForestTime * .53 + forestWorld.z * .4) * min(position.y*.019,.08);
      #endif`);};
  }
  const mesh=(geo,mat,parent=group,pos=V(),scale=V(1,1,1))=>{const o=new THREE.Mesh(geo,mat);o.position.copy(pos);o.scale.copy(scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(mat===materials.bark||mat===materials.rock){o.userData.cameraOccluder=true;cameraColliders.push(o);}return o;};

  // The canal and paddy share a graded alluvial court. Its centre/basis is also
  // used by the rock exclusion below; mechanism positions remain authored.
  const canalDistance=.567*length,canalForward=tangent(canalDistance),canalRight=right(canalDistance).negate(),canalOrigin=sample(canalDistance).addScaledVector(right(canalDistance),-5),canalDelta=V();
  function canalGradeWeight(x,z){const dx=x-canalOrigin.x,dz=z-canalOrigin.z,lx=dx*canalRight.x+dz*canalRight.z,lz=dx*canalForward.x+dz*canalForward.z,edge=Math.max(Math.abs(lx-6.45)-5.35,Math.abs(lz-1.6)-4.2,0);return 1-smooth(0,2,edge);}
  const inCanalFootprint=(p,padding=0)=>{canalDelta.copy(p).sub(canalOrigin);const x=canalDelta.dot(canalRight),z=canalDelta.dot(canalForward);return x> -3.8-padding&&x<10.5+padding&&z> -7.3-padding&&z<4.7+padding;};
  function landHeight(x,z,knownNear) {
    const p=V(x,0,z), n=knownNear||nearest(p), main=n.side?nearest(p,true):n, w=n.width||width(n.distance);
    const outside=smooth(w-.3,w+6,n.offset), noise=Math.sin(x*.23+z*.15)*.34+Math.sin(x*.51-z*.09)*.22;
    let y=-.035+outside*(.35+noise+Math.pow(Math.max(0,n.offset-10)*.12,1.55));
    if(main.distance>length*.135&&main.distance<length*.975) {
      const riverCenter=10.5+2*Math.sin(main.distance*.027), riverWidth=main.distance<length*.31?6.7:4.2;
      const bed=1-smooth(riverWidth-1.5,riverWidth+1.2,Math.abs(main.signed-riverCenter));y=THREE.MathUtils.lerp(y,-1.05,bed);
    }
    if(n.offset<w)y=-.035;
    // Beyond the maximum 28 m traversal boundary, the old exponential field
    // formed empty polygonal mountains. A low alluvial horizon better fits the
    // cultural landscape while leaving every reachable height unchanged.
    const remote=smooth(30,48,main.offset),plain=1.6+noise*.5+Math.sin(x*.038-z*.021)*.55;
    y=THREE.MathUtils.lerp(y,plain,remote);
    const base=traversalHeight(main.distance,main.signed,y,length);
    // A ~2 m inner allowance covers the coarse terrain triangles under every
    // field edge; another 2 m eases into the untouched surrounding slope.
    return THREE.MathUtils.lerp(base,-.035,canalGradeWeight(x,z));
  }
  const terrain=new THREE.PlaneGeometry(200,370,140,260);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,-145);
  const tp=terrain.attributes.position, colors=[],soilWeights=[], color=new THREE.Color();
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),z=tp.getZ(i),n=nearest(V(x,0,z)),y=landHeight(x,z,n),f=n.distance/length;tp.setY(i,y);
    const pathTone=1-smooth(2.4,6,n.offset),warm=smooth(.47,.54,f)*(1-smooth(.72,.81,f)),silver=smooth(.14,.18,f)*(1-smooth(.32,.38,f));
    color.setRGB(.62+pathTone*.25+warm*.045+silver*.02,.66+pathTone*.16-warm*.005+silver*.025,.55+pathTone*.13-warm*.03+silver*.095);color.multiplyScalar(.9+.10*Math.sin(x*.14)*Math.cos(z*.11));colors.push(color.r,color.g,color.b);terrain.attributes.uv.setXY(i,x/3.4,z/3.4);
    const patch=.90+.06*Math.sin(x*.19+z*.14)+.04*Math.cos(z*.28-x*.09);soilWeights.push(smooth(1.45,4.3,n.offset)*patch*smooth(-.30,-.01,y),1-smooth(-.1,.3,y),warm);
  }
  terrain.setAttribute('aChapterSoil',new THREE.Float32BufferAttribute(soilWeights,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();const land=mesh(terrain,materials.ground);land.castShadow=false;land.name='Continuous sculpted soil and river bed';
  // Sample the rendered triangle, so feet and the river floor agree even on
  // steep banks. This also avoids rebuilding the procedural field each step.
  function sampleGround(x,z){
    const gx=clamp((x+100)/200*140,0,140-.000001),gz=clamp((z+330)/370*260,0,260-.000001),ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,a=iz*141+ix,b=a+141;
    return fx+fz<=1?tp.getY(a)*(1-fx-fz)+tp.getY(b)*fz+tp.getY(a+1)*fx:tp.getY(b+1)*(fx+fz-1)+tp.getY(b)*(1-fx)+tp.getY(a+1)*(1-fz);
  }
  // Local dressing/solids use the same baked triangles as feet on the new
  // grading. Existing terrain elsewhere keeps its prior authored placement.
  const placementHeight=(x,z)=>canalGradeWeight(x,z)>0?sampleGround(x,z):landHeight(x,z);

  const rocks=mergeVertices(new THREE.IcosahedronGeometry(1,2)), rp=rocks.attributes.position;
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),f=1+.14*Math.sin(x*8+z*2)*Math.cos(y*7)+.08*Math.cos(z*11);rp.setXYZ(i,x*f,y*f,z*f);}rocks.computeVertexNormals();
  // Canal I/O stays at the adventure's authored (.567,-5) anchor. Reserve its
  // complete source-to-field footprint, not just the three control positions.
  const plants=plantAssets(random), cellCount=16, cells=[];const dummy=new THREE.Object3D();
  function instances(geometry,material,transforms,parent) {
    if(!transforms.length)return;const batch=new THREE.InstancedMesh(geometry,material,transforms.length);batch.name=material===materials.fern?'Procedural fern instances':material===materials.grass?'Folded grass instances':material===materials.bark?'Forest trunk instances':material===materials.leaf?'Forest canopy instances':'Forest scatter instances';batch.userData.segmentedTrunk=material===materials.bark;batch.castShadow=material===materials.bark||material===materials.leaf;batch.receiveShadow=true;
    transforms.forEach((t,i)=>{dummy.position.copy(t.p);dummy.scale.copy(t.s);dummy.rotation.set(t.rx||0,t.ry||0,t.rz||0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(t.color)batch.setColorAt(i,t.color);});batch.computeBoundingSphere();parent.add(batch);if(material===materials.bark||material===materials.rock){batch.userData.cameraOccluder=true;cameraColliders.push(batch);}return batch;
  }
  for(let c=0;c<cellCount;c++) {
    const cell=new THREE.Group();cell.name=`Forest cell ${c}`;group.add(cell);const d0=c/cellCount*length,d1=(c+1)/cellCount*length,centre=sample((d0+d1)/2);
    const transforms={fern:[],grass:[],rock:[],moss:[],litter:[],tree:[[],[],[]]};
    for(let i=0;i<28;i++) {
      const d=r(d0,d1), side=i%2?1:-1, p=sample(d).addScaledVector(right(d),side*r(6,25)), near=nearest(p);
      if(near.offset<5.6||placementHeight(p.x,p.z)<-.1)continue;p.y=placementHeight(p.x,p.z)-.08;
      const size=r(.55,1.4), t={p,s:V(size,size*r(.8,1.15),size),ry:r(0,6.28),rx:r(-.07,.07),rz:r(-.075,.075)};transforms.tree[i%3].push(t);
    }
    for(let i=0;i<8;i++){const d=r(d0,d1),p=sample(d).addScaledVector(right(d),(i%2?1:-1)*r(26,37));if(nearest(p).offset<14)continue;p.y=placementHeight(p.x,p.z)-.1;const size=r(.9,1.5);transforms.tree[i%3].push({p,s:V(size,size,size),ry:r(0,6.28)});}
    for(let i=0;i<165;i++) {
      const d=r(d0,d1), side=i%2?1:-1, p=sample(d).addScaledVector(right(d),side*r(3.9,14)), n=nearest(p);
      if(n.offset<(n.width||width(n.distance))+.25||placementHeight(p.x,p.z)<-.25)continue;
      p.y=placementHeight(p.x,p.z);const s=r(.45,1.3), key=i%4===0?'fern':'grass';transforms[key].push({p,s:V(s,s,s),ry:r(0,6.28),color:new THREE.Color().setHSL(r(.17,.27),r(.14,.28),r(.46,.68))});
    }
    for(let i=0;i<43;i++) {
      const d=r(d0,d1), p=sample(d).addScaledVector(right(d),(i%2?1:-1)*r(4.8,19)), n=nearest(p);if(n.offset<(n.width||width(n.distance))+.55)continue;
      p.y=placementHeight(p.x,p.z)-.15;const sx=r(.45,2.1),sy=r(.28,1.1),sz=r(.5,2.3);transforms.rock.push({p,s:V(sx,sy,sz),ry:r(0,6.28)});if(i%2===0)transforms.moss.push({p:p.clone().add(V(0,sy*.71,0)),s:V(sx*.84,sy*.31,sz*.84),ry:r(0,6.28)});
    }
    for(let i=0;i<90;i++){const d=r(d0,d1),p=sample(d).addScaledVector(right(d),r(-5,5));p.y=placementHeight(p.x,p.z)+.015;const s=r(.13,.34);transforms.litter.push({p,s:V(s,s,s),rx:-Math.PI/2+r(-.2,.2),ry:r(0,6.28)});}
    // A chapter is legible through its empty space as well as its assets.
    // Apply thinning before registration so removed trees leave no ghost walls.
    const hash=p=>{const v=Math.sin(p.x*12.9898+p.z*78.233)*43758.5453;return v-Math.floor(v);};
    const density=p=>{const n=nearest(p,true),f=n.distance/length,grove=.24+.76*smooth(-.6,.7,Math.sin(p.x*.20+p.z*.11)+.55*Math.cos(p.z*.23-p.x*.09));if(f<.145)return .62+.34*grove;if(f<.34)return (n.offset>24?.72:.18)*grove;if(f<.51)return (n.offset>25?.7:.39)*grove;if(f<.73)return (n.offset>23?.76:.25)*grove;return (n.offset>26?.5:.16)*grove;};
    const reserved=p=>CHAPTER_HEROES.some(a=>{const q=sample(a.fraction*length).addScaledVector(right(a.fraction*length),a.side);return p.distanceToSquared(q)<(a.radius+1.6)**2;})||CHAPTER_KILNS.some(a=>{const q=sample(a.fraction*length).addScaledVector(right(a.fraction*length),a.side);return p.distanceToSquared(q)<(3.2*a.scale)**2;});
    const inBambooClearing=p=>BAMBOO_STANDS.some(a=>p.distanceToSquared(sample(a.fraction*length).addScaledVector(right(a.fraction*length),a.side))<5.5**2);
    const inDomesticTreeClearance=p=>[[.55,-11,5.0,5.8],[DOMESTIC_HOUSE_SITE.fraction,DOMESTIC_HOUSE_SITE.side,4.3,4.3],[.610,-4.8,3.5,3.5]].some(([f,side,hx,hz])=>{const d=f*length,t=tangent(d),n=right(d),q=p.clone().sub(sample(d).addScaledVector(n,side));return Math.abs(q.dot(n))<hx&&Math.abs(q.dot(t))<hz;});
    for(let i=0;i<3;i++)transforms.tree[i]=transforms.tree[i].filter(t=>hash(t.p)<density(t.p)*interactionDensity(t.p,'tree')&&!reserved(t.p)&&!inBambooClearing(t.p)&&!inDomesticTreeClearance(t.p));
    if(c===0)for(const [f,side,size] of [[.022,-8.5,1.25],[.035,9.5,1.12]]){const p=sample(f*length).addScaledVector(right(f*length),side);p.y=placementHeight(p.x,p.z)-.08;transforms.tree[1].push({p,s:V(size,size*.95,size),ry:side<0?.8:2.3});}
    // V7: replace traversal's former full-height vertical tree cylinders with
    // height slices along the bent trunk. Foliage and the empty air beside a
    // leaning upper stem remain traversable.
    for(let variant=0;variant<3;variant++)for(const tr of transforms.tree[variant]){
      if(nearest(tr.p,true).offset>30)continue;
      const asset=plants.trees[variant],curve=new THREE.CatmullRomCurve3(asset.stem),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(tr.rx||0,tr.ry||0,tr.rz||0)),matrix=new THREE.Matrix4().compose(tr.p,q,tr.s);
      for(let j=0;j<12;j++){const u=j/12,k=u*(asset.stemRadii.length-1),i=Math.min(asset.stemRadii.length-2,Math.floor(k)),a=curve.getPoint(u).applyMatrix4(matrix),b=curve.getPoint((j+1)/12).applyMatrix4(matrix),radius=THREE.MathUtils.lerp(asset.stemRadii[i],asset.stemRadii[i+1],k-i)*Math.max(tr.s.x,tr.s.z)*1.22;
       colliders.push({x:(a.x+b.x)*.5,z:(a.z+b.z)*.5,r:radius+Math.hypot(b.x-a.x,b.z-a.z)*.5,minY:Math.min(a.y,b.y)-.025,height:Math.max(a.y,b.y)+.025,treeTrunk:true,reason:'古木的树干挡住了去路，绕过根脚，或振翼从枝间穿行。'});
      }
    }
    // Clear the cultivated patch, timber floor and hero silhouettes.
    const inDomesticPatch=(p,padding=0)=>[[.55,-11,4.05,4.7],[DOMESTIC_HOUSE_SITE.fraction,DOMESTIC_HOUSE_SITE.side,3.1,3.2]].some(([f,offset,hx,hz])=>{const d=f*length,t=tangent(d),n=right(d),q=p.clone().sub(sample(d).addScaledVector(n,offset));return Math.abs(q.dot(n))<hx+padding&&Math.abs(q.dot(t))<hz+padding;});
    const inWaterChannel=p=>{const n=nearest(p,true),f=n.distance/length;return (f>.546&&f<.595&&n.signed<-.9&&n.signed> -15.7)||(f>.397&&f<.437&&n.signed<-.8&&n.signed> -6.9);};
    transforms.fern=transforms.fern.filter(t=>!inDomesticPatch(t.p)&&!inWaterChannel(t.p)&&!reserved(t.p)&&hash(t.p)<Math.max(.22,density(t.p))*interactionDensity(t.p,'plant'));
    transforms.grass=transforms.grass.filter(t=>!inDomesticPatch(t.p)&&!reserved(t.p)&&hash(t.p)<Math.max(.4,density(t.p))*interactionDensity(t.p,'plant'));
    transforms.litter=transforms.litter.filter(t=>!inDomesticPatch(t.p)&&hash(t.p)<Math.max(.35,density(t.p)));
    // Filter before instancing: traversal derives rock solids from these same
    // retained instances, and moss below is retained only with its host rock.
    transforms.rock=transforms.rock.filter(t=>{const padding=Math.max(t.s.x,t.s.z)*1.24;return !inCanalFootprint(t.p,padding)&&!inDomesticPatch(t.p,padding)&&!reserved(t.p)&&hash(t.p)<(nearest(t.p,true).distance/length<.16?.38:.26)*interactionDensity(t.p,'rock',padding);});
    transforms.moss=transforms.moss.filter(t=>transforms.rock.some(a=>Math.abs(a.p.x-t.p.x)<.01&&Math.abs(a.p.z-t.p.z)<.01));
    for(let i=0;i<3;i++){instances(plants.trees[i].wood,materials.bark,transforms.tree[i],cell);instances(plants.trees[i].leaves,materials.leaf,transforms.tree[i],cell);}
    instances(plants.fern,materials.fern,transforms.fern,cell);instances(plants.grass,materials.grass,transforms.grass,cell);instances(rocks,materials.rock,transforms.rock,cell);instances(rocks,materials.moss,transforms.moss,cell);instances(plants.leaf,materials.litter,transforms.litter,cell);cells.push({group:cell,centre});
  }

  // V5 replaces the repeated round walls with authored scans. Their collision
  // proxies exist synchronously before traversal builds its spatial resolver.
  for(const a of CHAPTER_HEROES){const n=right(a.fraction*length),p=sample(a.fraction*length).addScaledVector(n,a.side),base=placementHeight(p.x,p.z),angle=Math.atan2(n.x,n.z)+a.yaw;for(const shape of chapterHeroFootprint(a)){const q=V(shape.x,0,shape.z).applyAxisAngle(UP,angle).add(p);colliders.push({x:q.x,z:q.z,r:shape.r,minY:base-.45,height:base+a.height,chapterHero:a.id,reason:a.asset==='rock_face_01'?'层岩挡住了去路，可以绕过岩脚或振翼越过。':'古木树根就在前方，绕过树根继续探索。'});}}
  for(const a of CHAPTER_KILNS){const n=right(a.fraction*length),p=sample(a.fraction*length).addScaledVector(n,a.side),base=placementHeight(p.x,p.z),angle=Math.atan2(n.x,n.z)+a.yaw;colliders.push({x:p.x,z:p.z,r:1.55*a.scale,minY:base,height:base+1.65*a.scale,reason:'陶窑仍有余温，请绕过窑身，从开口观察。'});for(const x of [-.95,.95])for(const z of [-2.3,-3]){const q=V(x*a.scale,0,z*a.scale).applyAxisAngle(UP,angle).add(p);colliders.push({x:q.x,z:q.z,r:.055*a.scale,minY:base,height:base+1.05*a.scale,reason:'晾架木柱就在前方，请从旁边经过。'});}}
  // V7: two living old trees frame an irregular opening. The silhouette is
  // grown upward through forks and broken tips, never a complete rubber arch.
  let rootCrown;
  function rootVault(fraction) {
    const origin=sample(fraction*length),t=tangent(fraction*length),vault=new THREE.Group(),angle=Math.atan2(t.x,t.z);
    vault.name='Ancient buttress root tunnel';vault.position.copy(origin);vault.rotation.y=angle;group.add(vault);rootCrown=vault;
    const wood=[],moss=[];
    const limb=(points,radii,steps=28,sides=12)=>{
      wood.push(taperedBranch(points,radii,steps,sides));
      const curve=new THREE.CatmullRomCurve3(points),count=Math.ceil(curve.getLength()/.5);
      for(let i=0;i<=count;i++){const f=i/count,k=f*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),radius=THREE.MathUtils.lerp(radii[j],radii[j+1],k-j)*1.23,q=curve.getPoint(f).applyAxisAngle(UP,angle).add(origin);if(radius<.09)continue;colliders.push({x:q.x,z:q.z,r:radius,minY:q.y-radius,height:q.y+radius,rootVault:true,reason:'古木在这里分叉，中央留着明亮的开口，也可以从枝间飞越。'});}
    };
    limb([V(-6.8,-.4,-1.2),V(-6.2,2.2,-.9),V(-5.9,5.9,-.2),V(-6.5,9.6,1.1),V(-5.2,13.3,1.3),V(-6.1,17.2,2.8)],[1.65,1.2,.93,.67,.39,.018],52,15);
    limb([V(-5.9,5.9,-.2),V(-4.1,8.1,.1),V(-2.2,9.6,.65),V(.5,10.4,.2),V(2.4,11.5,-.8)],[.76,.51,.31,.16,.018],37,12);
    limb([V(-6.5,9.6,1.1),V(-8.9,11.3,1.3),V(-11.4,11.9,2.5),V(-13.8,13.4,3.2)],[.53,.31,.16,.012],30,10);
    limb([V(-5.2,13.3,1.3),V(-2.5,15.1,2.7),V(-.8,15.9,4.8),V(.6,17.8,4.9)],[.31,.21,.10,.008],25,9);
    limb([V(6.2,-.3,1.5),V(5.7,2.6,1.8),V(6.3,5.3,1.1),V(5.6,9,.5),V(7.4,13.1,.8),V(7.1,16.3,-.8)],[1.38,.98,.73,.52,.26,.016],48,14);
    limb([V(6.3,5.3,1.1),V(4.9,7.9,.4),V(3.2,8.8,-.6),V(2.6,9.4,-2.1)],[.55,.36,.18,.065],31,10);
    limb([V(5.6,9,.5),V(8.8,10.8,.2),V(11.2,10.9,-1.1),V(13.4,12.1,-2.3)],[.47,.29,.13,.012],30,10);
    limb([V(7.4,13.1,.8),V(5.3,14.8,2.8),V(3.5,15.4,3.1),V(2.8,17.3,4.8)],[.27,.19,.09,.008],25,8);
    for(const side of [-1,1])for(let j=0;j<6;j++){
      const a=(-1.15+j*.46),x=side<0?-6.6:6.0,z=side<0?-1.1:1.5,reach=2.6+j*.2;
      limb([V(x,2.7+j*.13,z),V(x+side*Math.cos(a)*.85,.9,z+Math.sin(a)*.8),V(x+side*Math.cos(a)*reach,.17,z+Math.sin(a)*reach),V(x+side*Math.cos(a)*(reach+1.8),-.10,z+Math.sin(a)*(reach+1.8))],[.43-j*.026,.3,.13,.012],22,8);
    }
    // Slender liana follows its host's shape, so it reads as a living detail.
    for(let i=0;i<3;i++){const z=-1.5+i*.7;limb([V(-6.6+i*.1,.1,z),V(-6.0+i*.12,3.8,z+.4),V(-5.4+i*.25,6.8,z+.3),V(-3.1+i*.35,8.8,z+.5)],[.19,.13,.075,.012],26,6);}
    moss.push(taperedBranch([V(-6.9,.8,-.5),V(-6.4,3.1,-.3),V(-6.1,5.6,.1),V(-5.2,7.3,.5)],[.15,.19,.11,.01],28,7));
    mesh(combine(wood),materials.bark,vault).name='Forked old trees with buttress roots';mesh(combine(moss),materials.moss,vault).name='North-facing moss ridge';
    for(const [variant,p,s,rotation] of [[1,V(-5.9,5.7,1.4),V(.85,.77,.80),V(0,.7,0)],[2,V(6.6,5.1,1.1),V(.81,.76,.87),V(0,2.2,0)]]){const g=transformed(plants.trees[variant].leaves,p,s,rotation),o=mesh(g,materials.leaf,vault);o.name='Ancient crown leaf clusters';}
    const tip=new THREE.Mesh(new THREE.CircleGeometry(.067,14),materials.rock);tip.position.set(2.6,9.4,-2.1);tip.quaternion.setFromUnitVectors(V(0,0,1),V(-.6,.6,-1.5).normalize());vault.add(tip);
  }
  rootVault(.09);
  const bamboo=createBambooGrove({parent:group,forest:{length,path,sample,sampleGround,project},colliders,cameraColliders});

  // A broad shallow river is carved into the same connected ground surface.
  const waterPositions=[], waterUV=[], waterIndices=[];const riverSegments=320;
  for(let i=0;i<=riverSegments;i++) {
    const d=length*(.135+i/riverSegments*.84), p=sample(d), n=right(d), riverCenter=10.5+2*Math.sin(d*.027), half=d<length*.31?6.1:3.6;
    for(const side of [-1,1]){const bank=riverBankExtent({point:p,normal:n,center:riverCenter,side,minimum:half,groundAt:sampleGround}),q=p.clone().addScaledVector(n,riverCenter+side*bank);waterPositions.push(q.x,-.2,q.z);waterUV.push(side===-1?0:1,d*.1);}
    if(i<riverSegments){const a=i*2;waterIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(waterPositions,3));waterGeo.setAttribute('uv',new THREE.Float32BufferAttribute(waterUV,2));waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
  const waterMaterial=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:wind,uDeep:{value:new THREE.Color(0x102f2e)},uSky:{value:new THREE.Color(0x4c7770)}}]),vertexShader:`varying vec3 vWorld;varying vec2 vUv;#include <fog_pars_vertex>
    void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.6+p.z*.44)*.012;vWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;#include <fog_vertex>}`,fragmentShader:`uniform float uTime;uniform vec3 uDeep;uniform vec3 uSky;varying vec3 vWorld;varying vec2 vUv;#include <fog_pars_fragment>
    void main(){float rip=sin(vWorld.x*2.7+vWorld.z*.7+uTime*.9)*sin(vWorld.z*3.8-uTime*.65);vec3 n=normalize(vec3(rip*.11,1.,cos(vWorld.z*1.8+uTime)*.08));vec3 eye=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,eye),0.),2.5);float caustic=pow(max(0.,sin(vWorld.x*3.5+uTime*.45)*sin(vWorld.z*2.2-uTime*.37)),7.);vec3 col=mix(uDeep,uSky,fres*.38)+vec3(.19,.16,.09)*caustic*.28;float light=pow(max(0.,dot(reflect(-normalize(vec3(-.5,1.,-.4)),n),eye)),110.);col+=vec3(1.,.82,.48)*light*.45;float shore=smoothstep(0.,.065,vUv.x)*smoothstep(0.,.065,1.-vUv.x);gl_FragColor=vec4(col,.98*shore);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>}`,transparent:true,depthWrite:false,fog:true,side:THREE.DoubleSide});
  // Shader includes must begin on a separate line.
  waterMaterial.vertexShader=waterMaterial.vertexShader.replaceAll('#include','\n#include').replaceAll('>}', '>\n}');waterMaterial.fragmentShader=waterMaterial.fragmentShader.replaceAll('#include','\n#include').replaceAll('>}', '>\n}');
  const river=mesh(waterGeo,waterMaterial);river.castShadow=false;river.name='Reflective winding river';

  // Restrained warm shafts sit only in the first water opening. The final bay
  // is lit by V5's low sun; old overhead streaks competed with that focal point.
  // These are translucent geometry, not a screen-space volumetric simulation.
  const shaftMaterial=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(0xf4d79a)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;varying vec2 vUv;void main(){float a=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.)*sin(vUv.y*3.14159)*.047;gl_FragColor=vec4(tint,a);}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const waterShafts=[];
  for(const fraction of [.185])for(let i=0;i<3;i++){const d=fraction*length,p=sample(d).addScaledVector(right(d),i*2-3);p.y=7.5;const shaft=mesh(new THREE.PlaneGeometry(1.8,17),shaftMaterial,group,p);shaft.rotation.z=-.38;shaft.rotation.y=.6;shaft.castShadow=false;waterShafts.push(shaft);}

  const landmarks=[];
  for(const [id,name,fraction] of [['bird','铜鸟 · 临水',.20],['jade','玉琮 · 方圆',.42],['mask','金面 · 侧光',.60],['tiger','石虎 · 纹带',.77],['sun','太阳神鸟 · 日出',.94]]) {
    const distance=length*fraction, p=sample(distance), side=id==='bird'?1:-1, position=p.clone().addScaledVector(right(distance),side*2.35), altar=new THREE.Group();altar.position.copy(position);altar.name=name;group.add(altar);
    const boulder=mesh(rocks,materials.rock,altar,V(0,.32,0),V(1.8,.55,1.4));boulder.rotation.y=.7;
    colliders.push({x:position.x,z:position.z,r:1.45,height:.85});
    mesh(rocks,materials.moss,altar,V(-.4,.68,-.25),V(1.3,.12,.75));
    const object=new THREE.Group();object.name=id;pending.push(relicsReady.then(models=>{const model=models[id];model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});object.add(model);object.userData={...model.userData};}));object.scale.setScalar(id==='sun'?1.5:id==='bird'?.83:id==='tiger'?.78:.68);
    object.position.y=id==='bird'?.84:id==='sun'?3.9:id==='jade'?1.8:id==='tiger'?1.44:1.8;object.rotation.y=Math.atan2(-tangent(distance).x,-tangent(distance).z)+(id==='bird'?Math.PI/2:0);altar.add(object);
    object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const light=new THREE.PointLight(0xffd18a,id==='sun'?5:2,8,2);light.position.set(0,2.8,1);altar.add(light);
    // A few broken foil contours recur; the complete sun only exists at the final node.
    if(id==='sun'){const arcGeometry=new THREE.TorusGeometry(3.8,.013,4,80,Math.PI*1.18),arc=mesh(arcGeometry,materials.gold,altar,V(0,3.9,0));arc.rotation.z=.4;arc.rotation.y=object.rotation.y;}
    landmarks.push({id,name,distance,position:position.clone(),object,group:altar,baseY:object.position.y,light});
  }
  // Low-cost drifting pollen; world space, local visibility is controlled by depth fog.
  const moteGeometry=new THREE.BufferGeometry(), motePositions=[];
  for(let i=0;i<580;i++){const d=r(0,length),p=sample(d).addScaledVector(right(d),r(-9,9));motePositions.push(p.x,r(.6,9),p.z);}
  moteGeometry.setAttribute('position',new THREE.Float32BufferAttribute(motePositions,3));
  const moteMaterial=new THREE.PointsMaterial({color:0xf3dba0,size:.032,transparent:true,opacity:.58,depthWrite:false,sizeAttenuation:true});const motes=new THREE.Points(moteGeometry,moteMaterial);group.add(motes);

  function update(dt,time,player) {
    wind.value=time;waterMaterial.uniforms.uTime.value=time;
    const position=player?.position||player?.group?.position||player||V();
    const rootDistance=position.distanceTo(rootCrown.position);rootCrown.traverse(o=>{if(o.isMesh)o.castShadow=rootDistance<39;});
    for(const shaft of waterShafts)shaft.visible=shaft.position.distanceTo(position)<43;
    for(const cell of cells){const distance=cell.centre.distanceTo(position);cell.group.visible=distance<83;for(const object of cell.group.children)if(object.isInstancedMesh&&(object.material===materials.bark||object.material===materials.leaf))object.castShadow=distance<36;}
    const progress=nearest(position).distance/length;
    const clearing=smooth(.135,.19,progress)*(1-smooth(.26,.32,progress))+.65*smooth(.89,.94,progress);
    if(scene.fog?.isFog){scene.fog.color.lerpColors(new THREE.Color(0x29473f),new THREE.Color(0x8b9c83),clamp(clearing,0,1));scene.fog.near=16;scene.fog.far=68+clearing*14;}
    if(scene.background?.isColor)scene.background.lerpColors(new THREE.Color(0x29473f),new THREE.Color(0x8b9c83),clamp(clearing,0,1));
    motes.position.y=Math.sin(time*.15)*.2;
    for(const landmark of landmarks){landmark.object.position.y=landmark.baseY+Math.sin(time*.6+landmark.distance)*.045;landmark.light.intensity=landmark.id==='sun'?4.5:1.7;}
  }
  function dispose() {
    bamboo.dispose();group.removeFromParent();const geos=new Set(),mats=new Set();group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();
  }
  return {group,path,length,sample,project,constrain,update,landmarks,dispose,bamboo,ready:Promise.all(pending),surfaces:{bark:materials.bark,rock:materials.rock,soil:materials.ground,canopy:materials.leaf},sidePaths:sidePaths.map(p=>p.curve),colliders,cameraColliders,sampleGround,sampleMain:position=>nearest(position,true)};
}

