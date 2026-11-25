import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createReflectionClock} from '../v7/reflection-clock.js';
// Keep one reflector, but bound eight river quads at a time. A single sphere
// encloses most of the valley and cannot reject a camera looking away from it.
export function createRiverVisibility(geometry){
 const positions=geometry.attributes.position,index=geometry.index,bounds=[],point=new T.Vector3();
 const count=index?index.count:positions.count;
 for(let start=0;start<count;start+=48){
  const box=new T.Box3();
  for(let i=start;i<Math.min(start+48,count);i++)box.expandByPoint(point.fromBufferAttribute(positions,index?index.getX(i):i));
  bounds.push(box.expandByScalar(.15));
 }
 const projection=new T.Matrix4(),frustum=new T.Frustum();
 return {segments:bounds.length,intersects(camera,matrixWorld){
  // Test in the water's local space, using the final camera supplied by the
  // renderer. This also handles photo cameras and transformed parent groups.
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(matrixWorld);
  frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  return bounds.some(box=>frustum.intersectsBox(box));
 }};
}
// One clipped, 384 px planar reflection. The original shaded river is the
// low-quality and underwater fallback; both use the exact same curved shore.
export function createRiverReflection({scene,forest}){
 const original=forest.group.getObjectByName('Reflective winding river');if(!original)return {update(){},dispose(){},stats:()=>({enabled:false})};
 const g=original.geometry.clone(),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i),-p.getZ(i),0);g.computeVertexNormals();g.computeBoundingSphere();
 const shader={name:'Living river reflection',uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{color:{value:new T.Color()},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},uTime:{value:0},uDeep:{value:new T.Color('#133b36')},uSky:{value:new T.Color('#8ca8a1')},uSunDirection:{value:new T.Vector3(-.5,1,-.4).normalize()},uSunColor:{value:new T.Color('#eacb93')}}]),
 vertexShader:`uniform mat4 textureMatrix;varying vec4 vMirrorUv;varying vec3 vWorld;varying vec2 vShoreUv;
 #include <fog_pars_vertex>
 void main(){vShoreUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;vMirrorUv=textureMatrix*vec4(position,1.);vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform vec3 uDeep;uniform vec3 uSky;uniform vec3 uSunDirection;uniform vec3 uSunColor;varying vec4 vMirrorUv;varying vec3 vWorld;varying vec2 vShoreUv;
 #include <fog_pars_fragment>
 void main(){float a=sin(vWorld.x*1.31+vWorld.z*1.05+uTime*.60),b=sin(vWorld.x*3.8-vWorld.z*2.25-uTime*.92),c=cos(vWorld.z*5.1+vWorld.x*.7+uTime*1.1);
 vec3 n=normalize(vec3(a*.045+b*.021,1.,c*.025+b*.016));vec3 view=normalize(cameraPosition-vWorld);float facing=max(dot(n,view),0.);float fres=.10+.80*pow(1.-facing,3.8);
 vec4 uv=vMirrorUv;uv.xy+=n.xz*.065*uv.w;vec3 reflected=texture2DProj(tDiffuse,uv).rgb;
 float shimmer=pow(max(0.,dot(reflect(-uSunDirection,n),view)),170.);float fine=pow(max(0.,a*b),8.);
 vec3 water=mix(uDeep*.64,uSky*.48,.22)+vec3(.12,.15,.08)*fine*.17;vec3 col=mix(water,reflected,clamp(fres,.18,.88));col+=uSunColor*shimmer*.45;
 float shore=smoothstep(0.,.075,vShoreUv.x)*smoothstep(0.,.075,1.-vShoreUv.x);gl_FragColor=vec4(col,.97*shore);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`};
 const water=new Reflector(g,{textureWidth:384,textureHeight:384,clipBias:.003,multisample:0,shader});water.name='V6 · live planar river reflection';water.rotation.x=-Math.PI/2;water.position.y=-.198;water.material.transparent=true;water.material.side=T.DoubleSide;water.material.depthWrite=false;water.material.fog=true;water.renderOrder=1;water.frustumCulled=false;scene.add(water);
 for(const key of ['uTime','uDeep','uSky'])water.material.uniforms[key]=original.material.uniforms[key];
 const visibility=createRiverVisibility(g),clock=createReflectionClock();
 let enabled=false,inView=false,frames=0,skippedFrames=0,cachedFrames=0,lastCost=0,totalReflectionCalls=0,reflectionTime=0;const native=water.onBeforeRender;
 water.onBeforeRender=function(renderer,s,camera){
  if(!enabled)return;
  inView=visibility.intersects(camera,water.matrixWorld);
  // Keep the same water material visible; only avoid the scene render when
  // every river segment is outside the view. Re-entry updates before drawing.
  if(!inView){clock.invalidate();skippedFrames++;lastCost=0;totalReflectionCalls=0;return;}
  // Only a completely stable camera can reuse its texture/projection. Motion,
  // zoom and re-entry refresh before this water surface is drawn; its animated
  // shader remains active on the frames where the nested scene render is held.
  if(!clock.shouldRender({time:reflectionTime,world:camera.matrixWorld.elements,projection:camera.projectionMatrix.elements})){cachedFrames++;lastCost=0;totalReflectionCalls=0;return;}
  const before=renderer.info.render.calls,auto=renderer.info.autoReset,worldAuto=s.matrixWorldAutoUpdate;renderer.info.autoReset=false;const t=performance.now();
  // onBeforeRender is entered after the parent render evaluated world matrices.
  // The reflection changes only visibility and its own camera; re-evaluating the
  // entire hierarchy here duplicates that work. Warmup remains a full update.
  s.matrixWorldAutoUpdate=false;
  try{native.call(water,renderer,s,camera);}finally{s.matrixWorldAutoUpdate=worldAuto;lastCost=performance.now()-t;totalReflectionCalls=renderer.info.render.calls-before;renderer.info.autoReset=auto;frames++;}
 };
 function update(dt,time,{position,camera,quality='high'}={}){reflectionTime=time;const f=forest.project(position).distance/forest.length;enabled=quality!=='low'&&f>.12&&f<.985&&camera?.position.y>-.05;if(!enabled){clock.invalidate();inView=false;lastCost=0;totalReflectionCalls=0;}water.visible=enabled;original.visible=!enabled;const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow);if(sun){water.material.uniforms.uSunDirection.value.copy(sun.position).sub(sun.target.position).normalize();water.material.uniforms.uSunColor.value.copy(sun.color).multiplyScalar(.65);}}
 function dispose(){water.removeFromParent();water.dispose();g.dispose();original.visible=true;}
 async function warmup(renderer,camera){
  const target=renderer.getRenderTarget(),wasVisible=water.visible,wasOriginal=original.visible;
  try{original.visible=false;water.forceUpdate=true;native.call(water,renderer,scene,camera);}
  finally{clock.invalidate();renderer.setRenderTarget(target);water.visible=wasVisible;original.visible=wasOriginal;}
 }
 return {update,dispose,warmup,water,stats:()=>({enabled,inView,resolution:384,frames,skippedFrames,cachedFrames,boundSegments:visibility.segments,cpuSubmitMs:lastCost,reflectionCalls:totalReflectionCalls})};
}
