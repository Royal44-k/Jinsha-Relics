import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Sparse world-space atmosphere, authored as separated layers. These are
// transparent depth-tested planes/points, not a fluid or volumetric renderer.
export function createMicroclimate({scene,forest}){
 const group=new T.Group();group.name='V7 · 五境微气候';scene.add(group);
 const time={value:0},geometries=[],materials=[],cells=[],at=(f,s=0)=>{const t=forest.path.getTangentAt(f);return forest.sample(f*forest.length).add(V(-t.z*s,0,t.x*s));};
 let seed=79234;const r=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;};
 const vertex=`varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
 const fragment=`uniform float uTime;uniform vec3 uColor;uniform float uOpacity;uniform vec2 uDrift;varying vec2 vUv;varying float vDepth;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec2 p=vUv*2.-1.;float edge=pow(max(0.,1.-dot(p,p)),2.);vec2 st=vUv*vec2(5.2,2.7)-uTime*uDrift;float n=noise(st)*.64+noise(st*2.1+12.4)*.25+noise(st*4.3)*.11;float fog=smoothstep(.21,.8,n);float nearFade=smoothstep(1.2,4.5,vDepth);gl_FragColor=vec4(uColor,edge*fog*uOpacity*nearFade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
 for(const [name,f,side,w,h,y,color,opacity,dx,dy] of [
  ['root-understory',.074,-8,18,3.1,1.6,'#9db4a4',.15,.012,.002],
  ['root-distance',.13,8,23,4.2,2.0,'#acbbae',.17,-.009,.001],
  ['marsh-waterline',.245,14,22,1.5,.5,'#d4dfd8',.19,.018,.001],
  ['marsh-farshore',.29,18,25,2.3,.7,'#d3ded6',.13,-.012,.001],
  ['stone-cool-gap',.465,-20,13,3,1.5,'#a5b8bc',.13,.025,.005],
  ['bay-low-mist',.85,15,25,1.5,.65,'#789ba8',.19,.012,0],
  ['bay-horizon',.93,23,30,2.8,1.1,'#91a9b6',.16,.006,0]
 ]){
  const g=new T.PlaneGeometry(w,h);geometries.push(g);const m=new T.ShaderMaterial({uniforms:{uTime:time,uColor:{value:new T.Color(color)},uOpacity:{value:opacity},uDrift:{value:new T.Vector2(dx,dy)}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,forceSinglePass:true});materials.push(m);
  const o=new T.Mesh(g,m),p=at(f,side);p.y=Math.max(-.2,forest.sampleGround(p.x,p.z))+y;o.position.copy(p);o.name=name;group.add(o);cells.push({object:o,f,p,billboard:true});
 }
 // Small pollen drifts in different directions around gaps. The rock corridor
 // carries a sparse downward mineral dust, never snow or a magical blizzard.
 for(const [name,f,side,count,color,velocity] of [
  ['root-seed-drift',.10,0,48,'#d6cfad',[.14,-.028,.05]],
  ['marsh-airborne-seeds',.255,7,40,'#e3e1c6',[.28,-.012,.06]],
  ['scarp-fine-dust',.425,-11,42,'#b9c0b5',[.32,-.10,.035]],
  ['hamlet-warm-dust',.65,3,34,'#ddbd87',[.045,.018,.03]]
 ]){
  const centre=at(f,side),p=[],phase=[];for(let i=0;i<count;i++){p.push(r(-10,10),r(.4,5),r(-12,12));phase.push(r(0,1),r(.55,1.3));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('aPhase',new T.Float32BufferAttribute(phase,2));geometries.push(g);
  const m=new T.ShaderMaterial({uniforms:{uTime:time,uVelocity:{value:new T.Vector3(...velocity)},uColor:{value:new T.Color(color)}},vertexShader:`uniform float uTime;uniform vec3 uVelocity;attribute vec2 aPhase;varying float vAlpha;void main(){vec3 p=position;p=mod(p+uVelocity*uTime+vec3(10.,0.,12.),vec3(20.,5.5,24.))-vec3(10.,0.,12.);p.x+=sin(uTime*.31+aPhase.x*31.)*.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(32.*aPhase.y/max(1.,-mv.z),.8,3.2);vAlpha=smoothstep(1.,4.,-mv.z)*(.2+.35*aPhase.x);}`,fragmentShader:`uniform vec3 uColor;varying float vAlpha;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),1.7);gl_FragColor=vec4(uColor,vAlpha*a);}`,transparent:true,depthWrite:false});materials.push(m);const o=new T.Points(g,m);o.name=name;o.position.copy(centre);o.position.y=Math.max(0,forest.sampleGround(centre.x,centre.z));group.add(o);cells.push({object:o,f,p:centre,count});
 }
 let disposed=false,quality='high';
 function update(dt,t,{position,camera,quality:q='high',reduced=false}={}){if(disposed)return;quality=q;if(!reduced&&dt>0)time.value+=Math.min(dt,.1);const p=position||camera?.position;if(!p)return;const f=forest.project(p).distance/forest.length;for(const c of cells){const distance=Math.min(c.p.distanceTo(p),camera?c.p.distanceTo(camera.position):Infinity);c.object.visible=distance<(q==='low'?30:54)&&Math.abs(f-c.f)<.16;if(c.billboard&&camera)c.object.quaternion.copy(camera.quaternion);if(c.count)c.object.geometry.setDrawRange(0,q==='low'?Math.ceil(c.count*.45):c.count);if(c.billboard&&q==='low')c.object.visible=false;}}
 return {group,update,stats:()=>({quality,activeDraws:cells.filter(c=>c.object.visible).length,particleCount:cells.filter(c=>c.count&&c.object.visible).reduce((n,c)=>n+(quality==='low'?Math.ceil(c.count*.45):c.count),0),time:time.value}),dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
