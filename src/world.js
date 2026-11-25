import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original, art-directed geometry inspired by Jinsha. These are not scan data.
let seed = 705;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const range = (a,b) => a + rand() * (b-a);
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
let palette;

function surface(base, accent, kind='stone') {
  const c=document.createElement('canvas'); c.width=c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  for(let i=0;i<6200;i++) {
    ctx.globalAlpha=range(.04,.24);ctx.fillStyle=rand()>.48?accent:'#151b14';
    const size=kind==='gold'?range(.2,2):range(.5,6);
    ctx.fillRect(range(0,256),range(0,256),size,kind==='bark'?range(12,55):size);
  }
  ctx.globalAlpha=.1;ctx.strokeStyle=accent;ctx.lineWidth=.7;
  for(let i=0;i<30;i++){ctx.beginPath();let y=range(0,256);ctx.moveTo(0,y);for(let j=0;j<9;j++)ctx.lineTo(j*32,y+Math.sin(j*2+i)*range(1,8));ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function materials(){
  if(palette)return palette;
  const stone=surface('#555844','#a29c72'),earth=surface('#554732','#b29968'),bark=surface('#57472e','#c0a365','bark'),gold=surface('#d5aa54','#ffe8a0','gold'),bronze=surface('#537966','#ae9e62'),jade=surface('#426c58','#bed0a7');
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=64;const lc=leafCanvas.getContext('2d');lc.fillStyle='#b1bd6c';lc.beginPath();lc.moveTo(32,2);lc.bezierCurveTo(63,20,55,44,32,62);lc.bezierCurveTo(8,43,3,21,32,2);lc.fill();lc.strokeStyle='#6b8041';lc.lineWidth=2;lc.beginPath();lc.moveTo(32,5);lc.lineTo(32,59);lc.stroke();for(let i=0;i<5;i++){lc.beginPath();lc.moveTo(32,12+i*8);lc.lineTo(17,20+i*7);lc.moveTo(32,12+i*8);lc.lineTo(47,20+i*7);lc.stroke();}const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;
  palette={
    stone:new THREE.MeshStandardMaterial({map:stone,bumpMap:stone,bumpScale:.10,color:0xaaa58e,roughness:.94}),
    soil:new THREE.MeshStandardMaterial({map:earth,bumpMap:earth,bumpScale:.09,color:0x938569,roughness:1}),
    rock:new THREE.MeshStandardMaterial({map:stone,bumpMap:stone,bumpScale:.14,color:0x758077,roughness:.96}),
    bark:new THREE.MeshStandardMaterial({map:bark,bumpMap:bark,bumpScale:.12,color:0x8d8967,roughness:.96}),
    moss:new THREE.MeshStandardMaterial({map:stone,bumpMap:stone,bumpScale:.065,color:0x607747,roughness:1}),
    leaf:new THREE.MeshStandardMaterial({color:0x496641,roughness:.94,side:THREE.DoubleSide}),
    leafLight:new THREE.MeshStandardMaterial({color:0x79824c,roughness:.91,side:THREE.DoubleSide}),
    leafDetail:new THREE.MeshStandardMaterial({map:leafTexture,color:0x9aab70,alphaTest:.5,roughness:.88,side:THREE.DoubleSide}),
    gold:new THREE.MeshStandardMaterial({map:gold,bumpMap:gold,bumpScale:.012,color:0xe8bb62,metalness:.86,roughness:.28,emissive:0x68421b,emissiveIntensity:.08}),
    bronze:new THREE.MeshStandardMaterial({map:bronze,bumpMap:bronze,bumpScale:.035,color:0x8dba9a,roughness:.61,metalness:.66}),
    jade:new THREE.MeshStandardMaterial({map:jade,bumpMap:jade,bumpScale:.018,color:0x95c5a2,roughness:.44,metalness:.06}),
    tiger:new THREE.MeshStandardMaterial({map:stone,bumpMap:stone,bumpScale:.035,color:0x8c9690,roughness:.62}),
    ivory:new THREE.MeshStandardMaterial({color:0xc5bc8d,roughness:.58}),
    dark:new THREE.MeshStandardMaterial({color:0x122721,roughness:.9}),
    glow:new THREE.MeshBasicMaterial({color:0xffc46b,toneMapped:false}),
  };return palette;
}
function mesh(geo,mat,parent,pos,scale){const m=new THREE.Mesh(geo,mat);if(pos)m.position.copy(pos);if(scale)m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function tube(points,radius,mat,parent){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*7),radius,7,false),mat,parent);}
function ring(radius,width,depth,mat,parent){
 const s=new THREE.Shape();s.absarc(0,0,radius,0,Math.PI*2,false);const h=new THREE.Path();h.absarc(0,0,radius-width,0,Math.PI*2,true);s.holes.push(h);
 return mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:depth*.35,bevelThickness:depth*.35,bevelSegments:2,steps:1,curveSegments:64}),mat,parent);
}
function extrude(shape,mat,parent,depth=.05){return mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,bevelThickness:.018,bevelSize:.018,steps:1,curveSegments:24}),mat,parent);}
function ellipseHole(x,y,rx,ry){const p=new THREE.Path();p.absellipse(x,y,rx,ry,0,Math.PI*2,true);return p;}

