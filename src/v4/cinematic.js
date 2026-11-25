import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {BokehShader} from 'three/addons/shaders/BokehShader.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {withDepthAwareGather} from '../v9/focus-shader.js';

// Lighting radiance only: the playable world remains actual geometry.
export async function loadForestLighting(renderer,scene){
 const hdr=await new HDRLoader().loadAsync('/assets/environment/forest-light-512.hdr');
 hdr.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(hdr);
 const previous=scene.environment;scene.environment=target.texture;scene.environmentIntensity=.58;scene.environmentRotation.y=.72;
 hdr.dispose();pmrem.dispose();previous?.dispose();return target;
}

// Reuse the visible scene's depth. Alpha-tested foliage and skinning have already
// been evaluated, avoiding an extra full scene draw and solid leaf silhouettes.
export function createContactPass(scene,camera,composer){
 for(const target of [composer.renderTarget1,composer.renderTarget2]){
  target.depthTexture=new THREE.DepthTexture(target.width,target.height,THREE.UnsignedIntType);
  target.depthTexture.format=THREE.DepthFormat;
 }
 const ao=new GTAOPass(scene,camera,Math.max(1,innerWidth>>1),Math.max(1,innerHeight>>1));
 ao.updateGtaoMaterial({radius:.48,thickness:.65,distanceExponent:1.2,distanceFallOff:.9,samples:8});
 ao.updatePdMaterial({lumaPhi:5,depthPhi:2,normalPhi:3,radius:4,samples:8});ao.blendIntensity=.42;
 const nativeRender=ao.render.bind(ao),nativeSize=ao.setSize.bind(ao);
 ao.setSize=(w,h)=>nativeSize(Math.max(1,Math.round(w*.6)),Math.max(1,Math.round(h*.6)));
 ao.render=(renderer,write,read,dt,mask)=>{ao.setGBuffer(read.depthTexture);nativeRender(renderer,write,read,dt,mask);};
 return ao;
}

export function createFilmPass(){
 return new ShaderPass({
  uniforms:{tDiffuse:{value:null},warmth:{value:.045},contrast:{value:.045},vignette:{value:.16}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float warmth;uniform float contrast;uniform float vignette;varying vec2 vUv;
   void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
   c=mix(vec3(l),c,1.025);c+=(c-.5)*contrast*(1.-abs(c-.5)*1.25);
   float lights=smoothstep(.22,.86,l),shadows=1.-smoothstep(.07,.45,l);
   c+=vec3(.11,.037,-.06)*warmth*lights;c+=vec3(-.006,.004,.006)*shadows;
   vec2 p=vUv-.5;float fall=smoothstep(.18,.72,length(p*vec2(1.,.88)));c*=1.-fall*vignette;
   gl_FragColor=vec4(clamp(c,0.,1.),1.);}`
 });
}

// Use the same alpha-tested, skinned depth as contact shadows. A separate
// override-depth render would treat cutout leaves as solid rectangular cards.
export function createFocusPass(camera,contact){
 const pass=new ShaderPass(BokehShader,'tColor');
 pass.material.fragmentShader=withDepthAwareGather(BokehShader.fragmentShader);
 // AO swaps composer buffers. The next write buffer still owns scene depth;
 // sampling that attached depth while drawing into it is a WebGL feedback loop.
 // A small fullscreen copy packs its full precision into an independent target.
 const depth=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false});
 const copy=new THREE.ShaderMaterial({uniforms:{tDepth:{value:null}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D tDepth;varying vec2 vUv;\n#include <packing>\nvoid main(){gl_FragColor=packDepthToRGBA(texture2D(tDepth,vUv).x);}'});
 const quad=new FullScreenQuad(copy);
 pass.uniforms.focus.value=3;pass.uniforms.aperture.value=.0002;pass.uniforms.maxblur.value=.009;
 const render=pass.render.bind(pass),dispose=pass.dispose.bind(pass);
 pass.setSize=(w,h)=>{pass.uniforms.aspect.value=w/h;depth.setSize(w,h);};
 pass.render=(renderer,write,read,dt,mask)=>{
  copy.uniforms.tDepth.value=contact.depthTexture;renderer.setRenderTarget(depth);quad.render(renderer);
  pass.uniforms.tDepth.value=depth.texture;
  pass.uniforms.nearClip.value=camera.near;pass.uniforms.farClip.value=camera.far;
  render(renderer,write,read,dt,mask);
 };
 pass.dispose=()=>{depth.dispose();copy.dispose();quad.dispose();dispose();};
 return pass;
}

export function createEdgePass(){return new ShaderPass(FXAAShader);}
