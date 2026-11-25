import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original authored geometry, informed by museum photographs and catalogue text.
// These are interpretive game assets, never photogrammetry or measured replicas.
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function hash(x,y,z=0) { const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n); }
function noise(x,y,z=0) {
  const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,y-j),w=smooth(0,1,z-k);
  return mix(mix(mix(hash(i,j,k),hash(i+1,j,k),u),mix(hash(i,j+1,k),hash(i+1,j+1,k),u),v),mix(mix(hash(i,j,k+1),hash(i+1,j,k+1),u),mix(hash(i,j+1,k+1),hash(i+1,j+1,k+1),u),v),w);
}
function fbm(x,y,z=0) {return noise(x,y,z)*.58+noise(x*2.03,y*2.03,z*2.03)*.27+noise(x*4.13,y*4.13,z*4.13)*.15;}

let palette;
function textureSet(kind) {
  // Continuous multiscale pigment / corrosion and subtle hammer depressions.
  // Data textures avoid Canvas color-management differences; no square stamps.
  const size=384,color=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size,n=fbm(u*12,v*12,2),micro=noise(u*185,v*185,8),n2=fbm(u*37,v*37,1);
    let rgb,h,r;
    if(kind==='gold') {
      const hammer=noise(u*45+2*noise(u*8,v*8),v*45,4),scratch=Math.pow(Math.max(0,Math.sin(u*670+noise(u*5,v*6)*12)),35);
      const stain=smooth(.58,.82,n),f=.93+.075*n2-.07*stain;
      rgb=[239*f,200*f,120*f];h=.5+.12*(hammer-.5)+.06*(micro-.5)-.035*scratch;r=.5+.2*n+.10*stain;
    } else if(kind==='bronze') {
      const patina=.46+.54*smooth(.34,.64,n),pit=smooth(.67,.82,n2),f=.86+.22*micro;
      rgb=[mix(112,66,patina)*f,mix(99,115,patina)*f,mix(59,98,patina)*f];h=.48+.15*n2-.13*pit;r=.65+.24*patina;
    } else if(kind==='jade') {
      const milk=smooth(.48,.69,n),inclusion=smooth(.65,.76,n2)*smooth(.38,.6,n);
      rgb=[172+n2*15,183+n2*15,158+n2*15];h=.5+(micro-.5)*.025;r=.49+.15*milk+.12*inclusion;
    } else {
      const vein=Math.pow(1-Math.abs(Math.sin(u*28+v*19+fbm(u*7,v*7)*9)),9),grain=.83+.25*micro;
      rgb=[(98+vein*42)*grain,(105+vein*40)*grain,(108+vein*28)*grain];h=.5+.07*n2+.06*micro;r=.73+.17*n2;
    }
    const i=(y*size+x)*4;for(let c=0;c<3;c++){color[i+c]=rgb[c];height[i+c]=clamp(h*255,0,255);rough[i+c]=clamp(r*255,0,255);}color[i+3]=height[i+3]=rough[i+3]=255;
  }
  const make=(data,srgb=false)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;};
  return {map:make(color,true),bumpMap:make(height),roughnessMap:make(rough)};
}
function materials(){
  if(palette)return palette;
  palette={
    gold:new THREE.MeshStandardMaterial({...textureSet('gold'),metalness:.96,roughness:.57,bumpScale:.009,side:THREE.DoubleSide,color:0xffffff,envMapIntensity:1.25}),
    bronze:new THREE.MeshStandardMaterial({...textureSet('bronze'),metalness:.5,roughness:.85,bumpScale:.012,color:0xffffff}),
    bronzeCut:new THREE.MeshStandardMaterial({color:0x25483e,metalness:.3,roughness:.78}),
    jade:new THREE.MeshPhysicalMaterial({...textureSet('jade'),color:0xffffff,metalness:0,roughness:.72,bumpScale:.003,clearcoat:.18,clearcoatRoughness:.42,vertexColors:true}),
    jadeCut:new THREE.MeshStandardMaterial({color:0x687c65,roughness:.65}),
    stone:new THREE.MeshStandardMaterial({...textureSet('stone'),color:0xffffff,roughness:.91,bumpScale:.008,vertexColors:true}),
    stoneCut:new THREE.MeshStandardMaterial({color:0x303c3d,roughness:.87}),
  };
  return palette;
}
function add(g,geo,mat,name) {const m=new THREE.Mesh(geo,mat);m.name=name;m.castShadow=m.receiveShadow=true;g.add(m);return m;}
function extrude(shape,depth=.02,bevel=.006,segments=24) {return new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel*.65,bevelSegments:3,curveSegments:segments});}
function ellipse(x,y,rx,ry) {const p=new THREE.Path();p.absellipse(x,y,rx,ry,0,TAU,true);return p;}
function ring(outer,inner,depth=.02) {if(outer<.04){const t=new THREE.TorusGeometry((outer+inner)/2,(outer-inner)/2,5,outer<.01?10:20);t.translate(0,0,depth/2);return t;}const s=new THREE.Shape();s.absarc(0,0,outer,0,TAU,false);s.holes.push(ellipse(0,0,inner,inner));return extrude(s,depth,.003,28);}
function tube(points,r=.01,segments=36){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,r,6,false);}
function merge(parts) {const clean=parts.map(p=>{const q=p.index?p.toNonIndexed():p;q.clearGroups();return q;});const result=mergeGeometries(clean);for(const p of clean)p.dispose();return result;}
function transform(geo,pos=V(),scale=V(1,1,1),rot=V()){geo.applyMatrix4(new THREE.Matrix4().compose(pos,new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x,rot.y,rot.z)),scale));return geo;}
function finish(g,id) {g.name=id;g.userData.assetVersion=4;g.userData.interpretation='Original museum-informed game model; not scan data';g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);g.userData.bounds={min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(V()).toArray()};return g;}

