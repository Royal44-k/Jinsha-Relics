import * as T from 'three';
import {skyDome} from './river-sky.js';
import {ground,riverX,riverWidth,westEdge,sites,origin} from './geography.js';
import {createRiverGroundcover} from './river-groundcover.js';
import {makeTerrainSampler} from './terrain-surface.js';
import {timberSolids} from './survey-solids.js';

function seedRandom(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
const rand=seedRandom(28161);
const between=(lo,hi)=>lo+(hi-lo)*rand();
const clamp=T.MathUtils.clamp;
const vec=(x,y,z)=>new T.Vector3(x,y,z);
function texture(path, repeat, color=true){
  const map=new T.TextureLoader().load(path);
  if(color)map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(repeat,repeat);map.anisotropy=4;return map;
}
const noiseGL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),u.x),u.y);}
float fb(vec2 p){return .57*noise(p)+.27*noise(p*2.07)+.12*noise(p*4.19)+.04*noise(p*8.36);}
`;
const surveyRoute=[origin,...sites];
const fieldRoutes=[[sites[0],[-25,27],[-43,25.7],[-43,18.5]],[sites[4],[31,-17],[45,-9],[45,-13]],[sites[8],[14,-69],[8,-74]]];
function distanceFromRoute(x,z){
  let best=Infinity;
  for(let i=1;i<surveyRoute.length;i++){
    const [ax,az]=surveyRoute[i-1],[bx,bz]=surveyRoute[i],dx=bx-ax,dz=bz-az;
    const u=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
    best=Math.min(best,Math.hypot(x-ax-u*dx,z-az-u*dz));
  }
  for(const branch of fieldRoutes)for(let i=1;i<branch.length;i++){
    const [ax,az]=branch[i-1],[bx,bz]=branch[i],dx=bx-ax,dz=bz-az;
    const u=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
    best=Math.min(best,Math.hypot(x-ax-u*dx,z-az-u*dz));
  }
  return best;
}
function westernSlope(x,z){
  const rise=3.4+4.9*(.6+.4*Math.sin(.12*z+.033*x))+2.6*Math.cos(z*.16-x*.13);
  return ground(x,z)+T.MathUtils.smoothstep(-77-x,0,20)*rise;
}
function terrain(scene,world){
  const geom=new T.PlaneGeometry(154,195,150,198);geom.rotateX(-Math.PI/2);geom.translate(0,0,-10);
  const pos=geom.attributes.position,cover=[],colors=[],col=new T.Color();
  const shade=new T.Color('#b6b4a4'),sun=new T.Color('#e4e1ce'),smooth=T.MathUtils.smoothstep;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=ground(x,z),dist=distanceFromRoute(x,z);
    pos.setY(i,y);
    const bank=Math.abs(x-riverX(z))-riverWidth(z);
    const mosaic=.47*Math.sin(x*.24+z*.08)+.31*Math.sin(z*.31-x*.075)+.22*Math.cos(x*.58+z*.35);
    const lane=x< -24&&x> -65?Math.abs(z+38-.080*(x+61)-1.12*Math.sin((x+61)*.15)):Infinity;
    const yard=Math.max(Math.abs(x+61)-4.8,Math.abs(z+41)-3.8);
    const verge=smooth(Math.min(dist,lane+.25,yard)+mosaic*.56,1.1,3.35);
    const detritus=smooth(bank,1.3,6)*(.17+.78*smooth(mosaic+.18*y,-.44,.72))*verge;
    const bar=(1-smooth(Math.abs(bank-.80+1.75*mosaic),.8,3.55))*(.18+.72*smooth(mosaic,-.76,.67));
    const mud=(1-smooth(y+.22*mosaic,-.05,.88))*(.95-.53*bar);
    // Litter collects beyond the trampled shoulder. Locally exposed silt and
    // gravel follow the meander itself, including its submerged continuation.
    cover.push(detritus,bar,mud,(1-verge)*smooth(y,-.22,.62));
    col.copy(shade).lerp(sun,clamp(.62+.25*mosaic+.12*Math.sin(z*.055-x*.096),0,1));colors.push(col.r,col.g,col.b);
  }
  geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.setAttribute('bedCover',new T.Float32BufferAttribute(cover,4));geom.computeVertexNormals();
  const folder='/assets/v5/ground/aerial_grass_rock_';
  const litter=texture('/assets/environment/forest_floor_diff_1k.webp',1),litterNormal=texture('/assets/environment/forest_floor_nor_gl_1k.webp',1,false);
  const stone=texture('/assets/environment/rock_boulder_dry_diff_1k.webp',1);
  const mat=new T.MeshStandardMaterial({map:texture(folder+'diff_1k.webp',40),normalMap:texture(folder+'nor_gl_1k.webp',40,false),normalScale:new T.Vector2(.48,.48),vertexColors:true,roughness:.97});
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{riverLeafMap:{value:litter},riverLeafNormal:{value:litterNormal},riverStoneMap:{value:stone}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 bedCover;varying vec4 vBedCover;varying vec2 vBedUv;`).replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 bankWorld=modelMatrix*vec4(position,1.);
      vBedCover=bedCover;vBedUv=vec2(bankWorld.x,-bankWorld.z);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D riverLeafMap,riverLeafNormal,riverStoneMap;varying vec4 vBedCover;varying vec2 vBedUv;
      const mat2 bedTurn=mat2(.94,.341,-.341,.94);`).replace('#include <map_fragment>',`
      vec2 litterUv=bedTurn*vBedUv*.61;
      vec3 moss=texture2D(map,vMapUv).rgb,leaf=texture2D(riverLeafMap,litterUv).rgb;
      vec3 cobble=texture2D(riverStoneMap,vBedUv*.82+vec2(.25,.74)).rgb;
      float mineral=dot(cobble,vec3(.24,.57,.19));
      float grassLight=dot(moss,vec3(.26,.55,.19));
      // Restrained moss and two sizes of mineral grain keep the exposed clay legible.
      vec3 turf=mix(moss,grassLight*vec3(.84,1.02,.79),.67);
      vec3 litterBed=mix(leaf,dot(leaf,vec3(.24,.60,.16))*vec3(1.09,.97,.78),.41)*.77;
      vec3 pebbles=mix(cobble,mineral*vec3(.83,.91,.88),.48);
      float fine=clamp(.51+.71*mineral+.32*grassLight,.42,.97);
      vec3 wetSilt=vec3(.17,.169,.137)*fine;
      vec3 packedClay=mix(vec3(.155,.115,.073),vec3(.34,.252,.155),smoothstep(.10,.65,mineral));
      packedClay*=.68+grassLight*.69+.12*sin(vBedUv.x*.73+vBedUv.y*.83);
      vec3 bed=mix(turf,litterBed,vBedCover.x);
      bed=mix(bed,pebbles,vBedCover.y);bed=mix(bed,wetSilt,vBedCover.z);
      diffuseColor.rgb*=mix(bed,packedClay,vBedCover.w*.94);
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.57,vBedCover.z);`).replace('#include <normal_fragment_maps>',`
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 grassN=texture2D(normalMap,vNormalMapUv).xyz*2.-1.;
        vec3 leafN=texture2D(riverLeafNormal,litterUv).xyz*2.-1.;
        leafN.xy=vec2(dot(bedTurn[0],leafN.xy),dot(bedTurn[1],leafN.xy));
        vec2 perturb=mix(grassN.xy,leafN.xy,vBedCover.x)*normalScale;
        perturb*=1.-max(vBedCover.z*.82,vBedCover.w*.46);
        normal=normalize(tbn*normalize(vec3(perturb,1.)));
      #endif`);
  };
  mat.addEventListener('dispose',()=>{litter.dispose();litterNormal.dispose();});
  const mesh=new T.Mesh(geom,mat);mesh.name='古河漫滩 · 腐殖层与砾岸';mesh.receiveShadow=true;scene.add(mesh);
  world.terrainSurface=makeTerrainSampler(geom,mat);
  // Continue the terrain beyond the western court. From a raised shelf the
  // foreground must meet the distant foothills even when the camera looks down.
  const ridge=new T.PlaneGeometry(90,195,39,66);
  ridge.rotateX(-Math.PI/2);ridge.translate(-122,0,-10);
  const rp=ridge.attributes.position,tones=[],beds=[];
  for(let i=0;i<rp.count;i++){
    const x=rp.getX(i),z=rp.getZ(i),f=smooth(-77-x,0,20);
    rp.setY(i,westernSlope(x,z)-.028);
    const tint=.74-.14*f+.08*Math.cos(z*.24+x*.12);tones.push(tint,tint*1.03,tint*.91);
    beds.push(.63+.17*Math.sin(z*.13),0,0,0);
  }
  ridge.setAttribute('color',new T.Float32BufferAttribute(tones,3));ridge.setAttribute('bedCover',new T.Float32BufferAttribute(beds,4));ridge.computeVertexNormals();
  scene.add(new T.Mesh(ridge,mat));
  return {stone,floor:geom};
}
// Ground-canopy occlusion is baked into the existing terrain before upload.
// Branch cards do not need an extra alpha-tested shadow pass on moving frames.
function shadeTreeGround(floor,x,z,h){
  const {position,color}=floor.attributes;
  const {width,height,widthSegments:columns,heightSegments:rows}=floor.parameters;
  const firstX=position.getX(0),firstZ=position.getZ(0),radius=h*.51;
  const cx=x+h*.27,cz=z+h*.22;
  const xMin=Math.max(0,Math.floor((cx-radius-firstX)*columns/width));
  const xMax=Math.min(columns,Math.ceil((cx+radius-firstX)*columns/width));
  const zMin=Math.max(0,Math.floor((cz-radius-firstZ)*rows/height));
  const zMax=Math.min(rows,Math.ceil((cz+radius-firstZ)*rows/height));
  for(let row=zMin;row<=zMax;row++)for(let col=xMin;col<=xMax;col++){
    const i=row*(columns+1)+col,dx=position.getX(i)-cx,dz=position.getZ(i)-cz;
    const cover=1-T.MathUtils.smoothstep((dx*dx+dz*dz)/(radius*radius),.08,1);
    const dapple=.74+.14*Math.sin(dx*2.1+dz*.8)+.12*Math.cos(dz*1.9-dx*.9);
    const shade=cover*dapple;
    color.setXYZ(i,color.getX(i)*(1-.34*shade),color.getY(i)*(1-.27*shade),color.getZ(i)*(1-.19*shade));
  }
}
function watercourse(scene,panorama){
  const s=320,positions=[],indices=[];
  for(let i=0;i<=s;i++){
    const z=-108+i*199/s,x=riverX(z),w=riverWidth(z)+2.4;positions.push(x-w,.012,z,x+w,.012,z);
    if(i){const j=i*2;indices.push(j-2,j,j-1,j-1,j,j+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
  const m=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{clock:{value:0},eye:{value:new T.Vector3()},panorama:{value:panorama}},
    vertexShader:`varying vec3 w;void main(){w=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 w;uniform float clock;uniform vec3 eye;uniform sampler2D panorama;${noiseGL}
    float rip(vec2 p){return .55*sin(p.y*3.2+.7*sin(p.x*2.4)+clock*1.72)+.27*sin(dot(p,vec2(4.1,6.3))-clock*1.4)+.18*sin(p.x*8.+p.y*4.+clock*2.3);}
    void main(){vec2 uv=w.xz;float r=rip(uv);vec3 n=normalize(vec3((r-rip(uv+vec2(.03,0.)))*.75,1.,(r-rip(uv+vec2(0.,.03)))*.64));
    vec3 v=normalize(eye-w),sun=normalize(vec3(-.58,.22,-.79));float f=pow(1.-abs(dot(n,v)),2.6);
    float cx=3.+5.4*sin(w.z*.074+.2)+2.1*sin(w.z*.13);
    float bank=abs(w.x-cx)-(3.1+.65*cos(w.z*.085));float shallow=smoothstep(-.45,1.3,bank);
    vec3 c=mix(vec3(.028,.146,.144),vec3(.19,.28,.217),shallow);
    float reeds=smoothstep(.28,.70,fb(vec2(uv.x*.28+r*.025,uv.y*.08)));
    vec3 mirror=reflect(-v,n);float skyU=acos(clamp(dot(normalize(mirror.xz+vec2(.00001)),normalize(vec2(-.60,-.80))),-1.,1.))/3.141593;
    vec3 sky=texture2D(panorama,vec2(skyU,clamp(.155+asin(clamp(mirror.y,-1.,1.))*1.15,.02,.985))).rgb;
    c=mix(c,mix(sky,vec3(.09,.18,.15),reeds*.28),.10+f*.79);
    c+=vec3(1.6,.97,.44)*pow(max(0.,dot(reflect(-sun,n),v)),95.);
    c+=vec3(.22,.23,.16)*smoothstep(.65,.95,r)*shallow*.3;
    gl_FragColor=vec4(c,mix(.89,.27,shallow));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(g,m);mesh.renderOrder=2;scene.add(mesh);return m;
}
function plantLife(scene,world,stoneTexture,floor) {
  const trunks=[],branches=[],sprays=[],stones=[],reeds=[],tassels=[],grasses=[];
  const up=vec(0,1,0),dummy=new T.Object3D(),q=new T.Quaternion();
  let treeOrigin=null;
  function pose(list,x,y,z,sx,sy,sz,ax,ay,az,c){
    dummy.position.set(x,y,z);dummy.rotation.set(ax,ay,az);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();list.push([dummy.matrix.clone(),c,treeOrigin]);
  }
  function beam(list,a,b,r,c){
    const dir=b.clone().sub(a);dummy.position.copy(a).lerp(b,.5);dummy.quaternion.copy(q.setFromUnitVectors(up,dir.clone().normalize()));dummy.scale.set(r,dir.length(),r);dummy.updateMatrix();list.push([dummy.matrix.clone(),c,treeOrigin]);
  }
  const palettes=[0xafbe7f,0x9ea966,0xc7c482,0x9db371,0xc3c293];
  const meadowRoll=rand,meadowRange=between,woodlandRoll=seedRandom(88291);
  const woodlandRange=(lo,hi)=>lo+(hi-lo)*woodlandRoll();
  for(let i=0;i<423;i++){
    const west=i>=390,rand=west?woodlandRoll:meadowRoll,between=west?woodlandRange:meadowRange;
    const x=west?between(-99,-76):between(-57,57),z=west?between(-70,-21):between(-88,67),y=west?westernSlope(x,z):ground(x,z);
    if(y<.45||distanceFromRoute(x,z)<4.1||sites.some(([a,b])=>Math.hypot(x-a,z-b)<6.5))continue;
    if(Math.abs(x)<25&&rand()<.72)continue;
    const h=between(3.5,8.7),start=vec(x,y-.14,z),top=vec(x+between(-.4,.4),y+h,z+between(-.35,.35));
    treeOrigin=start;
    shadeTreeGround(floor,x,z,h);
    beam(trunks,start,top,h*.023,0x91826a);
    const inMap=x>westEdge(z)&&x<55&&z>-83&&z<55;
    if(inMap)timberSolids(world.colliders,start,top,h*.022,'树干挡住去路。侧转绕开，或升到枝冠外缘再向前飞。');
    for(let j=0;j<7;j++){
      const a=between(0,6.283),l=h*between(.18,.43),point=start.clone().lerp(top,.37+j*.074);
      const end=vec(point.x+Math.cos(a)*l,point.y+l*between(.5,1.25),point.z+Math.sin(a)*l);
      const girth=h*between(.006,.014);
      beam(branches,point,end,girth,0x938566);
      if(inMap&&girth>=.052)timberSolids(world.colliders,point,end,girth,'前方横枝低垂。从枝下穿行，或先升高再飞过。');
      for(let k=0;k<5;k++){const u=between(.32,1),p=point.clone().lerp(end,u),scale=h*between(.17,.32);
        pose(sprays,p.x+between(-.045,.045),p.y,p.z+between(-.045,.045),scale*1.24,scale*1.18,scale,between(-.62,.62),a+k*1.4,between(-.65,.65),palettes[i%palettes.length]);}
      if(i%7===0&&j===0&&x>-50&&x<51&&z>-79&&z<51)world.perches.push({id:'bough-'+i,label:'河岸横枝',position:point.clone().lerp(end,.77).add(vec(0,.065,0)),yaw:-a,radius:.65});
    }
  }
  treeOrigin=null;
  for(let i=0;i<1200;i++){const z=between(-87,62),x=riverX(z)+(i%2?1:-1)*(riverWidth(z)+between(.85,5.3)),y=ground(x,z);
    if(distanceFromRoute(x,z)<1.5||sites.some(([a,b])=>Math.hypot(x-a,z-b)<3))continue;
    const h=between(.38,1.65),lean=between(-.17,.17),a=between(0,6.28);
    pose(reeds,x,y+h*.47,z,.026,h,.026,lean,a,lean,0x94a375);
    pose(grasses,x,y+h*.41,z,h*.40,h*.55,h*.40,lean,a,lean,0x8e9f64);
    if(i%3===0)pose(tassels,x+h*lean*.7,y+h*.99,z,.046,h*.16,.046,lean,a,lean,0xc3ad78);
  }
  for(let i=0;i<2300;i++){const x=between(-42,42),z=between(-73,54),y=ground(x,z);
    if(y<.43||distanceFromRoute(x,z)<1.25||sites.some(([a,b])=>Math.hypot(x-a,z-b)<2.7))continue;
    const h=between(.13,.73);pose(grasses,x,y+h*.4,z,h*.85,h,h*.85,between(-.18,.18),between(0,6.3),0,palettes[i%5]);
  }
  for(let i=0;i<850;i++){const z=between(-83,62),x=riverX(z)+between(-9,9),y=ground(x,z),s=between(.07,.46);
    pose(stones,x,y,z,s,s*between(.25,.65),s*between(.5,1.6),rand(),rand()*6,rand()*.2,[0xb4aca0,0x8a8980,0xab9a82][i%3]);
    // Small exposed cobbles still step underfoot. Taller ones use the scale
    // and rotation of the actual instance, including submerged boulders.
    const e=dummy.matrix.elements,rise=Math.hypot(e[1],e[5],e[9]);
    if(rise>.23)world.colliders.push({x,z,y:y-.12,height:rise+.10,radius:Math.min(Math.hypot(e[0],e[4],e[8]),Math.hypot(e[2],e[6],e[10]))*.88,
      hint:'前方露出河石。轻按空格跳越，或沿石侧绕行。'});
  }
  const cells=[];
  function batch(g,m,items,shadow=false,reach=36){
    const bands=new Map();
    for(const [matrix,color,owner] of items){
      const x=Math.floor((owner?.x??matrix.elements[12])/18),z=Math.floor((owner?.z??matrix.elements[14])/18),id=x+','+z;
      if(!bands.has(id))bands.set(id,{x:(x+.5)*18,z:(z+.5)*18,local:[]});
      bands.get(id).local.push([matrix,color]);
    }
    for(const {x,z,local} of bands.values()){
      const obj=new T.InstancedMesh(g,m,local.length),color=new T.Color();
      local.forEach(([matrix,tint],i)=>{obj.setMatrixAt(i,matrix);obj.setColorAt(i,color.setHex(tint));});
      obj.computeBoundingSphere();obj.castShadow=shadow;obj.receiveShadow=true;scene.add(obj);
      cells.push({x,z,obj,range:(reach+13)**2});
    }
  }
  const bark=new T.MeshStandardMaterial({map:texture('/assets/environment/bark_brown_02_diff_1k.webp',1),roughness:.94});
  world.fieldTextures={bark:bark.map,stone:stoneTexture};
  const grassMat=new T.MeshStandardMaterial({color:0x9fb28c,side:T.DoubleSide,roughness:1});
  const leafMap=new T.TextureLoader().load('/assets/v10/river-canopy.webp');leafMap.colorSpace=T.SRGBColorSpace;leafMap.anisotropy=4;
  const leaves=new T.MeshStandardMaterial({map:leafMap,side:T.DoubleSide,alphaTest:.31,alphaToCoverage:true,roughness:.91});
  const breeze={value:0};
  leaves.onBeforeCompile=shader=>{
    shader.uniforms.riverBreeze=breeze;
    shader.vertexShader='uniform float riverBreeze;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=position.y*position.y*.043*sin(riverBreeze*.9+instanceMatrix[3].x*.43+instanceMatrix[3].z*.32);');
  };
  const sprig=new T.PlaneGeometry(1,1,2,3);sprig.translate(0,.5,0);
  const grassGeo=new T.BufferGeometry(),verts=[];
  for(let j=0;j<16;j++){
    const a=between(0,6.28),x=between(-.24,.24),z=between(-.24,.24),h=between(.4,.9),dx=Math.sin(a),dz=Math.cos(a),width=between(.013,.028);
    const left=[x-width*dz,-.41,z+width*dx],right=[x+width*dz,-.41,z-width*dx];
    const midL=[x+dx*.09-width*.66*dz,h*.61-.41,z+dz*.09+width*.66*dx],midR=[x+dx*.09+width*.66*dz,h*.61-.41,z+dz*.09-width*.66*dx];
    const tip=[x+dx*between(.23,.46),h-.42,z+dz*.36];
    verts.push(...left,...right,...midL,...right,...midR,...midL,...midL,...midR,...tip);
  }
  grassGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));grassGeo.computeVertexNormals();
  batch(new T.CylinderGeometry(.58,1,1,7),bark,trunks,true,49);batch(new T.CylinderGeometry(.38,1,1,5),bark,branches,true,49);
  batch(sprig,leaves,sprays,false,49);batch(grassGeo,grassMat,grasses,false,21);
  batch(new T.CylinderGeometry(.45,1,1,4),grassMat,reeds);batch(new T.IcosahedronGeometry(1,1),grassMat,tassels);
  batch(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({map:stoneTexture,roughness:.92}),stones,false,23);
  return (p,t)=>{breeze.value=t;for(const c of cells)c.obj.visible=(p.x-c.x)**2+(p.z-c.z)**2<c.range;};
}
export function createLandscape(scene,world){
  const sky=skyDome(scene),land=terrain(scene,world),water=watercourse(scene,sky.material.uniforms.panorama.value);
  const plants=plantLife(scene,world,land.stone,land.floor),groundcover=createRiverGroundcover(scene,distanceFromRoute);
  return (t,camera)=>{plants(camera.position,t);groundcover(camera.position,t);sky.dome.position.copy(camera.position);sky.material.uniforms.warmth.value=T.MathUtils.smoothstep(-camera.position.z,-18,52);water.uniforms.clock.value=t;water.uniforms.eye.value.copy(camera.position);};
}