function sunRelic(m){
 const g=new THREE.Group(),outer=new THREE.Group(),inner=new THREE.Group();outer.name='outerRing';inner.name='innerSun';g.add(outer,inner);
 ring(1.48,.045,.035,m.gold,outer);ring(.38,.105,.04,m.gold,inner);
 for(let i=0;i<12;i++){
   const s=new THREE.Shape();s.moveTo(.33,-.065);s.quadraticCurveTo(.54,-.02,.67,.23);s.quadraticCurveTo(.51,.12,.35,.06);s.closePath();const ray=extrude(s,m.gold,inner,.03);ray.rotation.z=i*Math.PI/6;
 }
 for(let i=0;i<4;i++){
   // A long sweeping wing and hooked beak form each of the four birds.
   const s=new THREE.Shape();s.moveTo(.10,1.22);s.bezierCurveTo(.48,1.18,.86,1.03,1.08,.65);s.bezierCurveTo(.89,.81,.67,.84,.52,.83);s.bezierCurveTo(.42,.82,.37,.72,.24,.75);s.bezierCurveTo(.08,.78,.07,.94,.21,.99);s.lineTo(.40,.98);s.lineTo(.20,1.08);s.bezierCurveTo(.05,1.13,-.23,1.10,-.48,.88);s.bezierCurveTo(-.26,1.21,-.08,1.31,.10,1.22);s.closePath();
   const b=extrude(s,m.gold,outer,.035);b.rotation.z=i*Math.PI/2;
   // Slender connecting flight feathers keep the rhythm of the original foil.
   const tail=new THREE.Shape();tail.moveTo(.73,.90);tail.quadraticCurveTo(1.20,.38,1.08,-.10);tail.quadraticCurveTo(1.33,.52,.99,.94);tail.closePath();const t=extrude(tail,m.gold,outer,.03);t.rotation.z=i*Math.PI/2;
 }
 return g;
}
function maskRelic(m){
 const g=new THREE.Group(),s=new THREE.Shape();s.moveTo(-1.28,.83);s.bezierCurveTo(-.7,1.07,.7,1.07,1.28,.83);s.lineTo(1.40,-.30);s.quadraticCurveTo(1.08,-.85,.65,-1.02);s.quadraticCurveTo(0,-1.12,-.65,-1.02);s.quadraticCurveTo(-1.08,-.85,-1.4,-.30);s.closePath();
 for(const sign of [-1,1]){const h=new THREE.Path();h.moveTo(sign*.23,.20);h.quadraticCurveTo(sign*.63,.49,sign*1.11,.20);h.quadraticCurveTo(sign*.75,-.02,sign*.34,.08);h.closePath();s.holes.push(h);}
 const mouth=new THREE.Path();mouth.moveTo(-.49,-.60);mouth.quadraticCurveTo(0,-.72,.49,-.60);mouth.lineTo(.46,-.73);mouth.quadraticCurveTo(0,-.85,-.46,-.73);mouth.closePath();s.holes.push(mouth);
 const face=extrude(s,m.gold,g,.055);const pos=face.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,pos.getZ(i)+.33*(1-x*x/2.1)+.08*Math.cos(y*2));}face.geometry.computeVertexNormals();
 const nose=new THREE.Shape();nose.moveTo(-.14,.43);nose.lineTo(.14,.43);nose.lineTo(.28,-.34);nose.quadraticCurveTo(0,-.47,-.28,-.34);nose.closePath();const n=extrude(nose,m.gold,g,.16);n.position.z=.43;
 for(const sign of [-1,1]){const ear=new THREE.Shape();ear.moveTo(sign*1.23,.57);ear.lineTo(sign*1.78,.66);ear.quadraticCurveTo(sign*1.85,-.4,sign*1.38,-.5);ear.closePath();const e=extrude(ear,m.gold,g,.045);e.rotation.y=sign*.25;e.position.z=-.08;
 const eyebrow=tube([V(sign*.23,.36,.46),V(sign*.63,.55,.41),V(sign*1.13,.35,.22)],.038,m.gold,g);eyebrow.name='brow';}
 return g;
}
function jadeRelic(m){
 const g=new THREE.Group();
 for(let i=0;i<10;i++){
   const s=new THREE.Shape();const a=.62;s.moveTo(-a,-a);s.lineTo(a,-a);s.lineTo(a,a);s.lineTo(-a,a);s.closePath();s.holes.push(ellipseHole(0,0,.41,.41));
   const section=extrude(s,m.jade,g,.245);section.rotation.x=-Math.PI/2;section.position.y=-1.3+i*.262;
   for(let side=0;side<4;side++){
     const ornament=new THREE.Group();ornament.position.y=-1.22+i*.262;ornament.rotation.y=side*Math.PI/2;g.add(ornament);
     for(const x of [-.36,.36]){const r=ring(.085,.023,.019,m.jade,ornament);r.position.set(x,0,.638);}
     for(const y of [-.055,.055])mesh(new THREE.BoxGeometry(1.17,.026,.024),m.jade,ornament,V(0,y,.636));
     mesh(new THREE.BoxGeometry(.18,.05,.035),m.jade,ornament,V(0,-.014,.65));
   }
 }
 // Round collars expose the hollow bore at both ends.
 for(const y of [-1.36,1.35]){const collar=ring(.57,.16,.10,m.jade,g);collar.rotation.x=-Math.PI/2;collar.position.y=y;}
 return g;
}
function figureRelic(m){
 const g=new THREE.Group();mesh(new THREE.CylinderGeometry(.28,.39,1.18,16),m.bronze,g,V(0,-.15,0));
 mesh(new THREE.SphereGeometry(.31,16,12),m.bronze,g,V(0,.75,0),V(.86,1.2,.8));
 mesh(new THREE.BoxGeometry(.12,.28,.21),m.bronze,g,V(0,.76,.21));
 for(const sign of [-1,1]){mesh(new THREE.BoxGeometry(.11,.025,.04),m.dark,g,V(sign*.13,.85,.235));tube([V(sign*.28,.33,0),V(sign*.48,.1,.12),V(sign*.31,.23,.43)],.09,m.bronze,g);const fist=ring(.13,.065,.12,m.bronze,g);fist.position.set(sign*.17,.24,.39);fist.rotation.y=sign*.4;
 tube([V(sign*.16,-.67,0),V(sign*.16,-1.05,0),V(sign*.18,-1.24,.1)],.09,m.bronze,g);}
 mesh(new THREE.CylinderGeometry(.27,.18,.30,16),m.bronze,g,V(0,-1.42,0));
 const cap=mesh(new THREE.SphereGeometry(.37,24,12,0,Math.PI*2,0,Math.PI/2),m.bronze,g,V(0,1.02,0));cap.scale.y=.28;
 for(let i=0;i<13;i++){let a=(i/12)*Math.PI;const b=mesh(new THREE.BoxGeometry(.065,.28,.055),m.bronze,g,V(Math.cos(a)*.40,1.05+Math.sin(a)*.20,0));b.rotation.z=a-Math.PI/2;}
 tube([V(0,.8,-.23),V(.10,.35,-.31),V(.1,-.3,-.29)],.055,m.bronze,g);
 return g;
}
function tigerRelic(m){
 const g=new THREE.Group();mesh(new THREE.SphereGeometry(1,22,14),m.tiger,g,V(0,-.36,0),V(1.14,.38,.46));
 mesh(new THREE.SphereGeometry(.52,18,14),m.tiger,g,V(-.88,.05,0),V(.72,1.45,.85));
 mesh(new THREE.SphereGeometry(.48,18,14),m.tiger,g,V(-1.03,.60,0),V(.95,.92,.92));
 mesh(new THREE.BoxGeometry(.46,.13,.52),m.tiger,g,V(-1.34,.48,0));mesh(new THREE.BoxGeometry(.31,.10,.41),m.dark,g,V(-1.46,.37,0));mesh(new THREE.BoxGeometry(.45,.10,.48),m.tiger,g,V(-1.32,.29,0));
 for(const z of [-.31,.31]){mesh(new THREE.SphereGeometry(.14,12,8),m.tiger,g,V(-.86,.98,z),V(.8,1,.7));mesh(new THREE.SphereGeometry(.048,10,8),m.dark,g,V(-1.25,.68,z*1.20));
 mesh(new THREE.SphereGeometry(.26,16,10),m.tiger,g,V(-.78,-.56,z*1.4),V(1.7,.5,.65));mesh(new THREE.SphereGeometry(.29,16,10),m.tiger,g,V(.68,-.53,z),V(1.4,.6,.8));}
 tube([V(.85,-.3,0),V(1.42,-.3,.20),V(1.50,-.4,.50),V(.98,-.45,.56)],.085,m.tiger,g);
 for(let i=0;i<6;i++){let x=-.3+i*.23;tube([V(x,-.05,-.38),V(x+.06,.025,0),V(x-.08,-.05,.39)],.018,m.ivory,g);}
 g.rotation.y=-Math.PI/2;return g;
}