function bronzeBird(m) {
  const g=new THREE.Group(),profile=new THREE.Shape();
  // Side silhouette: raised head, S neck, tucked upward wings and folded tail.
  profile.moveTo(-.36,.80);profile.bezierCurveTo(-.72,.81,-.96,.97,-1.01,1.31);profile.bezierCurveTo(-1.13,.92,-.95,.65,-.66,.58);
  profile.bezierCurveTo(-.94,.52,-1.10,.61,-1.14,.36);profile.lineTo(-1.20,.10);profile.quadraticCurveTo(-.97,.05,-.91,.30);profile.quadraticCurveTo(-1.03,.22,-.99,.40);profile.lineTo(-.72,.48);profile.lineTo(-.70,.27);profile.quadraticCurveTo(-.45,.20,-.45,.43);
  profile.lineTo(-.26,.43);profile.lineTo(-.24,.15);profile.quadraticCurveTo(-.16,.04,.10,.04);profile.quadraticCurveTo(.12,-.06,.25,-.08);profile.quadraticCurveTo(.47,-.11,.41,.13);profile.lineTo(.20,.42);
  profile.bezierCurveTo(.51,.53,.53,.85,.51,1.10);profile.bezierCurveTo(.48,1.39,.64,1.51,.73,1.66);profile.quadraticCurveTo(.89,1.84,1.03,1.87);profile.quadraticCurveTo(.84,2.00,.63,1.85);
  profile.bezierCurveTo(.30,2.05,.04,1.86,.07,1.56);profile.bezierCurveTo(.12,1.02,-.05,.83,-.36,.80);profile.closePath();
  const body=extrude(profile,.22,.045);body.translate(0,0,-.11);add(g,body,m.bronze,'Cast bronze body and folded tail');
  const wingParts=[],relief=[],incisions=[];
  for(const side of [-1,1]) {
    const w=new THREE.Shape();w.moveTo(.26,.57);w.bezierCurveTo(-.04,.73,-.40,.47,-.75,1.15);w.bezierCurveTo(-.76,.81,-.54,.48,-.04,.46);w.quadraticCurveTo(.19,.45,.26,.57);w.closePath();
    const wg=extrude(w,.025,.015);wg.translate(0,0,side*.14-(side<0?.025:0));wingParts.push(wg);
    const z=side*.18;
    relief.push(transform(ring(.234,.200,.025),V(.32,1.64,z),V(1,1,1),V(0,side<0?Math.PI:0,0)));
    relief.push(transform(new THREE.SphereGeometry(.098,28,16),V(.32,1.64,z),V(1,1,.55)));
    incisions.push(transform(new THREE.SphereGeometry(.028,14,8),V(.32,1.64,z+side*.055),V(1,1,.35)));
    for(let i=0;i<12;i++){const a=i*TAU/12;incisions.push(transform(new THREE.SphereGeometry(.019,10,6),V(.32+Math.cos(a)*.164,1.64+Math.sin(a)*.164,z+side*.015),V(1,1,.3)));}
    // Cast spiral relief, shoulder swirl and three flowing wing ridges.
    for(const [cx,cy,rad] of [[.23,.72,.14],[-.43,.66,.11],[.14,.12,.08]]) {
      const p=[];for(let i=0;i<40;i++){const t=i/39,a=t*TAU*1.05,r=rad*(1-t*.86);p.push(V(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z));}relief.push(tube(p,.013,44));
    }
    for(let i=0;i<3;i++)relief.push(tube([V(-.75+i*.08,.97-i*.06,z),V(-.54,.62+i*.045,z),V(-.20,.53+i*.045,z),V(.05,.55+i*.04,z)],.010));
    for(let i=0;i<8;i++)incisions.push(transform(new THREE.SphereGeometry(.016,8,6),V(.22+Math.sin(i*.25)*.07,1.35-i*.055,z),V(1,1,.25)));
  }
  add(g,merge(wingParts),m.bronze,'Two folded upswept wings');add(g,merge(relief),m.bronze,'Cast concentric eyes and spiral relief');add(g,merge(incisions),m.bronzeCut,'Recessed eye and dot ornament');
  // Existing world uses the -Z heading for this relic.
  for(const child of g.children){child.geometry.rotateY(Math.PI/2);child.geometry.translate(0,.09,0);}
  g.userData.features={wings:2,roundRaisedEyes:2,foldedTail:true,heading:'-Z'};return finish(g,'bird');
}

