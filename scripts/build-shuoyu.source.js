/**
 * SHUO YU / 烁羽 — original editable parametric character source.
 * Authored surfaces, feather topology, rig and animation. No external mesh assets.
 * Browser module: buildShuoyu() returns a skin-bound Group with AnimationClips.
 */
import * as T from 'three';

const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const palette = {ivory:'#d2cbb4', chalk:'#e0dbc7', teal:'#417f77', dark:'#284e4b', gold:'#b89343', bronze:'#756b50'};
let seed = 1206;
const random = () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

function featherTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#f4f0e7';c.fillRect(0,0,256,512);
  // Fine barbs change direction on either side of the raised rachis.
  for(let i=-40;i<540;i+=4){
    c.strokeStyle=`rgba(78,75,61,${.035+random()*.065})`;c.lineWidth=.45+random()*.35;
    c.beginPath();c.moveTo(127,i+33);c.quadraticCurveTo(70,i+11,0,i-38);c.stroke();
    c.beginPath();c.moveTo(129,i+33);c.quadraticCurveTo(191,i+11,256,i-38);c.stroke();
  }
  const g=c.createLinearGradient(116,0,140,0);g.addColorStop(0,'rgba(99,85,59,0)');g.addColorStop(.43,'rgba(99,85,59,.14)');g.addColorStop(.54,'rgba(255,255,249,.45)');g.addColorStop(1,'rgba(255,255,249,0)');c.fillStyle=g;c.fillRect(113,0,30,512);
  // Real alpha-cut vane filaments replace the hard polygon edges. The final
  // mesh still owns the feather silhouette; only its last few millimetres fray.
  c.globalCompositeOperation='destination-out';
  for(let y=0;y<512;y+=3){for(const s of [-1,1]){const edge=s<0?0:256,reach=3+random()*14;c.strokeStyle=`rgba(0,0,0,${.6+random()*.4})`;c.lineWidth=1+random();c.beginPath();c.moveTo(edge,y);c.lineTo(edge-s*reach,y+reach*.64);c.stroke();}}
  c.globalCompositeOperation='source-over';
  // Delicate pale companion fibres separate the barb texture from painted stripes.
  for(let i=-30;i<550;i+=2.4){c.strokeStyle='rgba(255,255,249,.25)';c.lineWidth=.38;for(const s of [-1,1]){c.beginPath();c.moveTo(128+s*2,i+25);c.quadraticCurveTo(128+s*55,i+2,128+s*125,i-31);c.stroke();}}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.name='Original_v7_flight_feather_barbs_256x512';
  return texture;
}

function contourTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
  c.clearRect(0,0,256,256);
  // Feathery contour edges, with the quill hidden by neighbouring feathers.
  // Every little vane is painted in its own direction, not a repeated hard tile.
  const g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'rgba(232,228,217,0)');g.addColorStop(.17,'rgba(232,228,217,.84)');g.addColorStop(.36,'#e8e4d9');g.addColorStop(.66,'#e8e4d9');g.addColorStop(.87,'rgba(232,228,217,.84)');g.addColorStop(1,'rgba(232,228,217,0)');c.fillStyle=g;c.fillRect(0,0,256,256);
  c.globalCompositeOperation='source-atop';
  for(let y=-30;y<275;y+=2){for(const side of [-1,1]){c.strokeStyle=random()>.6?'rgba(255,255,251,.38)':'rgba(119,126,105,.12)';c.lineWidth=.45+random()*.7;c.beginPath();c.moveTo(128,y+24);c.bezierCurveTo(128+side*36,y+15,128+side*79,y-6,128+side*126,y-29-random()*8);c.stroke();}}
  c.globalCompositeOperation='destination-out';
  for(let y=0;y<256;y+=2){for(const side of [-1,1]){c.strokeStyle='rgba(0,0,0,.9)';c.lineWidth=.8+random();c.beginPath();c.moveTo(side<0?0:256,y);c.lineTo(side<0?10+random()*36:246-random()*36,y+8+random()*13);c.stroke();}}
  // The base and tip dissolve into neighbouring tracts. Thin curved fibres
  // retain a soft silhouette without carving rectangular plate-like edges.
  c.globalCompositeOperation='destination-in';const lengthFade=c.createLinearGradient(0,0,0,256);lengthFade.addColorStop(0,'rgba(255,255,255,.08)');lengthFade.addColorStop(.18,'rgba(255,255,255,.9)');lengthFade.addColorStop(.46,'white');lengthFade.addColorStop(.85,'rgba(255,255,255,.8)');lengthFade.addColorStop(1,'rgba(255,255,255,.05)');c.fillStyle=lengthFade;c.fillRect(0,0,256,256);
  c.globalCompositeOperation='source-over';const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.name='Original_v7_soft_contour_vanes_256';return tex;
}

function downTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#e8e4d9';c.fillRect(0,0,256,256);
  // Fine curved fibres give the visible gaps a soft, directional surface.
  for(let i=0;i<4400;i++){const x=random()*256,y=random()*256,length=3+random()*12;c.lineWidth=.4+random()*.5;c.strokeStyle=random()>.5?'#fffef138':'#6b69551d';c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+2,y+length*.6,x+(random()-.5)*5,y+length);c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(3,2);texture.anisotropy=4;texture.name='Original_v4_soft_down_fibres_256';return texture;
}

function keratinTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#f2eede';c.fillRect(0,0,128,256);
  for(let i=0;i<650;i++){const x=random()*128,y=random()*256;c.strokeStyle=random()>.5?'#fffdf01f':'#62564219';c.lineWidth=.4+random()*.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+(random()-.5)*2,y+3+random()*20);c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.name='Original_v4_keratin_striations_128x256';return texture;
}

function irisTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#6d421b';c.fillRect(0,0,256,256);
  const grad=c.createRadialGradient(128,128,12,128,128,125);grad.addColorStop(0,'#472307');grad.addColorStop(.43,'#e8a933');grad.addColorStop(.7,'#b97818');grad.addColorStop(.9,'#d0a34d');grad.addColorStop(1,'#251b0f');c.fillStyle=grad;c.fillRect(0,0,256,256);
  for(let i=0;i<420;i++){let a=random()*Math.PI*2,r=45+random()*23;c.strokeStyle=random()>.5?'#f3c26844':'#5b391955';c.lineWidth=.5+random();c.beginPath();c.moveTo(128+Math.cos(a)*r,128+Math.sin(a)*r);c.lineTo(128+Math.cos(a+.02)*(112+random()*12),128+Math.sin(a+.02)*(112+random()*12));c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.name='Original_amber_iris_256';return texture;
}

function featherNormal(texture) {
  const src=texture.image,ctx=src.getContext('2d'),pixels=ctx.getImageData(0,0,src.width,src.height).data;
  const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;const c=canvas.getContext('2d'),data=c.createImageData(src.width,src.height);
  const h=(x,y)=>pixels[(Math.max(0,Math.min(src.height-1,y))*src.width+Math.max(0,Math.min(src.width-1,x)))*4]/255;
  for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const n=V((h(x-1,y)-h(x+1,y))*3,(h(x,y-1)-h(x,y+1))*3,1).normalize(),i=(y*src.width+x)*4;data.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);}c.putImageData(data,0,0);const result=new T.CanvasTexture(canvas);result.name=`${texture.name}_normal`;result.repeat.copy(texture.repeat);result.wrapS=texture.wrapS;result.wrapT=texture.wrapT;return result;
}

