import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
// Original botanical and domestic impressions, with shared geometry and bounded cells.
export function createLivingLandscape({scene,forest,traversal}){
 const group=new T.Group();group.name='V6 · 林河细景';scene.add(group);
 const geometries=new Set(),materials=new Set(),textures=new Set(),cells=[],cameraMeshes=[],time={value:0},player={value:V()},dummy=new T.Object3D();let seed=10238;
 const r=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;};
 const L=forest.length,at=(f,s=0)=>{const t=forest.path.getTangentAt(clamp(f,0,1));return forest.sample(f*L).add(V(-t.z*s,0,t.x*s));};
 const geo=g=>(geometries.add(g),g),mat=p=>{const m=new T.MeshStandardMaterial(p);materials.add(m);return m;};
 const merge=parts=>{const all=parts.map(g=>g.index?g.toNonIndexed():g);const result=geo(mergeGeometries(all));for(const g of new Set([...parts,...all]))g.dispose();return result;};
 const cell=(f,name)=>{const c={f,centre:at(f),group:new T.Group()};c.group.name=name;group.add(c.group);cells.push(c);return c.group;};
 const mesh=(g,m,parent,p=V())=>{const o=new T.Mesh(geo(g),m);o.position.copy(p);o.receiveShadow=true;parent.add(o);return o;};
 const batch=(g,m,list,parent,name)=>{const o=new T.InstancedMesh(g,m,list.length);o.name=name;list.forEach((a,i)=>{dummy.position.copy(a.p);dummy.scale.copy(a.s||V(1,1,1));dummy.rotation.set(a.rx||0,a.ry||0,a.rz||0);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(a.color)o.setColorAt(i,a.color);});o.computeBoundingSphere();o.receiveShadow=true;o.userData.fullCount=list.length;parent.add(o);return o;};
 function blade(h,w,bend){const p=[],uv=[],idx=[];for(let i=0;i<=6;i++){const t=i/6,ww=w*Math.sin((t*.94+.04)*Math.PI)*.5;for(const side of [-1,1]){p.push(side*ww+Math.sin(t*1.5)*bend,h*t,t*t*bend*.65);uv.push((side+1)*.5,t);}if(i<6){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
 const grassParts=[];for(let i=0;i<11;i++){const g=blade(r(.27,.63),r(.018,.046),r(.09,.27));g.rotateY(i*2.399);g.translate(r(-.12,.12),0,r(-.12,.12));grassParts.push(g);}const grassGeo=merge(grassParts);
 const grassMat=mat({color:'#9ca875',roughness:.83,side:T.DoubleSide});
 grassMat.onBeforeCompile=s=>{s.uniforms.uLivingTime=time;s.uniforms.uLivingPlayer=player;s.vertexShader='uniform float uLivingTime;uniform vec3 uLivingPlayer;varying float vGrassHeight;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vGrassHeight=uv.y;vec3 wp=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;vec2 away=wp.xz-uLivingPlayer.xz;
 float near=(1.-smoothstep(.15,1.3,length(away)))*(1.-smoothstep(.8,1.6,abs(wp.y-uLivingPlayer.y)));
 transformed.xz+=uv.y*uv.y*(vec2(sin(uLivingTime*.9+wp.x*.9+wp.z*.4)*.095,cos(uLivingTime*.73+wp.z*.5)*.055)+normalize(away+vec2(.001))*near*.22);`);s.fragmentShader='varying float vGrassHeight;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.43,.55,.36),vec3(1.08,1.07,.87),smoothstep(0.,.9,vGrassHeight));');};grassMat.customProgramCacheKey=()=> 'v6-living-sedge';
 const grassBatches=[];
 for(let c=0;c<14;c++){
  const f=(c+.5)/14,parent=cell(f,'Living path shoulder '+c),list=[];
  for(let i=0;i<680;i++){
   const ff=(c+r(.02,.98))/14,side=(i%2?1:-1)*r(2.05,21),p=at(ff,side),n=forest.project(p),y=forest.sampleGround(p.x,p.z);
   if(y<-.19||y>4.8||n.offset<1.75||Math.sin(p.x*.33+p.z*.19)+Math.cos(p.z*.29)<-.5)continue;
   if(ff>.528&&ff<.65&&side< -2&&side> -18)continue;
   if(ff>.395&&ff<.44&&side< -.8&&side> -7)continue;
   if(ff>.90&&Math.abs(side)<5.5)continue;
   p.y=y-.035;const scale=r(.65,1.4),dry=ff>.50&&ff<.73;
   list.push({p,s:V(scale,scale*r(.55,1.1),scale),ry:r(0,6.28),color:new T.Color().setHSL(dry?r(.11,.16):r(.19,.26),r(.18,.33),r(.40,.68))});
  }
  if(list.length)grassBatches.push(batch(grassGeo,grassMat,list,parent,'Fine sedge and grass shoulder'));
 }
 // Shrub islands form a mid-height layer above the grass. Dense pockets and
 // open breaks follow the river, instead of even single-plant scatter.
 let canopyMaterial;forest.group.traverse(o=>{if(!canopyMaterial&&o.name==='Forest canopy instances')canopyMaterial=o.material;});
 const shrubParts=[],shrubWood=[],rects=[[15,15,151,435],[175,16,347,417],[367,24,501,379],[533,40,668,382],[707,13,850,439]],shoots=[];
 for(let j=0;j<7;j++){
  const angle=j*2.399,h=r(.64,1.25),span=r(.34,.67),points=[];for(let k=0;k<=3;k++){const f=k/3;points.push(V(Math.cos(angle)*span*f*f,h*f,Math.sin(angle)*span*f*f));}
  for(let k=0;k<3;k++){const from=points[k],to=points[k+1],g=new T.CylinderGeometry(.007-k*.0015,.010-k*.002,from.distanceTo(to),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),to.clone().sub(from).normalize()));g.translate(...from.clone().lerp(to,.5).toArray());shrubWood.push(g);}shoots.push({angle,h,span});
 }
 for(let i=0;i<84;i++){
  const shoot=shoots[i%7],t=.28+Math.floor(i/7)/12*.72,angle=shoot.angle+(i%2?1:-1)*.85,g=new T.PlaneGeometry(r(.16,.25),r(.23,.37),1,2),pos=g.attributes.position,uv=g.attributes.uv,rect=rects[i%rects.length];
  for(let k=0;k<pos.count;k++)pos.setZ(k,Math.sin(uv.getY(k)*Math.PI)*.035);
  g.computeVertexNormals();for(let k=0;k<uv.count;k++)uv.setXY(k,(rect[0]+uv.getX(k)*(rect[2]-rect[0]))/1024,1-(rect[3]-uv.getY(k)*(rect[3]-rect[1]))/1024);
  g.rotateX(r(-1.08,.4));g.rotateY(angle);g.rotateZ(r(-.32,.32));g.translate(Math.cos(shoot.angle)*shoot.span*t*t+Math.cos(angle)*.10,shoot.h*t,Math.sin(shoot.angle)*shoot.span*t*t+Math.sin(angle)*.10);shrubParts.push(g);
 }
 const shrubStemGeo=merge(shrubWood),shrubStemMat=mat({color:'#655e43',roughness:.96});
 const shrubGeo=merge(shrubParts),shrubMat=mat({map:canopyMaterial?.map,normalMap:canopyMaterial?.normalMap,normalScale:new T.Vector2(.18,.18),alphaTest:.42,color:'#edf0d7',emissive:'#33421f',emissiveIntensity:.10,roughness:.86,side:T.DoubleSide});
 shrubMat.onBeforeCompile=s=>{s.uniforms.uLivingTime=time;s.uniforms.uLivingPlayer=player;s.vertexShader='uniform float uLivingTime;uniform vec3 uLivingPlayer;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 wp=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;vec2 delta=wp.xz-uLivingPlayer.xz;float press=(1.-smoothstep(.2,1.4,length(delta)))*(1.-smoothstep(.7,2.,abs(wp.y-uLivingPlayer.y)));
 transformed.xz+=position.y*position.y*(vec2(sin(uLivingTime*.64+wp.x*.2+wp.z*.31)*.045,cos(uLivingTime*.5+wp.z*.28)*.025)+normalize(delta+vec2(.001))*press*.32);`);};shrubMat.customProgramCacheKey=()=> 'v6-photoscan-shrub-islands';
 const shrubBatches=[];
 for(const [a,b,side0,side1,count] of [[.015,.14,-20,-7,90],[.015,.14,7,24,110],[.16,.31,16,29,175],[.34,.48,-25,-12,115],[.35,.49,16,29,120],[.51,.69,15,29,220],[.615,.69,-26,-19,70],[.77,.95,15,29,145]]){
  const parent=cell((a+b)/2,'Layered riverside thicket'),list=[];
  for(let i=0;i<count;i++){
   const f=r(a,b),side=r(side0,side1),p=at(f,side),y=forest.sampleGround(p.x,p.z),patch=Math.sin(p.z*.28+p.x*.15)+.72*Math.cos(p.x*.36-p.z*.09);
   if(y<.08||y>5||patch<.05)continue;p.y=y-.08;const scale=r(.65,1.5)*(patch>.8?1.2:.85);
   for(let k=0;k<3;k++){const q=p.clone().add(V(r(-1.15,1.15),0,r(-1.15,1.15)));q.y=forest.sampleGround(q.x,q.z)-.08;if(q.y<.03)continue;list.push({p:q,s:V(scale*1.65,scale*r(.54,.78),scale*1.65),ry:r(0,6.28),color:new T.Color().setHSL(r(.19,.25),r(.07,.17),r(.76,.93))});}
  }
  if(list.length){shrubBatches.push(batch(shrubGeo,shrubMat,list,parent,'Riverside shrub thickets'));batch(shrubStemGeo,shrubStemMat,list,parent,'Thin woody shrub shoots');}
 }
 // Floating leaf rosettes have curved real geometry and a quiet rim. They sit
 // outside the traversable opening, leaving the river readable for diving.
 const leafParts=[];for(let i=0;i<6;i++){const a=i*2.399,g=new T.SphereGeometry(1,14,5,0,Math.PI*2,0,Math.PI*.47);g.scale(.30,.035,.19);g.rotateY(a);g.translate(Math.cos(a)*.25,0,Math.sin(a)*.25);leafParts.push(g);}const aquaticGeo=merge(leafParts),aquaticMat=mat({color:'#3c5c41',roughness:.38,metalness:0});
 for(const [f0,f1] of [[.18,.275],[.83,.94]]){const parent=cell((f0+f1)/2,'Sheltered floating leaf rosettes'),list=[];for(let i=0;i<80;i++){const f=r(f0,f1),centre=10.5+2*Math.sin(f*L*.027),half=f<.31?6.1:3.6,p=at(f,centre+(i%2?1:-1)*(half-r(.4,1.5)));if(forest.sampleGround(p.x,p.z)>-.35)continue;p.y=-.17+r(0,.015);const sc=r(.42,.9);list.push({p,s:V(sc,sc,sc),ry:r(0,6.28)});}if(list.length)batch(aquaticGeo,aquaticMat,list,parent,'Sheltered aquatic leaves');}
 // Domestic storytelling stays on existing usable surfaces: woven mat, ash,
 // broken vessels, and tiny seed spills. No extra invisible blockers.
 const hut=traversal.group.getObjectByName('Timber and thatch · artistic interpretation');
 const additions=[];
 if(hut){
  const fibre=mat({color:'#9c8961',roughness:1}),darkFibre=mat({color:'#6e6048',roughness:1});
  const weave=[];for(let i=0;i<40;i++){const g=new T.BoxGeometry(1.7,.008,.018);g.translate(-.4,.733,-.6+i*.027);weave.push(g);}for(let i=0;i<56;i++){const g=new T.BoxGeometry(.011,.012,1.1);g.translate(-1.23+i*.03,.739,-.06);weave.push(g);}const matMesh=mesh(merge(weave),fibre,hut);matMesh.name='Woven reed working mat';additions.push(matMesh);
  const grainGeo=geo(new T.SphereGeometry(1,6,4)),grains=[];for(let i=0;i<130;i++){const a=r(0,6.28),d=Math.sqrt(r(0,1))*.31;grains.push({p:V(-.5+Math.cos(a)*d,.76+r(0,.026),-.1+Math.sin(a)*d*.7),s:V(.014,.008,.028),ry:r(0,6.28)});}const grain=batch(grainGeo,mat({color:'#c3b07b',roughness:.9}),grains,hut,'Grain on the working mat');additions.push(grain);

 }
 // Local shafts emerge through the root crown's discontinuous gap. Their
 // footprint is authored within the aperture; depth testing masks foreground.
 const shaftMat=new T.ShaderMaterial({uniforms:{uTime:time,uColor:{value:new T.Color('#e8d9a5')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;uniform vec3 uColor;varying vec2 vUv;void main(){float edge=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.5);float longitudinal=pow(sin(vUv.y*3.1415926),.7);float veins=.72+.28*sin(vUv.x*31.+sin(vUv.y*12.+uTime*.08));gl_FragColor=vec4(uColor,edge*longitudinal*veins*.055);}',transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});materials.add(shaftMat);
 const shaftCell=cell(.105,'Crown aperture light');const shafts=[];
 for(let i=0;i<3;i++){const p=at(.105+i*.005,-1.4+i*1.7);p.y=4.2;const o=mesh(new T.PlaneGeometry(1.1+i*.4,9.5),shaftMat,shaftCell,p);o.rotation.z=-.47;o.rotation.y=.46;shafts.push(o);}
 function update(dt,t,{position,camera,quality='high',reduced=false}){time.value=reduced?0:t;player.value.copy(position);const f=forest.project(position).distance/L;for(const c of cells){const dist=Math.min(c.centre.distanceTo(position),camera?c.centre.distanceTo(camera.position):Infinity);c.group.visible=dist<(quality==='low'?40:57)&&Math.abs(c.f-f)<.18;for(const o of c.group.children)if(o.isInstancedMesh)o.count=quality==='low'?Math.ceil(o.userData.fullCount*.52):o.userData.fullCount;}for(const o of shafts)o.visible=quality!=='low';}
 function dispose(){group.removeFromParent();for(const o of additions)o.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 return {group,update,dispose,stats:()=>({activeCells:cells.filter(c=>c.group.visible).length,grassClumps:grassBatches.reduce((a,b)=>a+b.userData.fullCount,0),shrubs:shrubBatches.reduce((a,b)=>a+b.userData.fullCount,0)})};
}