function jadeCong(m) {
  const g=new THREE.Group(),body=[],ornament=[],cuts=[];
  const levels=10,step=.246,base=-1.23;
  for(let i=0;i<levels;i++) {
    const a=.408+i*.0042,inside=.31+Math.abs(i-4.5)*.0042;
    const s=new THREE.Shape();s.moveTo(-a+.018,-a);s.lineTo(a-.018,-a);s.quadraticCurveTo(a,-a,a,-a+.018);s.lineTo(a,a-.018);s.quadraticCurveTo(a,a,a-.018,a);s.lineTo(-a+.018,a);s.quadraticCurveTo(-a,a,-a,a-.018);s.lineTo(-a,-a+.018);s.quadraticCurveTo(-a,-a,-a+.018,-a);s.closePath();s.holes.push(ellipse(0,0,inside,inside));
    const section=extrude(s,.238,.004,16);section.rotateX(-Math.PI/2);section.translate(0,base+i*step,0);body.push(section);
    // A face straddles each corner. The plain recessed vertical strip stays clear.
    for(let side=0;side<4;side++) {
      const matrix=new THREE.Matrix4().makeRotationY(side*Math.PI/2);
      for(const sign of [-1,1]) {
        for(let line=0;line<4;line++) {
          const bar=new THREE.BoxGeometry(a-.068,.009,.013);bar.translate(sign*(a+.068)/2,base+i*step+.186-line*.018,a+.005);bar.applyMatrix4(matrix);ornament.push(bar);
        }
        const eye=ring(.030,.023,.005);eye.translate(sign*(a-.13),base+i*step+.084,a+.008);eye.applyMatrix4(matrix);ornament.push(eye);
        const pupil=ring(.0085,.0045,.005);pupil.translate(sign*(a-.13),base+i*step+.084,a+.011);pupil.applyMatrix4(matrix);cuts.push(pupil);
        const nose=new RoundedBoxGeometry(.122,.026,.013,1,.009);nose.translate(sign*(a-.056),base+i*step+.039,a+.006);nose.applyMatrix4(matrix);ornament.push(nose);
        // Fine incised feather-crown lines read under the lateral inspection light.
        for(let k=0;k<10;k++){const line=new THREE.BoxGeometry(.002,.050,.0015);line.translate(sign*(.10+k*(a-.11)/10),base+i*step+.162,a+.013);line.applyMatrix4(matrix);cuts.push(line);}
      }
    }
  }
  add(g,jadeColors(merge(body)),m.jade,'Ten hollow tapered carved sections');add(g,jadeColors(merge(ornament)),m.jade,'Corner-centered masks and fine crown ridges');add(g,merge(cuts),m.jadeCut,'Incised crown lines and drilled pupils');
  const collars=[];for(const [y,r,hole] of [[-1.31,.402,.338],[1.225,.446,.35]]) {const c=ring(r,hole,.082);c.rotateX(-Math.PI/2);c.translate(0,y,0);collars.push(c);}
  const bore=new THREE.LatheGeometry([new THREE.Vector2(.338,-1.31),new THREE.Vector2(.326,-1.22),new THREE.Vector2(.308,-.12),new THREE.Vector2(.308,.12),new THREE.Vector2(.341,1.22),new THREE.Vector2(.350,1.308)],64),bi=bore.index.array,bn=bore.attributes.normal;
  for(let i=0;i<bi.length;i+=3)[bi[i+1],bi[i+2]]=[bi[i+2],bi[i+1]];for(let i=0;i<bn.count;i++)bn.setXYZ(i,-bn.getX(i),-bn.getY(i),-bn.getZ(i));collars.push(bore);
  add(g,jadeColors(merge(collars)),m.jade,'Open round collars, double-drilled bore');
  g.userData.features={sections:10,openBore:true,innerMinRadius:.31,outerSquare:true,tapered:true};return finish(g,'jade');
}