function consolidate(target){
  target.updateMatrixWorld(true);const inverse=target.matrixWorld.clone().invert(),parts=new Map(),old=[];
  target.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!parts.has(o.material))parts.set(o.material,[]);parts.get(o.material).push(geo.index?geo.toNonIndexed():geo);old.push(o);});
  for(const o of old){o.removeFromParent();o.geometry.dispose();}
  for(const [material,geos] of parts){const merged=mergeGeometries(geos,false);if(merged)mesh(merged,material,target);for(const geo of geos)geo.dispose();}
}
export function createRelic(id,scale=1){const m=materials();const builders={sun:sunRelic,mask:maskRelic,jade:jadeRelic,figure:figureRelic,tiger:tigerRelic};const g=(builders[id]||sunRelic)(m);if(id==='sun'){for(const child of [...g.children])consolidate(child);}else consolidate(g);g.scale.setScalar(scale);g.name=id;return g;}

export function createWorld(scene){
 seed=705;const m=materials(),group=new THREE.Group();group.name='Jinsha memory islands';scene.add(group);
 const batches=new Map(),temp=new THREE.Object3D();const animated=[];let awakened=false;
 function put(geo,mat,pos=V(),scale=V(1,1,1),rotation=V()){
   temp.position.copy(pos);temp.scale.copy(scale);temp.rotation.set(rotation.x,rotation.y,rotation.z);temp.updateMatrix();const copy=geo.clone().applyMatrix4(temp.matrix);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(copy);
 }
 const sphere=new THREE.IcosahedronGeometry(1,1),rockGeo=mergeVertices(new THREE.IcosahedronGeometry(1,2)),slabGeo=new RoundedBoxGeometry(1,1,1,2,.055),leafGeo=new THREE.SphereGeometry(1,9,6),leafCard=new THREE.PlaneGeometry(.42,.71,1,2);
 // Slightly folded leaves catch different light rather than looking like flat decals.
 for(let i=0;i<leafCard.attributes.position.count;i++){const p=leafCard.attributes.position;p.setZ(i,Math.abs(p.getY(i))*.11+Math.abs(p.getX(i))*.16);}leafCard.computeVertexNormals();
 const bladeGeo=new THREE.BufferGeometry();bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,-.03,.34,.055,.03,.34,.055,0,.72,.19],3));bladeGeo.setIndex([0,1,2,2,1,3,2,3,4]);bladeGeo.computeVertexNormals();
 // Rock surfaces are displaced once; merged batches retain dramatic silhouette at low draw cost.
 for(let i=0;i<rockGeo.attributes.position.count;i++){const p=rockGeo.attributes.position,x=p.getX(i),y=p.getY(i),z=p.getZ(i);const f=1+.11*Math.sin(x*8+z*3)*Math.cos(y*7-z*4)+.06*Math.cos(z*11+y*6);p.setXYZ(i,x*f,y*f,z*f);}rockGeo.computeVertexNormals();
 function island(cx,cy,cz,r){
   put(new THREE.CylinderGeometry(r*.96,r*.77,1.5,48,1),m.soil,V(cx,cy-.8,cz));
   put(new THREE.ConeGeometry(r*.87,r*1.08,15,3),m.rock,V(cx,cy-r*.50-1,cz),V(1,1,1),V(Math.PI,0,0));
   for(let i=0;i<90;i++){const a=range(0,Math.PI*2),d=Math.sqrt(rand())*r*.98,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;const sz=range(.45,1.65)*(i<35?1.5:1);put(rockGeo,i%5===0?m.moss:m.rock,V(x,cy-range(.05,.45),z),V(sz,range(.25,.9),sz*range(.7,1.4)),V(range(0,3),range(0,6),range(0,3)));}
   for(let i=0;i<36;i++){const a=i/36*Math.PI*2,d=r*range(.82,1);put(rockGeo,m.rock,V(cx+Math.cos(a)*d,cy-range(1,4),cz+Math.sin(a)*d),V(range(1,2.8),range(1.5,4),range(1,2.8)),V(range(0,2),a,range(0,2)));}
   for(let i=0;i<28;i++){const a=range(0,Math.PI*2),d=range(.2,.9)*r;put(rockGeo,m.moss,V(cx+Math.cos(a)*d,cy-.04,cz+Math.sin(a)*d),V(range(.8,2.5),range(.04,.10),range(.6,2)),V(0,a,0));}
   // Fine hanging roots descending below the island rim.
   for(let i=0;i<13;i++){const a=range(0,Math.PI*2),x=cx+Math.cos(a)*r*.87,z=cz+Math.sin(a)*r*.87;const pts=[V(x,cy,z),V(x+range(-.5,.5),cy-2,z),V(x+range(-1,1),cy-range(4,8),z+range(-1,1))];put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,range(.03,.08),5,false),m.bark);}
 }
 island(0,0,0,19);island(26,1,-22,10);island(-26,2,-23,10);island(0,4,-49,12);
 for(const p of [[-36,-3,4,4],[35,-7,8,5],[-15,-2,-58,3],[18,-4,-42,4],[-45,-8,-44,6],[49,-7,-46,6]])island(...p);
 // Old flagstones guide the player between roots and monuments.
 function path(cx,cy,z1,z2,width=3){for(let z=z1;z>z2;z-=1.18){for(let j=-1;j<=1;j++){put(slabGeo,m.stone,V(cx+j*width*.34+range(-.06,.06),cy+.12,z+range(-.12,.12)),V(width*.31,range(.18,.30),.99),V(range(-.02,.02),range(-.045,.045),range(-.02,.02)));}}}
 path(0,0,17,-12,4);path(26,1,-14,-29,3);path(-26,2,-15,-30,3);path(0,4,-39,-56,3.5);
 function pedestal(x,y,z,r=2){put(new THREE.CylinderGeometry(r,r*1.15,.45,8),m.stone,V(x,y+.2,z));put(new THREE.CylinderGeometry(r*.87,r,.4,8),m.bronze,V(x,y+.6,z));put(new THREE.CylinderGeometry(r*.92,r*.92,.12,48),m.stone,V(x,y+.85,z));for(let i=0;i<12;i++){const a=i/12*Math.PI*2;put(slabGeo,m.gold,V(x+Math.cos(a)*r*.93,y+.71,z+Math.sin(a)*r*.93),V(.12,.15,.1),V(0,-a,0));}}
 pedestal(-8,0,4,1.5);pedestal(26,1,-22,2.7);pedestal(-26,2,-23,2.6);pedestal(0,4,-49,2.4);
 // Layered masonry arch at the entry. The irregular wedges avoid a toy-block outline.
 function stoneArch(cx,cy,cz,r,height){
   for(const side of [-1,1]){for(let i=0;i<5;i++){
     put(slabGeo,m.stone,V(cx+side*r+range(-.05,.05),cy+i*.75+.38,cz+range(-.06,.06)),V(range(1.17,1.30), .70,range(1.40,1.64)),V(range(-.035,.035),range(-.06,.06),range(-.025,.025)));
     if(i%2===0){put(rockGeo,m.rock,V(cx+side*(r+.49),cy+i*.75+.12,cz+.62),V(.28,.19,.20),V(.6,i,.4));}
   }}
   for(let i=0;i<=11;i++){const a=i/11*Math.PI;put(slabGeo,m.stone,V(cx+Math.cos(a)*r,cy+3.5+Math.sin(a)*r,cz+range(-.06,.06)),V(range(1.16,1.26),range(1.03,1.16),range(1.45,1.64)),V(range(-.03,.03),range(-.04,.04),a-Math.PI/2+range(-.018,.018)));}
   for(let i=0;i<16;i++){const a=range(0,Math.PI);put(rockGeo,m.moss,V(cx+Math.cos(a)*r,cy+3.65+Math.sin(a)*r,cz+.2),V(range(.3,.7),.13,range(.3,.6)));}
   // Roots coil outside the opening and hang above, leaving the central flight route clear.
   for(const side of [-1,1]){
     for(let strand=0;strand<3;strand++){
       const points=[];
       for(let k=0;k<15;k++){const h=k*.48,a=k*.72+strand*2;points.push(V(cx+side*(r+.15)+Math.sin(a)*.56,cy+h,cz+Math.cos(a)*.78));}
       put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,range(.045,.085),6,false),m.bark);
       for(let j=0;j<20;j++){const p=points[2+Math.floor(rand()*11)].clone().add(V(range(-.3,.3),range(-.2,.2),range(-.14,.14)));put(leafCard,m.leafDetail,p,V(.6,.6,.6),V(range(-1,1),range(-2,2),range(-2,2)));}
     }
     // Patinated spirals are a visual motif, not an invented archaeological reconstruction.
     const spiral=[];for(let i=0;i<31;i++){const a=i/30*Math.PI*3,rr=.38*(1-i/34);spiral.push(V(cx+side*r+Math.cos(a)*rr,cy+2.5+Math.sin(a)*rr,cz+.87));}
     put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral),48,.028,5,false),m.bronze);
   }
 }
 stoneArch(0,0,14,4,7.5);
 // Giant tree, twisted trunk, buttress roots, branch systems and hundreds of leaf clusters.
 function branch(points,r){put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*6),r,8,false),m.bark);}
 const tx=-10,tz=-1;
 branch([V(tx,0,tz),V(tx-.3,3,tz),V(tx+1,6,tz-.3),V(tx+.3,10,tz),V(tx-1,14,tz-1)],1.1);
 for(let i=0;i<11;i++){const a=i/11*Math.PI*2;branch([V(tx,2.8,tz),V(tx+Math.cos(a)*1.2,.8,tz+Math.sin(a)*1.2),V(tx+Math.cos(a)*3.3,.18,tz+Math.sin(a)*3.3),V(tx+Math.cos(a)*5.4,.05,tz+Math.sin(a)*5.4)],range(.13,.36));}
 for(let i=0;i<13;i++){
   const a=i*2.39996,len=range(4,8),h=range(7,13),end=V(tx+Math.cos(a)*len,h+range(1,3),tz+Math.sin(a)*len);
   branch([V(tx+.2,h-4,tz),V(tx+Math.cos(a)*len*.32,h-1,tz+Math.sin(a)*len*.32),V(tx+Math.cos(a)*len*.7,h+.1,tz+Math.sin(a)*len*.7),end],range(.22,.46));
   for(let j=0;j<6;j++){const aa=a+range(-1.2,1.2),e=end.clone().add(V(Math.cos(aa)*range(1,3),range(-.4,1.5),Math.sin(aa)*range(1,3)));branch([end.clone().lerp(V(tx,h-2,tz),.4),end,e],range(.045,.11));
     for(let k=0;k<9;k++){
       const p=e.clone().add(V(range(-1.2,1.2),range(-.3,.5),range(-1.2,1.2)));
       // The silhouette is made from individual folded leaves with open gaps for sky.
       for(let l=0;l<24;l++){
         const la=l*2.39996,lr=Math.sqrt(rand())*1.12;
         const lp=p.clone().add(V(Math.cos(la)*lr,range(-.28,.46),Math.sin(la)*lr));
         const ls=range(.72,1.28);put(leafCard,m.leafDetail,lp,V(ls,ls,ls),V(range(-1.65,-.65),range(0,6),range(-.65,.65)));
       }
     }
   }
   if(i%2===0){const v=end.clone().add(V(0,-range(2,5),0));branch([end,end.clone().add(V(.1,-1,0)),v],.025);}
 }
 // Tall reeds and ferns frame the walking/flying corridor.
 for(let i=0;i<160;i++){
   const a=range(0,Math.PI*2),r=range(7,18),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<3)continue;
   for(let k=0;k<9;k++){const ang=k*2.4+a,h=range(.35,1.2);put(bladeGeo,k%3===0?m.leafLight:m.leaf,V(x+Math.cos(ang)*.15,0,z+Math.sin(ang)*.15),V(range(.8,1.6),h,h),V(range(-.12,.12),ang,range(-.12,.12)));}
   // A few horizontal fern leaflets interrupt the upright grass rhythm.
   if(i%4===0)for(let k=0;k<7;k++){const h=k*.075,reach=.42*(1-k/8);for(const side of [-1,1])put(leafCard,m.leafDetail,V(x+side*reach,h+.16,z),V(.45,.65,.45),V(-.8,side*.4,side*1.1));}
 }
 // Ivory archways refer to the ritual deposits without pretending to reconstruct a building.
 for(let j=0;j<3;j++)for(const sign of [-1,1]){
   const z=-43-j*4.2,pts=[V(sign*4,4,z),V(sign*4.1,7,z-.4),V(sign*3.1,10,z-.6),V(sign*1.3,12,z-1)];
   const curve=new THREE.CatmullRomCurve3(pts),geo=new THREE.TubeGeometry(curve,32,.37,10,false);const p=geo.attributes.position; // tapered ivory tips
   for(let i=0;i<p.count;i++){const ringId=Math.floor(i/11),t=ringId/32,center=curve.getPointAt(Math.min(1,t));const f=1-t*.93;p.setXYZ(i,center.x+(p.getX(i)-center.x)*f,center.y+(p.getY(i)-center.y)*f,center.z+(p.getZ(i)-center.z)*f);}geo.computeVertexNormals();put(geo,m.ivory);
   for(let k=0;k<3;k++){const pos=curve.getPoint(k*.13+.05);put(new THREE.TorusGeometry(.39,.035,6,16),m.bronze,pos,V(1,1,1),V(Math.PI/2,0,0));}
 }
 // Broken jade gate surrounding the jade island.
 for(const sign of [-1,1]){
   put(slabGeo,m.jade,V(26+sign*4.3,3.2,-26),V(2.3,4.4,2.3));
   for(let i=0;i<5;i++)put(slabGeo,m.bronze,V(26+sign*4.3,1.4+i*.82,-24.8),V(2.1,.095,.08));
   const torus=new THREE.TorusGeometry(.7,.10,8,32);put(torus,m.jade,V(26+sign*4.3,4,-24.79));
 }
 put(slabGeo,m.jade,V(26,5.8,-26),V(10.9,1.1,2.5));
 // Ritual bronze uprights and small sconces.
 const flames=[];
 function brazier(x,y,z){
   put(new THREE.CylinderGeometry(.23,.42,1.4,8),m.bronze,V(x,y+.7,z));put(new THREE.CylinderGeometry(.60,.25,.35,12,1,true),m.bronze,V(x,y+1.45,z));
   const flame=mesh(new THREE.SphereGeometry(.19,12,12),m.glow,group,V(x,y+1.82,z),V(1,2.6,1));flame.castShadow=false;flames.push(flame);
   const l=new THREE.PointLight(0xffaf4d,9,7,2);l.position.set(x,y+2,z);group.add(l);
 }
 brazier(-4.8,0,9);brazier(4.8,0,9);brazier(-26,2,-16);brazier(26,1,-15);brazier(-3.5,4,-42);brazier(3.5,4,-42);
 for(const sign of [-1,1]){put(new THREE.CylinderGeometry(.35,.6,3.7,8),m.bronze,V(sign*7,1.85,-7));for(let j=0;j<3;j++)put(new THREE.TorusGeometry(.42,.07,6,16),m.gold,V(sign*7,.7+j*1.1,-7),V(1,1,1),V(Math.PI/2,0,0));}
 // Consolidate hundreds of static details by material.
 for(const [mat,geos] of batches){const merged=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g),false);if(merged){const b=mesh(merged,mat,group);b.name='landscape';}for(const geo of geos)geo.dispose();}
 const configurations=[['sun',V(2,10,-7),4.4],['mask',V(-26,7,-23),1.65],['jade',V(26,5.4,-22),1.8],['figure',V(-8,3.4,4),1.25],['tiger',V(0,7.3,-49),1.35]];
 const interaction={sun:V(2,8,-5),mask:V(-26,7,-22),jade:V(26,7,-21),figure:V(-8,4,4),tiger:V(0,8,-46)};
 const artifacts=configurations.map(([id,pos,s])=>{const r=createRelic(id,s);r.position.copy(pos);r.userData.baseY=pos.y;group.add(r);return{id,position:interaction[id],mesh:r};});
 // Thin floor rings and glints carry navigation visually, without covering the view.
 const beacons=[];
 for(const a of artifacts){if(a.id==='sun')continue;const b=new THREE.Mesh(new THREE.RingGeometry(.86,.89,64),new THREE.MeshBasicMaterial({color:0xe7c777,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));b.rotation.x=-Math.PI/2;b.position.copy(a.mesh.position);b.position.y-=2;group.add(b);beacons.push(b);}
 const count=650,pp=new Float32Array(count*3),colors=new Float32Array(count*3);for(let i=0;i<count;i++){pp[i*3]=range(-50,50);pp[i*3+1]=range(-5,25);pp[i*3+2]=range(-70,28);colors[i*3]=1;colors[i*3+1]=range(.66,.91);colors[i*3+2]=range(.24,.57);}const particlesGeo=new THREE.BufferGeometry();particlesGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));particlesGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const pc=document.createElement('canvas');pc.width=pc.height=32;const px=pc.getContext('2d'),gradient=px.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.15,'rgba(255,255,255,.8)');gradient.addColorStop(1,'rgba(255,255,255,0)');px.fillStyle=gradient;px.fillRect(0,0,32,32);
 const motes=new THREE.Points(particlesGeo,new THREE.PointsMaterial({map:new THREE.CanvasTexture(pc),size:.16,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(motes);
 const outer=artifacts[0].mesh.getObjectByName('outerRing'),inner=artifacts[0].mesh.getObjectByName('innerSun');
 return {group,artifacts,update(time,delta){
   for(const a of artifacts){if(a.id!=='sun'){a.mesh.position.y=a.mesh.userData.baseY+Math.sin(time*.6+a.mesh.position.x)*.13;a.mesh.rotation.y=Math.sin(time*.18+a.mesh.position.x)*.12;}}
   outer.rotation.z=time*(awakened?.09:.012);inner.rotation.z=-time*(awakened?.14:.018);
   motes.rotation.y=Math.sin(time*.025)*.025;for(let i=0;i<flames.length;i++){flames[i].scale.y=2.3+Math.sin(time*8+i*2)*.45;flames[i].scale.x=.9+Math.sin(time*11+i)*.15;}
   beacons.forEach((b,i)=>b.material.opacity=.3+Math.sin(time*1.2+i)*.12);
 },setAwakened(value){awakened=!!value;materials().gold.emissiveIntensity=awakened?.4:.12;}};
}