export function buildShuoyu({detail=1}={}) {
  seed=1206;
  const foldedWingYaw=.40;
  const group=new T.Group();group.name='Shuoyu';
  const bones=[],boneIndex={},rest={};
  function bone(name,pos,parent){const b=new T.Bone();b.name=name;b.position.copy(pos);if(parent){b.position.sub(rest[parent]);bones[boneIndex[parent]].add(b);}else group.add(b);rest[name]=pos.clone();boneIndex[name]=bones.length;bones.push(b);return b;}
  bone('Root',V(0,0,0));bone('Pelvis',V(0,.4,.04),'Root');bone('Breast',V(0,.61,.025),'Pelvis');bone('Neck',V(0,.78,-.1),'Breast');bone('Head',V(0,.92,-.16),'Neck');
  bone('Mandible',V(0,.885,-.28),'Head');bone('EyeL',V(-.119,.951,-.238),'Head');bone('EyeR',V(.119,.951,-.238),'Head');
  bone('Crest',V(0,1.035,-.12),'Head');bone('Tail',V(0,.43,.22),'Pelvis');bone('TailTip',V(0,.27,.52),'Tail');
  for(const s of [-1,1]){const n=s<0?'L':'R',shoulder=V(s*.19,.705,.035),wrist=V(s*.31,.50,.22).sub(shoulder).applyAxisAngle(V(0,1,0),-s*foldedWingYaw).add(shoulder);bone(`Wing${n}`,shoulder,'Breast');bone(`Flight${n}`,wrist,`Wing${n}`);bone(`Leg${n}`,V(s*.105,.38,.055),'Pelvis');bone(`Hock${n}`,V(s*.105,.225,.105),`Leg${n}`);bone(`Foot${n}`,V(s*.105,.07,-.035),`Hock${n}`);}
  // Five primary pairs per wing form a delayed finger fan. They are children
  // of the wrist so the shoulder > wrist > feather hierarchy stays continuous.
  for(const s of [-1,1]){const side=s<0?'L':'R',shoulder=rest[`Wing${side}`];for(let i=0;i<5;i++){const t=(i*2+.5)/9,p=V(s*(.228+t*.045),.57-t*.062,.11+t*.20).sub(shoulder).applyAxisAngle(V(0,1,0),-s*foldedWingYaw).add(shoulder);bone(`Primary${side}${i}`,p,`Flight${side}`);}bone(`TailFan${side}`,V(s*.025,.43,.27),'TailTip');}
  group.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
  const featherMap=featherTexture(),contourMap=contourTexture(),downMap=downTexture(),keratinMap=keratinTexture();
  const mats={
    plumage:new T.MeshPhysicalMaterial({name:'Ivory_and_jade_feathers',map:featherMap,normalMap:featherNormal(featherMap),normalScale:new T.Vector2(.22,.22),vertexColors:true,roughness:.78,metalness:0,anisotropy:.26,anisotropyRotation:Math.PI/2,side:T.DoubleSide,alphaTest:.30,sheen:.43,sheenRoughness:.78,sheenColor:'#d9e0d3',envMapIntensity:.85}),
    contour:new T.MeshPhysicalMaterial({name:'Soft_contour_feathers',map:contourMap,normalMap:featherNormal(contourMap),normalScale:new T.Vector2(.13,.13),vertexColors:true,roughness:.91,metalness:0,side:T.DoubleSide,alphaTest:.12,sheen:.34,sheenRoughness:.92,sheenColor:'#dce5d8',envMapIntensity:.85}),
    down:new T.MeshPhysicalMaterial({name:'Soft_down_under_feathers',map:downMap,normalMap:featherNormal(downMap),normalScale:new T.Vector2(.13,.13),vertexColors:true,roughness:.96,metalness:0,sheen:.34,sheenRoughness:.95,sheenColor:'#e2dcc7',envMapIntensity:.85}),
    gold:new T.MeshStandardMaterial({name:'Weathered_gold_feather_edges',vertexColors:true,roughness:.4,metalness:.66,side:T.DoubleSide}),
    skin:new T.MeshStandardMaterial({name:'Warm_bronze_beak_and_feet',map:keratinMap,normalMap:featherNormal(keratinMap),normalScale:new T.Vector2(.10,.10),vertexColors:true,roughness:.59,metalness:.035}),
    cornea:new T.MeshPhysicalMaterial({name:'Clear_domed_cornea',color:'#ffffff',roughness:.06,metalness:0,transparent:true,opacity:.065,clearcoat:.8,clearcoatRoughness:.04,depthWrite:false}),
    eye:new T.MeshPhysicalMaterial({name:'Deep_eye_glass',color:'#100f0b',roughness:.15,clearcoat:.3,clearcoatRoughness:.08}),
    iris:new T.MeshStandardMaterial({name:'Amber_radial_iris',map:irisTexture(),roughness:.40,metalness:0}),
    pupil:new T.MeshPhysicalMaterial({name:'Pupil',color:'#030705',roughness:.19,clearcoat:.2}),
    light:new T.MeshStandardMaterial({name:'Living_catchlights',color:'#fff1cf',emissive:'#fff5d8',emissiveIntensity:.15,roughness:.25}),
    glow:new T.MeshStandardMaterial({name:'Single_heart_ember',color:'#e7b450',emissive:'#f2ad32',emissiveIntensity:1.5,roughness:.4}),
    lid:new T.MeshStandardMaterial({name:'Feathered_eyelids',color:'#ffffff',map:downMap,vertexColors:true,roughness:.92}),
  };
  const buckets={};
  function bucket(mat){return buckets[mat]??=( {p:[],uv:[],color:[],si:[],sw:[],idx:[],morph:[]} );}
  function add(mat,positions,indices,uvs,colors,boneName='Breast',weights=null,morph=null){
    const b=bucket(mat),base=b.p.length/3;b.p.push(...positions);b.idx.push(...indices.map(i=>i+base));b.uv.push(...uvs);
    for(let i=0;i<positions.length/3;i++){
      const color=Array.isArray(colors)?colors[i]:colors;const c=new T.Color(color);b.color.push(c.r,c.g,c.b);
      // Lower neck feathers belong partly to the breast: a soft collar must
      // not shear into a rigid floating tube when the head listens or preens.
      const w=weights?.[i]||(boneName==='Neck'?['Breast',T.MathUtils.clamp((.815-positions[i*3+1])/.205,0,.92)]:null);b.si.push(boneIndex[boneName],w?boneIndex[w[0]]:0,0,0);b.sw.push(w?1-w[1]:1,w?w[1]:0,0,0);
    }
    if(morph)b.morph.push(...morph);
  }
  function surface(mat,fn,cols,rows,color,boneName='Breast',uvFn=null){
    const p=[],uv=[],idx=[],colors=[];
    cols=Math.max(6,Math.round(cols*detail));rows=Math.max(4,Math.round(rows*detail));
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){let u=i/cols,v=j/rows;const pt=fn(u,v);p.push(pt.x,pt.y,pt.z);uv.push(...(uvFn?uvFn(u,v):[u,v]));colors.push(typeof color==='function'?color(u,v):color);}
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let a=j*(cols+1)+i;idx.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}
    const actualMaterial=mat==='plumage'?'down':mat,surfaceBucket=bucket(actualMaterial),firstVertex=surfaceBucket.p.length/3;
    add(actualMaterial,p,idx,uv,colors,boneName);
    // UV seams keep distinct vertices but must share their geometric normal.
    // Otherwise continuous skull/leg/eye surfaces acquire a thin lighting seam.
    surfaceBucket.normalWelds??=[];
    for(let j=0;j<=rows;j++){
      const a=j*(cols+1),b=a+cols,same=(i,k)=>Math.hypot(p[i*3]-p[k*3],p[i*3+1]-p[k*3+1],p[i*3+2]-p[k*3+2])<1e-8;
      if(same(a,b))surfaceBucket.normalWelds.push([firstVertex+a,firstVertex+b]);
      if((j===0||j===rows)&&Array.from({length:cols+1},(_,k)=>same(a,a+k)).every(Boolean))surfaceBucket.normalWelds.push(Array.from({length:cols+1},(_,k)=>firstVertex+a+k));
    }
  }
  function ellipsoid(center,scale,color,boneName,mat='plumage',cols=28,rows=18){
    surface(mat,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI;return V(center.x+Math.cos(a)*Math.sin(b)*scale.x,center.y+Math.cos(b)*scale.y,center.z+Math.sin(a)*Math.sin(b)*scale.z);},cols,rows,color,boneName);
  }
  function tube(points,radius,color,boneName,mat='skin',sides=7){
    surface(mat,(u,v)=>{const i=Math.min(points.length-2,Math.floor(v*(points.length-1))),f=v*(points.length-1)-i;const p=points[i].clone().lerp(points[i+1],f);const tang=points[i+1].clone().sub(points[i]).normalize();const a=tang.clone().cross(V(0,0,1)).normalize(),b=tang.clone().cross(a).normalize();const r=typeof radius==='function'?radius(v):radius;return p.addScaledVector(a,Math.cos(u*Math.PI*2)*r).addScaledVector(b,Math.sin(u*Math.PI*2)*r);},sides,(points.length-1)*3,color,boneName);
  }
  function curvedClaw(points,radius,color,boneName){
    const curve=new T.QuadraticBezierCurve3(...points);
    surface('skin',(u,v)=>{const p=curve.getPoint(v),t=curve.getTangent(v),a=t.clone().cross(V(0,1,0)).normalize(),b=t.clone().cross(a).normalize(),r=radius(v);return p.addScaledVector(a,Math.cos(u*Math.PI*2)*r).addScaledVector(b,Math.sin(u*Math.PI*2)*r);},8,12,color,boneName);
  }
  function scute(center,tangent,out,radius,length,color,boneName){
    const t=tangent.clone().normalize(),n=out.clone().addScaledVector(t,-out.dot(t)).normalize(),side=t.clone().cross(n).normalize(),p=[],uv=[],idx=[],colors=[],cols=detail===1?6:4,rows=2;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows,a=(u-.5)*2.2,r=radius+Math.sin(v*Math.PI)*.0007,point=center.clone().addScaledVector(t,(v-.5)*length).addScaledVector(side,Math.sin(a)*r).addScaledVector(n,Math.cos(a)*r);p.push(...point);uv.push(u,v);colors.push(new T.Color(color).multiplyScalar(.91+.09*v));}
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;idx.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}add('skin',p,idx,uv,colors,boneName);
  }
  // A single sculpted head surface owns both the skin and its feather tracts.
  // In V8 the forehead used a different ellipsoid and straight crown chords;
  // those cards intersected the skull and made unstable patches above the eyes.
  function skullSurface(a,y){
    const v=T.MathUtils.clamp((y-.927)/.137,-1,1),r=Math.sqrt(1-v*v);
    let x=Math.cos(a)*r*.171*(.94+.08*v),z=-.153+Math.sin(a)*r*.151*(1+.1*v);
    const front=Math.max(0,-Math.sin(a)),cheek=.0045*Math.exp(-(((v+.12)/.42)**2))*Math.abs(Math.cos(a))**3*r;
    x+=Math.sign(x)*cheek;
    // Shallow orbital depression, with the full cheek retained beneath it.
    const orbit=Math.exp(-(((Math.abs(x)-.119)/.044)**2)-((y-.951)/.045)**2)*front*r;
    z+=orbit*.008;x-=Math.sign(x)*orbit*.0025;
    return V(x,y,z);
  }
  function skullNormal(a,y){
    const du=skullSurface(a+.001,y).sub(skullSurface(a-.001,y)),dv=skullSurface(a,Math.min(1.0639,y+.0001)).sub(skullSurface(a,Math.max(.7901,y-.0001)));
    return dv.cross(du).normalize();
  }
  const skullPoint=(a,y,out=0)=>skullSurface(a,y).addScaledVector(skullNormal(a,y),out);
  function foreheadPoint(x,y,out=.003){
    const v=T.MathUtils.clamp((y-.927)/.137,-.995,.995),r=Math.sqrt(1-v*v)*.171*(.94+.08*v);
    const a=-Math.acos(T.MathUtils.clamp(x/r,-.97,.97));return skullPoint(a,y,out);
  }
  // Feather surface: tapered swept silhouette, convex vane, raised central shaft,
  // asymmetrical notch/split and micro-serration, a single continuous editable grid.
  let featherCount=0;
  function feather(start,end,width,normal,color,boneName,{bend=.008,gold=false,tipBone=null,notch=false,segments=10,soft=false,curve=null,conformSkull=false}={}){
    const dir=end.clone().sub(start),n=normal.clone().normalize(),side=dir.clone().cross(n).normalize();
    const p=[],uv=[],idx=[],colors=[],weights=[];const rows=Math.max(3,Math.round(segments*detail)),cols=soft?(detail===1?4:3):(detail===1?8:4);
    // The tract is one continuous coat: broad painted root shadows on each
    // tiny vane looked like separate fish scales in real raking sunlight.
    const baseColor=new T.Color(color).multiplyScalar(soft?.98+random()*.035:.96+random()*.065),tipColor=baseColor.clone().lerp(new T.Color(palette.chalk),soft?.008:.10),shadowColor=baseColor.clone().multiplyScalar(soft?.955:.86);
    const rootTone=!soft&&/^(Wing|Tail)/.test(boneName)?new T.Color('#799c86'):null;
    const sweep=(random()-.5)*width*.3,asymmetry=soft?.94+random()*.06:.65+random()*.17;
    for(let j=0;j<=rows;j++){const t=1-Math.pow(1-j/rows,soft?1.35:1.6);
      // Long vanes retain width until the distal third; shallow camber avoids
      // the old inflated diamond/scale silhouette, especially on the breast.
      const shape=Math.pow(Math.sin(Math.PI*Math.pow(t,soft?.79:.66)),soft?.43:.49)*(1-.10*t)+.008;
      for(let i=0;i<=cols;i++){const u=(i/cols-.5)*2;const vane=width*.5*shape*(u<0?.91:1.04);const serrate=Math.abs(u)>.8?Math.sin(t*51+featherCount)*.0007:0;
        const pt=(curve?curve(t):start.clone().addScaledVector(dir,t)).addScaledVector(side,u*vane*(u<0?asymmetry:1)+serrate+sweep*t*t).addScaledVector(n,Math.sin(Math.PI*t)*(bend+(soft?.001:.0065)*(1-u*u))+.0006*(1-Math.abs(u))+(soft?0:.003*t*t*t*t*(1-u*u)));
        if(conformSkull){const y=T.MathUtils.clamp(pt.y,.791,1.0629),a=Math.atan2((pt.z+.153)/.151,pt.x/.171);pt.copy(skullPoint(a,y,.0016+Math.sin(t*Math.PI)*.0007+t*.0005));}
        if(notch&&j>rows-2&&i===Math.floor(cols/2))pt.addScaledVector(dir,-.12);
        p.push(pt.x,pt.y,pt.z);uv.push(i/cols,t);const c=shadowColor.clone().lerp(baseColor,Math.min(1,t*(soft?1.8:3.5))).lerp(tipColor,t*.35);if(rootTone)c.lerp(rootTone,Math.pow(Math.max(0,1-t/.66),1.35)*.43);if(Math.abs(u)<.1)c.multiplyScalar(1.02);colors.push(c);weights.push(tipBone?[tipBone,Math.max(0,(t-.15)/.85)*.7]:null);
      }
    }
    const overlapsEye=(a,b,c)=>{
      if(boneName!=='Head'||!soft)return false;
      const point=V((p[a*3]+p[b*3]+p[c*3])/3,(p[a*3+1]+p[b*3+1]+p[c*3+1])/3,(p[a*3+2]+p[b*3+2]+p[c*3+2])/3);
      for(const s of [-1,1]){const n=V(s*.62,.03,-.785).normalize(),up=V(0,1,0),right=up.clone().cross(n).normalize(),d=point.clone().sub(V(s*.119,.951,-.238));if(Math.hypot(d.dot(right),d.dot(up))<.048&&d.dot(n)>-.009)return true;}return false;
    };
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;for(const tri of [[a,a+1,a+cols+2],[a,a+cols+2,a+cols+1]])if(!overlapsEye(...tri))idx.push(...tri);}
    const featherBucket=bucket(soft?'contour':'plumage'),vertexOffset=featherBucket.p.length/3;
    add(soft?'contour':'plumage',p,idx,uv,colors,boneName,weights);
    if(soft){featherBucket.smooth??=[];for(let v=0;v<p.length/3;v++){
      let tract=n.clone(),x=p[v*3],y=p[v*3+1],z=p[v*3+2];
      if(boneName==='Breast')tract.set(x/(.205*.205),(y-.53)/(.282*.282),(z-.052-.04*(y-.53)/.282)/(.184*.184)).normalize();
      if(boneName==='Head'){const a=Math.atan2((z+.153)/.151,x/.171);tract.copy(skullNormal(a,T.MathUtils.clamp(y,.791,1.063)));}
      if(boneName==='Neck'){const center=neckPoint(0,y).add(neckPoint(Math.PI,y)).multiplyScalar(.5),a=Math.atan2((z-center.z)/.9,x);tract.copy(neckPoint(a,y+.005).sub(neckPoint(a,y-.005))).cross(neckPoint(a+.01,y).sub(neckPoint(a-.01,y))).normalize();}
      featherBucket.smooth.push([vertexOffset+v,tract.x,tract.y,tract.z,boneName==='Breast'?.87:boneName==='Head'?.89:.91]);
    }}

    if(gold){
      // Sparse narrow gilding follows the vane tip, not full shoulder armour.
      const gp=[],gu=[],gi=[],gw=[];
      for(let j=0;j<=rows;j++){let t=j/rows;for(let k=0;k<2;k++){const outer=(j*(cols+1)+cols)*3,inner=outer-3;const f=k?0:.16;gp.push(p[outer]+(p[inner]-p[outer])*f,p[outer+1]+(p[inner+1]-p[outer+1])*f+.0005,p[outer+2]+(p[inner+2]-p[outer+2])*f);gu.push(k,t);gw.push(weights[j*(cols+1)]);}}
      for(let j=Math.floor(rows*.4);j<rows;j++){const a=j*2;gi.push(a,a+1,a+3,a,a+3,a+2);}add('gold',gp,gi,gu,palette.gold,boneName,gw);
    }
    featherCount++;
  }
  // A continuous widened throat root meets the pear-shaped breast. The old
  // constant-radius lower neck read as a bright cylinder inserted into a shell.
  const neckPoint=(a,y,out=0)=>{const v=T.MathUtils.clamp((y-.61)/.32,0,1),r=.14-.064*v+.009*Math.sin(v*Math.PI),p=V(Math.cos(a)*(r+out),y,.02-.165*v+Math.sin(a)*(r*.9+out)),blend=1-T.MathUtils.smoothstep(y,.61,.76);if(blend>0){const yn=T.MathUtils.clamp((y-.53)/.282,-.99,.99),b=Math.acos(yn),rr=Math.sin(b),taper=.91-.18*yn+.06*Math.sin(b*2);p.lerp(V(Math.cos(a)*(rr*.205*taper+shoulderWidth(y)+out-.005),y,.052+Math.sin(a)*(rr*.184+out-.005)+.04*yn),blend);}return p;};
  // The torso is a continuous pear-shaped parametric hull, not a stack of primitives.
  const shoulderWidth=y=>.043*Math.exp(-(((y-.69)/.068)**2));
  const coatColor=(a,y)=>new T.Color(palette.chalk).lerp(new T.Color('#c4c5ad'),Math.max(0,.55-y)*.55).lerp(new T.Color('#67978a'),T.MathUtils.smoothstep(Math.sin(a),-.20,.70)*T.MathUtils.smoothstep(y,.30,.71)*.76);
  const neckColor=(a,y)=>coatColor(a,y).lerp(new T.Color(palette.chalk),T.MathUtils.smoothstep(y,.65,.86));
  surface('plumage',(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI,y=Math.cos(b),r=Math.sin(b);const taper=.91-.18*y+.06*Math.sin(b*2);return V(Math.cos(a)*(r*.205*taper+shoulderWidth(.53+y*.282)),.53+y*.282,.052+Math.sin(a)*r*.184+.04*y);},44,30,(u,v)=>coatColor(u*Math.PI*2,.53+Math.cos(v*Math.PI)*.282),'Breast');
  surface('plumage',(u,v)=>neckPoint(u*Math.PI*2,.93-v*.32),36,24,(u,v)=>neckColor(u*Math.PI*2,.93-v*.32),'Neck');
  // Head silhouette has a flattened brow, full cheek and tapered lower throat.
  surface('plumage',(u,v)=>skullSurface(u*Math.PI*2,.927+Math.cos(v*Math.PI)*.137),56,36,palette.chalk,'Head');
  // Belly, flanks and mantle follow the pear hull to its underside. Small,
  // irregularly staggered vanes replace eight obvious rows of large scales.
  const bodyPoint=(a,yy,out=.01)=>{const yn=T.MathUtils.clamp((yy-.53)/.282,-.99,.99),b=Math.acos(yn),rr=Math.sin(b),taper=.91-.18*yn+.06*Math.sin(b*2);return V(Math.cos(a)*(rr*.205*taper+shoulderWidth(yy)+out),yy,.052+Math.sin(a)*(rr*.184+out)+.04*yn);};
  // A single phyllotactic tract avoids horizontal armoured rows while keeping
  // the same 816 body vanes and material/triangle budget as the previous asset.
  for(let i=0;i<816;i++){
      const yy=.283+(i+.5)/816*.513+(random()-.5)*.013,a=i*2.399963229728653+(random()-.5)*.06,n=V(Math.cos(a),(yy-.53)*3.4,Math.sin(a)),back=Math.sin(a)>.15;
      const start=bodyPoint(a,yy+(random()-.5)*.019,.004),end=bodyPoint(a+(random()-.5)*.09,Math.max(.252,yy-.045-random()*.023),.006);
      const base=coatColor(a,yy);
      const girth=Math.sqrt(Math.max(0,1-((yy-.53)/.282)**2));
      feather(start,end,(.025+.009*girth)*(.86+random()*.20),n,base,'Breast',{bend:.0008+random()*.0008,segments:5,soft:true,curve:t=>bodyPoint(a+Math.sin(t*Math.PI)*.018,T.MathUtils.lerp(start.y,end.y,t),.0035+t*.0015+Math.sin(t*Math.PI)*.001)});
  }
  // Fine split tufts at the abdominal silhouette, including the exposed ventral
  // region in diving poses. These are geometry, not camera-facing hair sprites.
  for(let i=0;i<58;i++){
    const a=i/58*Math.PI*2,p=bodyPoint(a,.317+random()*.09,.014),n=V(Math.cos(a),-.2,Math.sin(a));
    const shade=coatColor(a,p.y);
    feather(p,p.clone().add(V(n.x*.008,-.018-random()*.012,n.z*.008)),.005+random()*.004,n,shade,'Breast',{bend:.001,segments:4,soft:true});
  }
  // Short radial coverts close the ventral pole, not only the standing outline.
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,p=bodyPoint(a,.296,.017),q=V(Math.cos(a)*.018,.246,.012+Math.sin(a)*.016);
    feather(p,q,.055,V(Math.cos(a)*.45,-.85,Math.sin(a)*.45),palette.ivory,'Breast',{bend:.003,segments:6,soft:true,curve:t=>{const y=T.MathUtils.lerp(.296,.246,t);return t<.8?bodyPoint(a,y,.019):bodyPoint(a,.256,.019).lerp(q,(t-.8)/.2);}});
  }
  // Long scarf-like neck feathers, swept cheek auriculars and fine crown coverts.
  for(let row=0;row<12;row++)for(let i=0;i<28;i++){
    const a=(i+random()*.5)/28*Math.PI*2+row*.37,n=V(Math.cos(a),.12,Math.sin(a));
    const yy=.632+row*.025+(random()-.5)*.021,tailY=yy-.050-random()*.025;
    const p=neckPoint(a,yy,.003),end=neckPoint(a,tailY,.006);
    feather(p,end,.039+random()*.013,n,neckColor(a,yy),'Neck',{bend:.0005,segments:5,soft:true,curve:t=>neckPoint(a+Math.sin(t*Math.PI)*.01,T.MathUtils.lerp(yy,tailY,t),.006+t*.002)});
  }
  for(let s of [-1,1]){
    for(let row=0;row<4;row++)for(let i=0;i<9;i++){const t=(i+random()*.4)/9;const p=V(s*(.11+Math.sin(t*Math.PI)*.047),.874+row*.034+(random()-.5)*.012,-.23+t*.188);const q=p.clone().add(V(s*(.011+t*.018),-.021-row*.004,.041+t*.022));feather(p,q,.019+row*.003,V(s,.3,-.13),row>1?palette.chalk:palette.ivory,'Head',{bend:.0014,segments:7,soft:true});}
    // Short supra-orbital coverts emerge from the brow and lie on the skull.
    // Their tapered ends follow the eye, rather than extending as paper brows.
    for(let i=0;i<7;i++){
      const x=s*(.057+i*.011),y=1.005-i*.003,p=foreheadPoint(x,y,.0038),q=foreheadPoint(x+s*.011,y-.008,.0048);
      feather(p,q,.016,V(s*.4,.55,-.8),palette.chalk,'Head',{bend:.0005,segments:4,soft:true,conformSkull:true,curve:t=>foreheadPoint(T.MathUtils.lerp(p.x,q.x,t),T.MathUtils.lerp(y,y-.008,t),.0038+t*.001)});
    }
  }
  // Crown tracts cross the dome along its surface. The former straight chords
  // cut through the upper head; no point of these curves uses a different hull.
  for(let i=0;i<72;i++){
    const a=i*2.399963229728653,y=1.017+(i+.5)/72*.043,p=skullPoint(a,y,.003),qy=Math.max(.995,y-.023),q=skullPoint(a,qy,.0045);
    feather(p,q,.011+random()*.005,skullNormal(a,y),palette.chalk,'Head',{bend:.0004,segments:4,soft:true,conformSkull:true,curve:t=>skullPoint(a,T.MathUtils.lerp(y,qy,t),.003+t*.0015)});
  }
  // Occipital tracts spiral over the actual rounded head. Their ends turn back
  // toward the nape instead of hanging in eight equally spaced scalloped rows.
  const napePoint=skullPoint;
  for(let i=0;i<136;i++){
    const yy=.846+(i+.35)/136*.206+(random()-.5)*.008,a=.12+((i*.61803398875)%1)*(Math.PI-.24),length=.024+random()*.021;
    const p=napePoint(a,yy,.004),q=napePoint(a,Math.max(.806,yy-length),.006);
    feather(p,q,.018+random()*.012,V(Math.cos(a),.18,Math.sin(a)),palette.chalk,'Head',{bend:.0015,segments:5,soft:true,curve:t=>napePoint(a+Math.sin(t*Math.PI)*.025,T.MathUtils.lerp(p.y,q.y,t),.004+t*.002)});
  }
  // Velvet short contour feathers fill the once bare forehead without covering
  // the eyes. Their root and tip follow the actual head rather than a flat mask.
  for(let row=0;row<8;row++)for(let i=0;i<17;i++){
    const yy=.972+row*.009+(random()-.5)*.006,span=.112*Math.sqrt(Math.max(.05,1-((yy-.927)/.137)**2));
    const xx=(i-8)/8*span+(random()-.5)*.005,qy=yy-.014-random()*.006;
    const p=foreheadPoint(xx,yy,.0028),q=foreheadPoint(xx*1.015,qy,.004);
    feather(p,q,.010+random()*.003,V(xx*3,.3,-1),palette.chalk,'Head',{bend:.0003,segments:4,soft:true,conformSkull:true,curve:t=>foreheadPoint(T.MathUtils.lerp(xx,xx*1.015,t),T.MathUtils.lerp(yy,qy,t),.0028+t*.0012)});
  }
  for(let s of [-1,1])for(let i=0;i<5;i++){
    const p=V(s*(.043+i*.017),.92-i*.006,-.286+i*.009);
    feather(p,p.clone().add(V(s*.035,-.022,.024)),.021,V(s*.4,.1,-1),palette.ivory,'Head',{bend:.002,segments:5,soft:true});
  }
  for(let i=0;i<7;i++){
    const p=V((i-3)*.021,.884,-.269+Math.abs(i-3)*.006);
    feather(p,p.clone().add(V((i-3)*.004,-.061,.027)),.032,V(0,-.1,-1),palette.chalk,'Head',{bend:.002,segments:6,soft:true});
  }
  // The three signature plumes retain their asymmetry but now have a real
  // tapered rachis. Small round keratin shafts add structure at grazing angles.
  const crests=[
    {width:.052,n:V(-.1,.3,-1),bend:.012,color:palette.ivory,curve:t=>V(-.052-.063*t,1.038+.27*t-.108*t*t,-.09+.08*t+.17*t*t)},
    {width:.049,n:V(0,.1,-1),bend:.014,color:palette.chalk,curve:t=>V(.006+.022*t,1.05+.32*t-.11*t*t,-.095+.065*t+.15*t*t)},
    {width:.047,n:V(.2,.25,-1),bend:.010,color:palette.ivory,curve:t=>V(.055+.095*t,1.028+.21*t-.083*t*t,-.08+.09*t+.17*t*t)}
  ];
  for(const crest of crests){
    feather(crest.curve(0),crest.curve(1),crest.width,crest.n,crest.color,'Crest',{bend:crest.bend,gold:true,segments:22,curve:crest.curve});
    const n=crest.n.clone().normalize(),shaft=Array.from({length:20},(_,i)=>{const t=i/19*.94;return crest.curve(t).addScaledVector(n,Math.sin(Math.PI*t)*(crest.bend+.0065)+.0012+.003*t*t*t*t);});
    tube(shaft,t=>.0011*(1-t*.87),'#d0c7a9','Crest','skin',5);
  }
  // Folded wings have a closed, cambered core, a ventral covert surface, broad
  // overlapping secondaries and a separated primary fan. All remain in the
  // existing shoulder/wrist skeleton and therefore work in all eight modes.
  for(let s of [-1,1]){
    const side=s<0?'L':'R',name=`Wing${side}`,tip=`Flight${side}`;
    // Scapular feather roots grow from the continuous widened breast hull;
    // their tips follow the existing wing bones across the joint.
    for(let row=0;row<2;row++)for(let i=0;i<4;i++){
      const from=V(s*(.139+row*.012),.728-i*.021,.025+row*.044),to=V(s*(.229+row*.008),.677-i*.018,.070+row*.052),colour=new T.Color(palette.chalk).lerp(new T.Color('#86aa97'),.30+row*.44);
      feather(from,to,.031,V(s*.66,.35,.18),colour,'Breast',{bend:.0015,tipBone:name,segments:5,soft:true});
    }
    const wp=[],wu=[],wi=[],wc=[],ww=[],cols=detail===1?20:12,rows=detail===1?14:8;
    const wingHalf=t=>.10*Math.pow(Math.sin(Math.PI*Math.pow(T.MathUtils.clamp(t,0,1),.78)),.6);
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const t=j/rows,a=i/cols*Math.PI*2,half=wingHalf(t),z=.045+t*.29;
      wp.push(s*(.205+t*.085+Math.sin(a)*(.010+.003*Math.sin(t*Math.PI))*Math.pow(Math.sin(t*Math.PI),.4)),.705-t*.31,z+Math.cos(a)*half);wu.push(i/cols,t);wc.push(new T.Color('#537e70').lerp(new T.Color('#b2c2ac'),t*.82));ww.push([tip,Math.max(0,(t-.25)/.75)*.65]);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;wi.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}
    for(const j of [0,rows]){const t=j/rows,c=wp.length/3;wp.push(s*(.205+t*.085),.705-t*.31,.045+t*.29);wu.push(.5,t);wc.push(new T.Color('#a3b89f'));ww.push([tip,t*.65]);for(let i=0;i<cols;i++){const a=j*(cols+1)+i;wi.push(c,...(j===0?[a+1,a]:[a,a+1]));}}
    if(s>0)for(let i=0;i<wi.length;i+=3){[wi[i+1],wi[i+2]]=[wi[i+2],wi[i+1]];}
    const coreBucket=bucket('down'),coreFirst=coreBucket.p.length/3;add('down',wp,wi,wu,wc,name,ww);coreBucket.normalWelds??=[];
    for(let j=0;j<=rows;j++)coreBucket.normalWelds.push([coreFirst+j*(cols+1),coreFirst+j*(cols+1)+cols]);
    for(const j of [0,rows])coreBucket.normalWelds.push([...Array.from({length:cols+1},(_,i)=>coreFirst+j*(cols+1)+i),coreFirst+(rows+1)*(cols+1)+(j===0?0:1)]);
    const wingSurface=(t,chord,out=.012)=>{const half=wingHalf(t);return V(s*(.205+t*.085+out),.705-t*.31,.045+t*.29+chord*half);};
    for(let i=0;i<17;i++){const chord=(i/16-.5)*1.65,t=.015+random()*.025,p=wingSurface(t,chord),q=wingSurface(t+.19,chord*.92);feather(p,q,.025+random()*.006,V(s,.2,-.1),'#78a092',name,{bend:.0015,segments:6,soft:true,curve:a=>wingSurface(t+a*.19,chord*(1-a*.08),.012+Math.sin(a*Math.PI)*.002)});}
    // Fan of primaries: long asymmetric vanes with independent visible tips.
    for(let i=0;i<10;i++){const t=i/9,start=V(s*(.228+t*.045),.57-t*.062,.11+t*.20),end=V(s*(.292+Math.sin(t*Math.PI)*.11),.235+t*.07,.28+t*.40),color=new T.Color('#d9d8bf').lerp(new T.Color('#a8bead'),t*.65);feather(start,end,.115-t*.025,V(s,.17,.08),color,name,{bend:.014,tipBone:`Primary${side}${Math.floor(i/2)}`,segments:14,gold:i===1||i===8});}
    // Inner secondaries cover the full chord rather than revealing blade gaps.
    for(let i=0;i<9;i++){const t=i/8,start=V(s*(.205+t*.03),.695-t*.14,.010+t*.15),end=V(s*(.275+t*.025),.424-t*.08,.15+t*.32);feather(start,end,.094,V(s,.12,.08),'#c6d1bc',name,{bend:.005,tipBone:tip,segments:11,curve:a=>start.clone().lerp(end,a).add(V(s*Math.sin(a*Math.PI)*.007,0,-Math.sin(a*Math.PI)*.012))});}
    for(let row=0;row<6;row++)for(let i=0;i<12;i++){
      const chord=((i+random()*.45)/12-.5)*1.78,t=.055+row*.13+(random()-.5)*.045,length=.20+random()*.05,p=wingSurface(t,chord),end=wingSurface(t+length,chord*.93);
      const shade=new T.Color('#537e70').lerp(new T.Color('#b2c2ac'),T.MathUtils.clamp(row/7+(chord+.9)*.06,0,1));
      feather(p,end,.028+random()*.009,V(s,.14,0),shade,name,{bend:.002,tipBone:row>2?tip:null,gold:row===1&&i===3,segments:6,soft:true,curve:a=>wingSurface(t+a*length,chord*(1-a*.07),.012+Math.sin(a*Math.PI)*.002)});
    }
    // Underside coverts stay attached to the wing, visible during upstroke.
    for(let row=0;row<3;row++)for(let i=0;i<8;i++){const t=i/7,p=V(s*(.194+row*.027),.678-row*.08-t*.026,.005+t*(.21+row*.04));feather(p,p.clone().add(V(s*.016,-.118,.056)),.062,V(-s,-.1,0),'#ddd9bd',name,{bend:.003,tipBone:row>0?tip:null,segments:6,soft:true});}
  }
  // Seven retrices form a downward-folded tail, with one deliberate tip notch.
  for(let i=0;i<7;i++){const t=(i-3)/3;feather(V(t*.03,.46,.22),V(t*.17,.16+Math.abs(t)*.042,.69-Math.abs(t)*.08),.117,V(0,.86,.35),new T.Color('#c7ceba').lerp(new T.Color('#dfdbc1'),Math.abs(t)*.65),'Tail',{bend:.018,tipBone:i===3?'TailTip':i<3?'TailFanL':'TailFanR',gold:i===0||i===6,notch:i===2,segments:16});}
  // Mantle follows the actual back, then blends into the tail root. V8's lower
  // rows projected up to 10 cm away from the hull and looked like a hanging bib.
  for(let i=0;i<64;i++){
    const y=.455+(i+.5)/64*.166+(random()-.5)*.010,a=Math.PI*.5+(((i*.61803398875)%1)-.5)*1.2,p=bodyPoint(a,y,.005);
    const tailJoin=1-T.MathUtils.smoothstep(y,.455,.535),qy=y-.050-random()*.013,q=bodyPoint(a,qy,.007).lerp(V(p.x*.85,qy,.28+(y-qy)*.7),tailJoin);
    feather(p,q,.026+random()*.008,V(Math.cos(a),.25,Math.sin(a)),coatColor(a,y),'Breast',{bend:.0008,tipBone:tailJoin>.2?'Tail':null,segments:6,soft:true,curve:t=>bodyPoint(a,T.MathUtils.lerp(y,qy,t),.005+t*.002).lerp(p.clone().lerp(q,t),tailJoin*t)});
  }
  // Articulated bronze-scaled legs, forward three toes and short rear claw.
  for(let s of [-1,1]){const side=s<0?'L':'R',leg=`Leg${side}`,hock=`Hock${side}`,foot=`Foot${side}`,x=s*.105;
    tube([V(x,.38,.055),V(x,.30,.083),V(x,.225,.105)],v=>.025-v*.007,palette.bronze,leg);
    ellipsoid(V(x,.225,.105),V(.021,.024,.022),palette.bronze,hock,'skin',14,10);
    tube([V(x,.225,.105),V(x,.15,.037),V(x,.07,-.035)],v=>.018-v*.004,palette.bronze,hock);
    // The old open-ended metatarsus stopped above the separately rigged toes.
    // A rounded joint centred on the actual Foot pivot remains connected
    // through ankle flexion, including a perch's unequal left/right pitch.
    ellipsoid(V(x,.07,-.035),V(.019,.019,.019),palette.bronze,foot,'skin',14,10);
    for(let i=0;i<8;i++){const y=.09+i*.017,z=-.035+(y-.07)*(.14/.155);scute(V(x,y,z),V(0,-.155,-.14),V(0,.14,-.155),.015+(y-.07)/.155*.004,.011,'#8c8060',hock);}
    for(let toe=-1;toe<=1;toe++){const end=V(x+toe*.055,.013,-.15+(Math.abs(toe)*.025));const pts=[V(x,.054,-.026),V(x+toe*.025,.025,-.087),end];tube(pts,v=>.013*(1-v*.58),palette.bronze,foot);curvedClaw([end,end.clone().add(V(toe*.003,.003,-.014)),end.clone().add(V(toe*.009,-.007,-.028))],v=>.0065*(1-v*.92),'#42483e',foot);
      // Dorsal scutes and an upper toe joint add scale and weight without
      // changing the load-bearing underside or the established sole height.
      ellipsoid(pts[1].clone().add(V(0,.005,0)),V(.010,.008,.013),'#82704e',foot,'skin',10,6);
      for(let k=0;k<4;k++){const t=.20+k*.17,p=pts[1].clone().lerp(end,t),radius=.013*(1-(.5+t*.5)*.58)+.001;scute(p,end.clone().sub(pts[1]),V(0,1,0),radius,.010,'#958767',foot);}
    }
    tube([V(x,.055,-.015),V(x+s*.02,.017,.07),V(x+s*.024,.011,.1)],v=>.011*(1-v*.8),palette.bronze,foot);
    curvedClaw([V(x+s*.024,.011,.092),V(x+s*.025,.014,.106),V(x+s*.025,.007,.117)],v=>.004*(1-v*.9),'#42483e',foot);
  }
  // A curved two-part beak with an actual closed seam, rather than a cone.
  surface('skin',(u,v)=>{const a=(1-u)*Math.PI;const w=.074*Math.pow(1-v,.65)+.001;return V(Math.cos(a)*w,.895+Math.sin(a)*.041*(1-v)-v*v*.041,-.276-v*.145);},20,16,(u,v)=>new T.Color('#8b9b80').lerp(new T.Color('#d5b46a'),v).lerp(new T.Color('#80744f'),Math.max(0,(v-.82)/.18)*.55),'Head');
  surface('skin',(u,v)=>{const a=u*Math.PI;const w=.069*Math.pow(1-v,.72)+.001;return V(Math.cos(a)*w,.893-Math.sin(a)*.018*(1-v)-v*v*.039,-.273-v*.132);},20,12,'#a38b51','Mandible');
  for(let s of [-1,1])ellipsoid(V(s*.035,.920,-.315),V(.0055,.0022,.004),'#34362c','Head','skin',12,8);
  // Oblique eyes sit inside a feathered orbital transition. The eyelids are
  // upper/lower ribbons on the corneal dome, rather than flat eyebrow tabs.
  const lidPos=[],lidClosed=[],lidUV=[],lidIdx=[];
  for(let s of [-1,1]){
    const center=V(s*.119,.951,-.238),normal=V(s*.62,.03,-.785).normalize(),up=V(0,1,0),right=up.clone().cross(normal).normalize();
    function eyeDisk(mat,radius,depth,color){surface(mat,(u,v)=>{const a=-u*Math.PI*2,r=v*radius;return center.clone().addScaledVector(right,Math.cos(a)*r).addScaledVector(up,Math.sin(a)*r).addScaledVector(normal,depth+(mat==='cornea'?.012:.007)*Math.sqrt(Math.max(0,1-v*v)));},32,5,color,['iris','pupil'].includes(mat)?(s<0?'EyeL':'EyeR'):'Head',(u,v)=>[.5+.5*Math.cos(u*Math.PI*2)*v,.5+.5*Math.sin(u*Math.PI*2)*v]);}
    eyeDisk('skin',.0465,.002,'#655e3e');eyeDisk('eye',.044,.004,'#15130b');eyeDisk('iris',.040,.006,'#ffffff');eyeDisk('pupil',.017,.011,'#ffffff');eyeDisk('cornea',.044,.012,'#ffffff');
    for(let i=0;i<2;i++){const p=center.clone().addScaledVector(right,-.011+i*.019).addScaledVector(up,.017-i*.025).addScaledVector(normal,.017);ellipsoid(p,V(i?.0013:.0032,i?.0013:.0032,.0016),'#ffffff','Head','light',10,6);}
    for(const lidSide of [1,-1]){
      const base=lidPos.length/3,rows=6,cols=30;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const u=i/cols*2-1,x=u*.048,arch=Math.sqrt(Math.max(0,1-u*u)),outer=lidSide*.049*arch;
        for(let closed=0;closed<2;closed++){
          const edge=closed?(-.001+.003*u*u)*arch:lidSide*(lidSide>0?.039:.043)*arch,y=T.MathUtils.lerp(outer,edge,j/rows);
          const dome=Math.sqrt(Math.max(0,1-(x/.052)**2-(y/.052)**2));
          const p=center.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(normal,.004+dome*.019);
          const angle=Math.atan2((p.z+.153)/.151,p.x/.171),anchor=skullPoint(angle,p.y,.004);
          p.lerp(anchor,1-T.MathUtils.smoothstep(j/rows,0,.65));
          (closed?lidClosed:lidPos).push(p.x,p.y,p.z);
        }lidUV.push(i/cols,j/rows);
      }
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=base+j*(cols+1)+i;lidIdx.push(...(lidSide>0?[a,a+cols+2,a+1,a,a+cols+1,a+cols+2]:[a,a+1,a+cols+2,a,a+cols+2,a+cols+1]));}
    }
  }
  add('lid',lidPos,lidIdx,lidUV,palette.chalk,'Head',null,lidClosed);
  // A fine curved lid crease appears only as the eye closes. The open-state
  // triangles collapse behind the brow; it is part of the existing blink
  // morph and adds no separate material or draw call.
  for(const s of [-1,1]){
    const center=V(s*.119,.951,-.238),normal=V(s*.62,.03,-.785).normalize(),right=V(0,1,0).cross(normal).normalize(),p=[],closed=[],uv=[],idx=[];
    for(let i=0;i<=20;i++){const u=i/20*2-1,x=u*.043;for(let edge=0;edge<2;edge++){const open=center.clone().add(V(0,.05,0));const finish=center.clone().addScaledVector(right,x).add(V(0,-.004+.004*u*u+(edge?1:-1)*.00075,0)).addScaledVector(normal,.0072+.020*Math.sqrt(Math.max(0,1-(x/.051)**2)));p.push(...open);closed.push(...finish);uv.push(i/20,edge);}}
    for(let i=0;i<20;i++){const a=i*2;idx.push(a,a+3,a+1,a,a+2,a+3);}add('lid',p,idx,uv,'#777d67','Head',null,closed);
  }
  // One restrained luminous feather at the breast.
  const heart=bodyPoint(-Math.PI/2,.625,.015);heart.z=Math.min(heart.z,neckPoint(-Math.PI/2,.625,.013).z)-.004;
  ellipsoid(heart,V(.009,.018,.004),'#ffe8a3','Breast','glow',16,12);
  // One short gilded vane holds the ember inside the plumage, following the
  // actual breast surface instead of projecting a floating button and shadow.
  for(const sign of [-1,1]){
    const from=bodyPoint(-Math.PI/2+sign*.065,.645,.017),to=bodyPoint(-Math.PI/2+sign*.035,.600,.017);
    feather(from,to,.012,V(sign*.08,.1,-1),'#c4ab70','Breast',{bend:.001,gold:true,segments:7,soft:true});
  }
  // Rest wings wrap toward the back instead of hanging as parallel side planes.
  // This is baked into the asset, including the wrist bind position; airborne
  // animation unwinds it in shoulder-local space before spreading the wing.
  for(const b of Object.values(buckets))for(let i=0;i<b.p.length/3;i++){
    const index=b.si[i*4],s=index===boneIndex.WingL?-1:index===boneIndex.WingR?1:0;
    if(!s)continue;const shoulder=rest[s<0?'WingL':'WingR'];
    const p=V(...b.p.slice(i*3,i*3+3)).sub(shoulder).applyAxisAngle(V(0,1,0),-s*foldedWingYaw).add(shoulder);
    b.p[i*3]=p.x;b.p[i*3+1]=p.y;b.p[i*3+2]=p.z;
  }
  // Feather tract normals are authored in bind space, so rotate them with
  // the folded wing positions before importing them into the final geometry.
  for(const b of Object.values(buckets))for(const entry of b.smooth||[]){const index=b.si[entry[0]*4],s=index===boneIndex.WingL?-1:index===boneIndex.WingR?1:0;if(s){const n=V(entry[1],entry[2],entry[3]).applyAxisAngle(V(0,1,0),-s*foldedWingYaw);entry[1]=n.x;entry[2]=n.y;entry[3]=n.z;}}
  for(const [name,b] of Object.entries(buckets)){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.p,3));geo.setAttribute('uv',new T.Uint16BufferAttribute(b.uv.map(v=>Math.round(T.MathUtils.clamp(v,0,1)*65535)),2,true));
    geo.setAttribute('color',new T.Uint8BufferAttribute(b.color.map(v=>Math.round(T.MathUtils.clamp(v,0,1)*255)),3,true));
    geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(b.si,4));
    const weights=new Uint8Array(b.sw.length);for(let i=0;i<b.sw.length;i+=4){weights[i]=Math.round(b.sw[i]*255);weights[i+1]=255-weights[i];}
    geo.setAttribute('skinWeight',new T.Uint8BufferAttribute(weights,4,true));geo.setIndex(b.idx);geo.computeVertexNormals();
    if(b.normalWelds){const normals=geo.attributes.normal;for(const indices of b.normalWelds){const sum=V();for(const i of indices)sum.add(V().fromBufferAttribute(normals,i));sum.normalize();for(const i of indices)normals.setXYZ(i,sum.x,sum.y,sum.z);}}
    // Filament-level scattering is represented by a smooth tract normal; the
    // silhouette and vane texture still retain individual contour feathers.
    if(b.smooth){const normals=geo.attributes.normal;for(const [i,x,y,z,smoothing]of b.smooth){const n=V().fromBufferAttribute(normals,i).lerp(V(x,y,z),smoothing).normalize();normals.setXYZ(i,n.x,n.y,n.z);}}
    // A curved feather can fold a tiny edge triangle while its authored tract
    // normal still points outwards. DoubleSide flips that normal again on a
    // back-facing triangle, producing black crawling flecks under motion.
    // Match winding to the groom normal; do not hide it by increasing glow.
    if(name==='contour'){
      const p=geo.attributes.position,n=geo.attributes.normal,index=geo.index,a=V(),b=V(),c=V(),face=V(),average=V();let corrected=0;
      for(let i=0;i<index.count;i+=3){const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);face.subVectors(b,a).cross(c.sub(a));average.fromBufferAttribute(n,ia).add(a.fromBufferAttribute(n,ib)).add(b.fromBufferAttribute(n,ic));if(face.dot(average)<-1e-12){index.setX(i+1,ic);index.setX(i+2,ib);corrected++;}}
      geo.userData.windingCorrections=corrected;
    }
    if(b.morph.length){
      geo.morphAttributes.position=[new T.Float32BufferAttribute(b.morph,3)];geo.morphAttributes.position[0].name='Blink';
      const closedGeometry=new T.BufferGeometry();closedGeometry.setAttribute('position',new T.Float32BufferAttribute(b.morph,3));closedGeometry.setIndex(b.idx);closedGeometry.computeVertexNormals();geo.morphAttributes.normal=[closedGeometry.getAttribute('normal')];
    }
    const mesh=new T.SkinnedMesh(geo,mats[name]);mesh.name=name==='lid'?'Eyelids':`Shuoyu_${name}`;mesh.bind(skeleton,new T.Matrix4());mesh.castShadow=name!=='contour';mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
  }
  const qTrack=(bone,axis,values,times)=>new T.QuaternionKeyframeTrack(`${bone}.quaternion`,times,values.flatMap(a=>new T.Quaternion().setFromAxisAngle(axis,a).toArray()));
  const glideWingTrack=(bone,sign,values,times)=>new T.QuaternionKeyframeTrack(`${bone}.quaternion`,times,values.flatMap(a=>new T.Quaternion().setFromAxisAngle(V(0,0,1),a).multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),sign*foldedWingYaw)).toArray()));
  const x=V(1,0,0),y=V(0,1,0),z=V(0,0,1);
  const clips=[];const clip=(name,duration,tracks)=>clips.push(new T.AnimationClip(name,duration,tracks));
  clip('IdleBreath',4,[new T.VectorKeyframeTrack('Breast.scale',[0,1,2,3,4],[1,1,1,1.012,1.016,1.014,1,1,1,.992,.99,.994,1,1,1]),qTrack('Head',x,[0,-.025,0,.018,0],[0,1,2,3,4]),qTrack('Tail',x,[0,.025,0,-.018,0],[0,1,2,3,4])]);
  clip('Blink',4.8,[new T.NumberKeyframeTrack('Eyelids.morphTargetInfluences[Blink]',[0,3.7,3.79,3.87,3.98,4.8],[0,0,1,1,0,0])]);
  const walkTimes=[0,.2,.4,.6,.8];
  clip('Walk',.8,[qTrack('LegL',x,[.35,0,-.35,0,.35],walkTimes),qTrack('LegR',x,[-.35,0,.35,0,-.35],walkTimes),qTrack('FootL',x,[-.17,.05,.17,.05,-.17],walkTimes),qTrack('FootR',x,[.17,.05,-.17,.05,.17],walkTimes),qTrack('Pelvis',z,[.045,0,-.045,0,.045],walkTimes),qTrack('Crest',x,[.06,-.02,.06,-.02,.06],walkTimes)]);
  clip('Run',.48,[qTrack('LegL',x,[.62,0,-.62,0,.62],[0,.12,.24,.36,.48]),qTrack('LegR',x,[-.62,0,.62,0,-.62],[0,.12,.24,.36,.48]),qTrack('Neck',x,[-.08,-.04,-.08,-.04,-.08],[0,.12,.24,.36,.48]),qTrack('Tail',x,[.1,.04,.1,.04,.1],[0,.12,.24,.36,.48])]);
  const primaryGlideTracks=[];for(const s of [-1,1]){const side=s<0?'L':'R';for(let i=0;i<5;i++)primaryGlideTracks.push(new T.QuaternionKeyframeTrack(`Primary${side}${i}.quaternion`,[0,1,2],[0,1,0].flatMap(t=>new T.Quaternion().setFromEuler(new T.Euler((i-2)*.048,s*(.012+t*.012),0)).toArray())));primaryGlideTracks.push(qTrack(`TailFan${side}`,y,[s*.10,s*.12,s*.10],[0,1,2]));}
  clip('Glide',2,[glideWingTrack('WingL',-1,[-1.08,-1.16,-1.08],[0,1,2]),glideWingTrack('WingR',1,[1.08,1.16,1.08],[0,1,2]),qTrack('FlightL',y,[-.3,-.34,-.3],[0,1,2]),qTrack('FlightR',y,[.3,.34,.3],[0,1,2]),qTrack('LegL',x,[-.65,-.65],[0,2]),qTrack('LegR',x,[-.65,-.65],[0,2]),qTrack('Tail',x,[.18,.14,.18],[0,1,2]),...primaryGlideTracks]);
  clip('Listen',3,[qTrack('Head',z,[0,-.19,-.19,0],[0,.5,2.5,3]),qTrack('Neck',y,[0,-.13,-.13,0],[0,.7,2.5,3]),qTrack('Crest',z,[0,-.13,-.08,0],[0,.5,2.5,3])]);
  clip('LookAround',4,[qTrack('Head',y,[0,.3,.3,-.22,0],[0,.7,1.5,2.8,4])]);
  clip('Start',.45,[qTrack('Breast',x,[0,-.16,0],[0,.2,.45]),qTrack('Crest',x,[0,.16,0],[0,.2,.45])]);
  clip('TurnLean',1,[qTrack('Breast',z,[0,.12,0],[0,.5,1]),qTrack('Head',y,[0,-.22,0],[0,.4,1])]);
  clip('Brake',.6,[qTrack('Breast',x,[-.12,.16,0],[0,.25,.6]),qTrack('WingL',z,[0,.25,0],[0,.2,.6]),qTrack('WingR',z,[0,-.25,0],[0,.2,.6])]);
  clip('Land',.7,[new T.VectorKeyframeTrack('Breast.scale',[0,.18,.7],[1,1,1,1.08,.87,1.05,1,1,1]),qTrack('Tail',x,[.15,-.12,0],[0,.23,.7])]);
  clip('Resonance',3,[qTrack('WingL',z,[0,.45,.45,0],[0,.7,2.3,3]),qTrack('WingR',z,[0,-.45,-.45,0],[0,.7,2.3,3]),qTrack('Head',x,[0,-.12,-.12,0],[0,.6,2.4,3])]);
  clip('StartleRecover',2,[qTrack('Head',x,[0,.2,-.05,0],[0,.14,.7,2]),qTrack('Crest',x,[0,-.25,.08,0],[0,.15,.8,2]),qTrack('WingL',z,[0,.4,0,0],[0,.15,.8,2]),qTrack('WingR',z,[0,-.4,0,0],[0,.15,.8,2])]);
  group.animations=clips;
  group.userData={originalCharacter:true,source:'scripts/build-shuoyu.source.js',method:'V9 unified sculpted skull and groom, orbital lids, body-to-tail tracts and restrained growth plumage; authored parametric mesh, not high-poly scanned',feathers:featherCount,foldedWingYaw,primaryPairs:5,forward:'-Z',footY:0,collisionCapsule:{radius:.22,height:1.06,offsetY:.53},lod:detail===1?'LOD0':'LOD1',materials:Object.keys(buckets).length};
  group.userData.primaryTipPositions=Object.fromEntries([-1,1].map(s=>{const side=s<0?'L':'R',shoulder=rest[`Wing${side}`];return [side,V(s*.292,.305,.680).sub(shoulder).applyAxisAngle(V(0,1,0),-s*foldedWingYaw).add(shoulder).toArray()];}));
  return group;
}