function jadeColors(geo) {
  const p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=fbm(x*5+8,y*3,z*5),milk=smooth(.46,.65,n),inclusion=smooth(.60,.75,fbm(x*18,y*13+2,z*17));colors.push(mix(.36,.92,milk)-inclusion*.19,mix(.48,.94,milk)-inclusion*.2,mix(.37,.82,milk)-inclusion*.17);}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geo;
}

function goldMask(m) {
  const g=new THREE.Group(),s=new THREE.Shape();
  s.moveTo(-1.12,.88);s.quadraticCurveTo(0,.92,1.12,.88);s.lineTo(1.13,.66);s.bezierCurveTo(1.36,.60,1.59,.75,1.70,.58);s.quadraticCurveTo(1.79,.35,1.54,-.35);s.quadraticCurveTo(1.41,-.62,1.26,-.59);s.lineTo(1.22,-.84);s.quadraticCurveTo(0,-1.02,-1.22,-.84);s.lineTo(-1.26,-.59);s.quadraticCurveTo(-1.41,-.62,-1.54,-.35);s.quadraticCurveTo(-1.79,.35,-1.70,.58);s.bezierCurveTo(-1.59,.75,-1.36,.60,-1.13,.66);s.closePath();
  for(const sign of [-1,1]) {
    const h=new THREE.Path();h.moveTo(sign*.23,.03);h.quadraticCurveTo(sign*.57,.35,sign*1.00,.34);h.quadraticCurveTo(sign*.92,-.04,sign*.68,-.14);h.quadraticCurveTo(sign*.48,-.17,sign*.23,.03);h.closePath();s.holes.push(h);s.holes.push(ellipse(sign*1.45,-.30,.075,.087));
  }
  const mouth=new THREE.Path();mouth.moveTo(-.51,-.60);mouth.quadraticCurveTo(0,-.64,.51,-.60);mouth.lineTo(.51,-.68);mouth.quadraticCurveTo(0,-.73,-.51,-.68);mouth.closePath();s.holes.push(mouth);
  const geo=refineSheet(extrude(s,.017,.008),.105);
  const field=(x,y)=>{
    const a=Math.abs(x),base=.30-.23*x*x;
    const noseWidth=.075+.13*smooth(.38,-.42,y),noseHeight=.44*smooth(.60,.14,y)*smooth(-.57,-.42,y);
    const nose=noseHeight*Math.exp(-Math.pow(x/noseWidth,4));
    const brow=.11*Math.exp(-Math.pow((y-(.30+.27*Math.sin(a*1.7)))/.080,2))*smooth(.06,.2,a)*(1-smooth(.98,1.13,a));
    const cheek=.10*Math.exp(-Math.pow((a-.75)/.28,2)-Math.pow((y+.30)/.24,2));
    const lip=.055*Math.exp(-Math.pow((y+.76)/.045,2))*(1-smooth(.43,.65,a));
    const ear=-.1*Math.exp(-Math.pow((a-1.46)/.12,2)-Math.pow((y-.26)/.23,2));
    return base+nose+brow+cheek+lip+ear;
  };
  warpSheet(geo,field);add(g,geo,m.gold,'Hammered thin face with five true cut-through openings');
  g.userData.features={eyeHoles:2,mouthHoles:1,earHoles:2,sheetThickness:.017,front:'+Z'};return finish(g,'mask');
}

