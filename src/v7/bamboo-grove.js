import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBambooStemGeometry as stemGeometry} from '../v8/profiled-tubes.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);
export const BAMBOO_STANDS=[{fraction:.535,side:-18,count:15,height:6.4},{fraction:.592,side:-20,count:18,height:7.1},{fraction:.65,side:-12,count:13,height:5.8}];

// Original interpretive bamboo: a material source in the domestic landscape,
// not an identification of a species excavated at Jinsha. Two draws per stand.
export function createBambooGrove({parent,forest,colliders,cameraColliders}){
 const group=new T.Group();group.name='V7 · 竹影生活材料';parent.add(group);
 const time={value:0},geometries=[],materials=[],stands=[],stats={culms:0,leaves:0,colliders:0};let seed=792041;
 const r=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;};
 const at=(f,s)=>{const t=forest.path.getTangentAt(f);return forest.sample(f*forest.length).add(V(-t.z*s,0,t.x*s));};
 const stemMat=new T.MeshStandardMaterial({color:'#b6bc84',roughness:.79,vertexColors:true});
 const leafMat=new T.MeshStandardMaterial({color:'#9aa969',roughness:.71,vertexColors:true,side:T.DoubleSide});materials.push(stemMat,leafMat);
 function wind(material,leaves){material.onBeforeCompile=s=>{s.uniforms.uBambooTime=time;s.vertexShader='uniform float uBambooTime;varying vec3 vCulmPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vCulmPosition=position;vec3 wp=(modelMatrix*vec4(position,1.)).xyz;
 transformed.x+=sin(uBambooTime*.62+wp.z*.3)*position.y*position.y*.0017;
 transformed.z+=cos(uBambooTime*.49+wp.x*.27)*position.y*position.y*.0010;
 ${leaves?'transformed.y+=sin(uBambooTime*2.1+wp.x*3.2+wp.z*2.7)*.018;':''}`);s.fragmentShader='varying vec3 vCulmPosition;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${leaves?'float vein=.97+.03*sin(vCulmPosition.x*141.+vCulmPosition.z*87.);diffuseColor.rgb*=vein;':'float fibres=.94+.06*sin(vCulmPosition.x*210.+vCulmPosition.z*153.);diffuseColor.rgb*=fibres;'}`);};material.customProgramCacheKey=()=>leaves?'v7-narrow-bamboo-leaf':'v7-nodal-bamboo-culm';}
 wind(stemMat,false);wind(leafMat,true);
 function coloredGeometry(p,idx,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;}
 function leafGeometry(origin,direction,length,width,curl,tint){const across=direction.clone().cross(UP).normalize(),p=[],idx=[],colors=[];for(let i=0;i<=6;i++){const t=i/6,centre=origin.clone().addScaledVector(direction,t*length).add(V(0,Math.sin(t*Math.PI)*.055-t*t*curl,0)),w=Math.pow(Math.sin(t*Math.PI),.9)*width;for(const side of [-1,1]){p.push(...centre.clone().addScaledVector(across,side*w).toArray());const c=tint.clone().multiplyScalar(.78+.22*Math.sin(t*Math.PI));colors.push(...c.toArray());}if(i<6){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}return coloredGeometry(p,idx,colors);}
 function merged(parts){const normalized=parts.map(x=>x.toNonIndexed()),g=mergeGeometries(normalized,false);for(const p of new Set([...parts,...normalized]))p.dispose();geometries.push(g);return g;}
 for(const placement of BAMBOO_STANDS){const centre=at(placement.fraction,placement.side),stand=new T.Group();stand.name='Bamboo stand '+placement.fraction;stand.position.copy(centre);group.add(stand);const wood=[],leaves=[],radius=2.6;
  for(let i=0;i<placement.count;i++){
   const theta=i*2.399+r(-.1,.1),spread=Math.sqrt((i+.4)/placement.count)*radius,base=V(Math.cos(theta)*spread,0,Math.sin(theta)*spread*.72);base.y=forest.sampleGround(centre.x+base.x,centre.z+base.z)-centre.y-.045;
   const h=placement.height*r(.73,1.13),lean=V(Math.cos(theta)*r(.6,1.4),0,Math.sin(theta)*r(.5,1.2)),curve=new T.CatmullRomCurve3([base,base.clone().add(V(lean.x*.05,h*.35,lean.z*.05)),base.clone().add(V(lean.x*.32,h*.72,lean.z*.32)),base.clone().add(V(lean.x,h,lean.z))]),thick=r(.038,.066),tint=new T.Color().setHSL(r(.19,.24),r(.19,.34),r(.28,.44)),nodes=Math.round(h/.46);
   wood.push(stemGeometry(curve,h,thick,tint,nodes));stats.culms++;
   for(let j=0;j<8;j++){const t=j/8,a=curve.getPoint(t).add(centre),b=curve.getPoint((j+1)/8).add(centre),rad=thick*(1-t*.83)*1.2;colliders.push({x:(a.x+b.x)*.5,z:(a.z+b.z)*.5,r:rad+Math.hypot(b.x-a.x,b.z-a.z)*.5,minY:Math.min(a.y,b.y),height:Math.max(a.y,b.y),bamboo:true,reason:'竹秆在风里轻摇，从竹丛的空隙穿过。'});stats.colliders++;}
   for(let j=0;j<6;j++){
    const t=Math.round((.35+j*.104)*nodes)/nodes,a=theta+j*2.399,root=curve.getPoint(t),span=r(.50,.93)*(1-j*.055),tip=root.clone().add(V(Math.cos(a)*span,.15+r(.04,.24),Math.sin(a)*span)),branch=new T.CatmullRomCurve3([root,root.clone().lerp(tip,.48).add(V(0,.06,0)),tip]);wood.push(stemGeometry(branch,.8,.010*(1-j*.055),tint));
    for(let k=0;k<9;k++){const along=.22+k*.085,origin=branch.getPoint(Math.min(.98,along)),side=k%2?1:-1,angle=a+side*r(.45,1.05),dir=V(Math.cos(angle),r(-.18,.12),Math.sin(angle)).normalize(),len=r(.32,.58)*(1-Math.abs(k-4)*.055),color=new T.Color().setHSL(r(.19,.26),r(.26,.39),r(.34,.52));leaves.push(leafGeometry(origin,dir,len,r(.028,.051),r(.06,.15),color));stats.leaves++;}
   }
   // Small dry sheath tips cling at lower nodes, merged into the culm draw.
   for(let j=1;j<4;j++){const root=curve.getPoint(j*.10),a=theta+j*2.4,dir=V(Math.cos(a)*.4,.9,Math.sin(a)*.4).normalize();wood.push(leafGeometry(root,dir,r(.16,.25),.029,.06,new T.Color('#9c8458')));}
  }
  const stems=new T.Mesh(merged(wood),stemMat),crown=new T.Mesh(merged(leaves),leafMat);stems.name='Jointed bamboo culms';crown.name='Lanceolate bamboo foliage';stems.castShadow=crown.castShadow=true;stems.receiveShadow=crown.receiveShadow=true;stand.add(stems,crown);cameraColliders.push(stems);stands.push({group:stand,centre,stems,crown,fraction:placement.fraction});
 }
 let disposed=false;
 function update(dt,t,position,{camera,quality='high',reduced=false}={}){if(disposed)return;if(dt>0&&!reduced)time.value+=Math.min(dt,.1);for(const s of stands){const distance=Math.min(s.centre.distanceTo(position),camera?s.centre.distanceTo(camera.position):Infinity);s.group.visible=distance<(quality==='low'?58:78);s.stems.castShadow=s.crown.castShadow=quality!=='low'&&distance<32;}}
 return {group,update,stats:()=>({...stats,activeStands:stands.filter(s=>s.group.visible).length,draws:stands.filter(s=>s.group.visible).length*2,triangles:geometries.reduce((n,g)=>n+(g.index?.count||g.attributes.position.count)/3,0)}),dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