function sunBird(m) {
  const g=new THREE.Group(),s=new THREE.Shape();s.absarc(0,0,1.5,0,TAU,false);
  // The museum object is a continuous sheet pierced with bird silhouettes, not
  // floating positive birds on a wire rim. Center and 12 swept rays are one void.
  const h=new THREE.Path(),polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
  h.moveTo(...polar(1.075,0));
  for(let i=0;i<12;i++) {
    const a=i*TAU/12;
    h.bezierCurveTo(...polar(.90,a-.06),...polar(.72,a-.31),...polar(.66,a-.37));
    h.bezierCurveTo(...polar(.83,a-.12),...polar(.99,a+.30),...polar(1.075,a+TAU/12));
  }h.closePath();s.holes.push(h);
  // One flowing counterclockwise bird (top quadrant): long curved neck,
  // hooked head, tucked wing, slender leg and three visibly separated toes.
  const bird=new THREE.Path();bird.moveTo(-.84,.96);
  bird.bezierCurveTo(-.76,1.15,-.64,1.23,-.43,1.25);bird.bezierCurveTo(-.28,1.28,-.22,1.24,-.17,1.22);
  bird.bezierCurveTo(-.15,1.33,-.20,1.35,-.12,1.38);bird.bezierCurveTo(-.06,1.43,.02,1.37,-.03,1.32);bird.bezierCurveTo(-.08,1.28,-.13,1.35,-.08,1.35);bird.bezierCurveTo(-.08,1.39,-.13,1.38,-.13,1.33);
  bird.bezierCurveTo(-.12,1.25,.02,1.25,.04,1.37);bird.bezierCurveTo(.05,1.44,.15,1.46,.22,1.41);bird.bezierCurveTo(.10,1.43,.11,1.34,.09,1.32);
  bird.bezierCurveTo(.22,1.31,.34,1.25,.47,1.31);bird.lineTo(.79,1.05);
  bird.bezierCurveTo(.82,1.06,.90,1.10,.92,1.04);bird.bezierCurveTo(.95,.97,.88,.94,.85,.99);bird.bezierCurveTo(.83,1.04,.91,1.04,.89,1.01);bird.bezierCurveTo(.88,.99,.86,1.01,.87,1.02);
  bird.bezierCurveTo(.84,1.01,.84,.95,.90,.95);bird.lineTo(.96,.97);bird.bezierCurveTo(.93,.88,.83,.90,.82,.96);
  bird.bezierCurveTo(.82,.88,.88,.87,.92,.88);bird.bezierCurveTo(.86,.80,.78,.89,.79,.99);bird.lineTo(.46,1.26);
  bird.bezierCurveTo(.31,1.22,.18,1.18,.09,1.23);bird.bezierCurveTo(.02,1.09,-.15,1.07,-.25,1.19);
  bird.bezierCurveTo(-.48,1.27,-.67,1.15,-.73,1.05);bird.quadraticCurveTo(-.77,1.00,-.84,.96);bird.closePath();
  for(let i=0;i<4;i++) {
    const p=new THREE.Path(),points=bird.getPoints(10),a=i*Math.PI/2;
    for(let j=0;j<points.length;j++){const x=points[j].x*Math.cos(a)-points[j].y*Math.sin(a),y=points[j].x*Math.sin(a)+points[j].y*Math.cos(a);if(j===0)p.moveTo(x,y);else p.lineTo(x,y);}p.closePath();s.holes.push(p);
  }
  const geo=refineSheet(extrude(s,.007,.0018,36),.16);
  warpSheet(geo,(x,y)=>.006*Math.sin(x*4+y*2)+.0015*Math.sin(x*19-y*12));add(g,geo,m.gold,'Single thin gold sheet, four birds and twelve opposite rays');
  g.userData.features={birds:4,rays:12,birdDirection:'counterclockwise',rayDirection:'clockwise',sheetThickness:.007,front:'+Z'};return finish(g,'sun');
}

function warpSheet(geo,field) {
  // Analytic deformation normals stay continuous across a triangulated sheet.
  // Recomputing normals after adaptive tessellation makes false long creases.
  const p=geo.attributes.position,n=geo.attributes.normal,e=.0002,v=V();
  for(let i=0;i<p.count;i++) {const x=p.getX(i),y=p.getY(i),dx=(field(x+e,y)-field(x-e,y))/(e*2),dy=(field(x,y+e)-field(x,y-e))/(e*2),nz=n.getZ(i);p.setZ(i,p.getZ(i)+field(x,y));v.set(n.getX(i)-nz*dx,n.getY(i)-nz*dy,nz).normalize();n.setXYZ(i,v.x,v.y,v.z);}
}

function refineSheet(input,maxEdge) {
  // Edge-shared refinement is conforming: adjacent triangles use the same
  // midpoint, including when only one or two edges require splitting.
  const g=mergeVertices(input,.00001),p=Array.from(g.attributes.position.array),n=Array.from(g.attributes.normal.array),uv=Array.from(g.attributes.uv.array);let indices=Array.from(g.index.array);
  for(let iteration=0;iteration<8;iteration++) {
    const mids=new Map(),key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    for(let i=0;i<indices.length;i+=3)for(const [a,b]of [[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]) {
      const k=key(a,b);if(mids.has(k))continue;
      if(Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2])<=maxEdge)continue;
      const mid=p.length/3;mids.set(k,mid);for(let j=0;j<3;j++){p.push((p[a*3+j]+p[b*3+j])/2);n.push((n[a*3+j]+n[b*3+j])/2);}for(let j=0;j<2;j++)uv.push((uv[a*2+j]+uv[b*2+j])/2);
    }
    if(!mids.size)break;const next=[];
    for(let i=0;i<indices.length;i+=3){let a=indices[i],b=indices[i+1],c=indices[i+2],ab=mids.get(key(a,b)),bc=mids.get(key(b,c)),ca=mids.get(key(c,a)),count=Number(ab!==undefined)+Number(bc!==undefined)+Number(ca!==undefined);
      if(count===0){next.push(a,b,c);continue;}
      if(count===3){next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);continue;}
      // Rotate so the single split is AB, or the two splits are AB and BC.
      for(let r=0;r<3;r++){if((count===1&&ab!==undefined)||(count===2&&ab!==undefined&&bc!==undefined))break;[a,b,c]=[b,c,a];[ab,bc,ca]=[bc,ca,ab];}
      if(count===1)next.push(a,ab,c,ab,b,c);else next.push(b,bc,ab,a,ab,c,ab,bc,c);
    }indices=next;
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(p,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.setIndex(indices);input.dispose();g.dispose();return result;
}

// Small implicit sculpting utility: smooth union creates continuous neck/body
// transitions, while cuts make real mouth/nostril/eye recesses instead of paint.
function sculpt(field,min,max,step=.05) {
  const nx=Math.ceil((max.x-min.x)/step),ny=Math.ceil((max.y-min.y)/step),nz=Math.ceil((max.z-min.z)/step),sx=(max.x-min.x)/nx,sy=(max.y-min.y)/ny,sz=(max.z-min.z)/nz;
  const points=[],values=new Float32Array((nx+1)*(ny+1)*(nz+1));
  const index=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z;
  for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++)values[index(x,y,z)]=field(min.x+x*sx,min.y+y*sy,min.z+z*sz);
  const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++) {
    const vals=corners.map(c=>values[index(x+c[0],y+c[1],z+c[2])]);if(vals.every(v=>v>0)||vals.every(v=>v<0))continue;
    const ps=corners.map(c=>V(min.x+(x+c[0])*sx,min.y+(y+c[1])*sy,min.z+(z+c[2])*sz));
    for(const tet of tets){const poly=[];for(const [a,b] of edges){const ia=tet[a],ib=tet[b];if((vals[ia]<0)!==(vals[ib]<0))poly.push(ps[ia].clone().lerp(ps[ib],vals[ia]/(vals[ia]-vals[ib])));}if(poly.length<3)continue;
      const center=poly.reduce((a,p)=>a.add(p),V()).multiplyScalar(1/poly.length),e=.002,normal=V(field(center.x+e,center.y,center.z)-field(center.x-e,center.y,center.z),field(center.x,center.y+e,center.z)-field(center.x,center.y-e,center.z),field(center.x,center.y,center.z+e)-field(center.x,center.y,center.z-e)).normalize(),u=poly[0].clone().sub(center).normalize(),v=normal.clone().cross(u);
      poly.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
      for(let k=1;k<poly.length-1;k++)for(const p of [poly[0],poly[k],poly[k+1]])points.push(p.x,p.y,p.z);
    }
  }
  let geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo=mergeVertices(geo,.0001);geo.computeVertexNormals();const uv=[];const p=geo.attributes.position;for(let i=0;i<p.count;i++)uv.push(p.getX(i)*.48+p.getZ(i)*.31,p.getY(i)*.53+p.getZ(i)*.17);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geo;
}
const ellipsoid=(x,y,z,cx,cy,cz,rx,ry,rz)=>{const q=Math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2);return (q-1)*Math.min(rx,ry,rz);};
const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return mix(b,a,h)-k*h*(1-h);};
function stoneColors(geo) {
  const p=geo.attributes.position,c=[];
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),warp=fbm(x*3.3+8,y*2.7,z*3.8)*1.7;
    // Mineral veins pass THROUGH the volume; no tiger-stripe decals.
    const v1=Math.pow(1-Math.abs(Math.sin(y*12+x*5+z*4+warp*5)),13),v2=Math.pow(1-Math.abs(Math.sin(x*9-y*7+z*6+warp*3)),24),iv=smooth(.48,.71,fbm(x*9,y*7+6,z*8));
    const tone=.55+.52*Math.max(v1,v2*.6)+iv*.14;c.push(tone*.94,tone,tone*1.01);
  }geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return geo;
}
function stoneTiger(m) {
  const g=new THREE.Group();
  const volumes=[
    [0,-.43,0,1.08,.34,.31], [.77,-.38,0,.40,.40,.37],
    [-.79,-.06,0,.37,.67,.34],[-.99,.51,0,.38,.43,.35],[-1.21,.63,0,.29,.22,.32],[-1.19,.31,0,.28,.13,.30],
    [-.88,-.62,-.29,.53,.13,.17],[-.88,-.62,.29,.53,.13,.17], [.70,-.60,-.29,.38,.13,.17],[.70,-.60,.29,.38,.13,.17],
    [-.77,.79,-.26,.12,.15,.09],[-.77,.79,.26,.12,.15,.09],
  ];
  const field=(x,y,z)=>{
    let d=10;for(const args of volumes)d=smin(d,ellipsoid(x,y,z,...args),.11);
    // Squared, deeply open mouth, with a rounded carved internal corner.
    const mouth=Math.max((x+1.28)/.49,Math.abs(y-.447)/.105,Math.abs(z)/.45)-1;
    if(x<-.98)d=Math.max(d,-mouth*.1);
    for(const side of [-1,1]) {d=Math.max(d,-ellipsoid(x,y,z,-1.07,.725,side*.323,.105,.045,.040));d=Math.max(d,-ellipsoid(x,y,z,-1.40,.64,side*.12,.035,.026,.023));}
    return d;
  };
  add(g,stoneColors(sculpt(field,V(-1.61,-.81,-.53),V(1.25,1.01,.53),.037)),m.stone,'Continuous crouching stone tiger with raised neck and carved mouth');
  const details=[],grooves=[];
  for(const side of [-1,1]) {
    // All teeth remain the same stone. Four canine forms and eight incisors.
    for(const upper of [-1,1]){const tooth=new THREE.ConeGeometry(.066,.17,4);if(upper===1)tooth.rotateZ(Math.PI);tooth.translate(-1.34,.447+upper*.055,side*.225);details.push(tooth);}
    for(let i=0;i<4;i++) {const tooth=new RoundedBoxGeometry(.07,.048,.08,1,.008);tooth.translate(-1.415,.447+side*.090,(i-1.5)*.075);details.push(tooth);}
    const eye=new THREE.SphereGeometry(.027,14,10);eye.scale(1,.65,.32);eye.translate(-1.07,.725,side*.324);details.push(eye);
    grooves.push(tube([V(.92,-.35,side*.34),V(.65,-.16,side*.364),V(.42,-.28,side*.32),V(.52,-.58,side*.36)],.012,28));
    for(let i=0;i<2;i++)grooves.push(tube([V(-1.30,-.55,side*(.24+i*.075)),V(-1.35,-.60,side*(.24+i*.075)),V(-1.34,-.68,side*(.24+i*.075))],.008,10));
  }
  const tail=tube([V(.77,-.25,0),V(1.08,-.18,.03),V(.99,-.07,.03),V(.73,-.05,.04),V(.53,-.12,.02)],.085,40);details.push(tail);
  add(g,stoneColors(merge(details)),m.stone,'Stone teeth, carved eyes, curling tail');add(g,merge(grooves),m.stoneCut,'Restrained recessed haunch and paw cuts');
  g.userData.features={posture:'crouching raised head',heading:'-X',veins:'procedural continuous volume',canines:4,incisors:8};return finish(g,'tiger');
}

/** Return an unscaled local-space Group. World / inspection applies its own scale. */
const models=new Map();
export function createDetailedRelic(id) {
  const builder={bird:bronzeBird,jade:jadeCong,mask:goldMask,tiger:stoneTiger,sun:sunBird}[id];
  if(!builder)throw new Error(`Unknown detailed relic: ${id}`);
  if(!models.has(id))models.set(id,builder(materials()));
  // World and inspection clones share immutable GPU resources, not transforms.
  return models.get(id).clone(true);
}
