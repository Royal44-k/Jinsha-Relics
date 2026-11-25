import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,PerspectiveCamera,Vector2,Color,WebGLRenderTarget,HalfFloatType,ACESFilmicToneMapping,SRGBColorSpace} from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {createContactPass,createFocusPass,createFilmPass,createEdgePass} from '../src/v4/cinematic.js';
import {immersionShader} from '../src/v3/traversal-effects.js';
import {collectPostprocessPrograms,warmPostprocessing} from '../src/v9/postprocess-warmup.js';

function fixture(){
 const scene=new Scene(),camera=new PerspectiveCamera(48,1,.08,150),a=new WebGLRenderTarget(32,32,{type:HalfFloatType}),b=a.clone();
 const composer={renderTarget1:a,renderTarget2:b,readBuffer:b,writeBuffer:a,renderToScreen:true};
 const savedWidth=globalThis.innerWidth,savedHeight=globalThis.innerHeight;globalThis.innerWidth=globalThis.innerHeight=32;
 const ao=createContactPass(scene,camera,composer);globalThis.innerWidth=savedWidth;globalThis.innerHeight=savedHeight;
 const focus=createFocusPass(camera,ao),bloom=new UnrealBloomPass(new Vector2(32,32)),immersion=new ShaderPass(immersionShader),output=new OutputPass(),film=createFilmPass(),edge=createEdgePass();
 focus.enabled=immersion.enabled=false;composer.passes=[new RenderPass(scene,camera),ao,focus,bloom,immersion,output,film,edge];
 const originalTarget=new WebGLRenderTarget(7,9),calls=[],changes=[],clearColor=new Color('#345678');let target=originalTarget;
 const renderer={autoClear:true,toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.02,outputColorSpace:SRGBColorSpace,
  getRenderTarget:()=>target,setRenderTarget:(value,face=0,mip=0)=>{target=value;changes.push({value,face,mip});},getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,
  getClearColor:out=>out.copy(clearColor),getClearAlpha:()=>.7,render:()=>{throw Error('No real draw belongs in asynchronous compilation');},
  compileAsync:(object,camera)=>{calls.push({material:object.material,target,camera});return Promise.resolve();},extensions:{has:()=>true}};
 return {renderer,composer,ao,focus,bloom,immersion,output,film,edge,originalTarget,calls,changes,
  dispose(){composer.passes.forEach(p=>p.dispose());a.depthTexture?.dispose();b.depthTexture?.dispose();a.dispose();b.dispose();originalTarget.dispose();}};
}
test('recording actual passes captures depth setup, output defines, bloom levels and private focus copy without a draw',()=>{
 const f=fixture(),flags=f.composer.passes.map(p=>({enabled:p.enabled,screen:p.renderToScreen}));
 try{const jobs=collectPostprocessPrograms(f.renderer,f.composer,{optionalPasses:[f.focus,f.immersion]});
  assert.equal(jobs.length,18);assert.ok(jobs.some(j=>j.material.fragmentShader.includes('packDepthToRGBA')));
  assert.ok(jobs.some(j=>j.material===f.focus.material));assert.ok(jobs.some(j=>j.material===f.immersion.material));
  assert.ok(f.bloom.separableBlurMaterials.every(m=>jobs.filter(j=>j.material===m).length===1));
  assert.equal(f.ao.gtaoMaterial.defines.NORMAL_VECTOR_TYPE,0);assert.equal(f.ao.pdMaterial.defines.NORMAL_VECTOR_TYPE,0);
  assert.ok(Object.hasOwn(f.output.material.defines,'SRGB_TRANSFER'));assert.ok(Object.hasOwn(f.output.material.defines,'ACES_FILMIC_TONE_MAPPING'));
  assert.equal(jobs.find(j=>j.material===f.edge.material).target,null);assert.notEqual(jobs.find(j=>j.material===f.film.material).target,null);
  assert.equal(f.changes.length,0);assert.deepEqual(f.composer.passes.map(p=>({enabled:p.enabled,screen:p.renderToScreen})),flags);
 }finally{f.dispose();}
});
test('asynchronous compilation yields loading frames, uses equivalent targets and restores renderer state',async()=>{
 const f=fixture(),progress=[];let yields=0;
 try{const result=await warmPostprocessing(f.renderer,f.composer,{optionalPasses:[f.focus,f.immersion],yieldFrame:async()=>{yields++;},onProgress:p=>progress.push(p)});
  assert.equal(result.programs,18);assert.equal(result.parallelCompile,true);assert.equal(yields,18);assert.equal(progress.length,18);
  assert.equal(f.calls.find(c=>c.material===f.edge.material).target,null);assert.notEqual(f.calls.find(c=>c.material===f.focus.material).target,null);
  assert.equal(f.renderer.getRenderTarget(),f.originalTarget);assert.deepEqual(f.changes.at(-1),{value:f.originalTarget,face:2,mip:1});
  assert.equal(f.renderer.autoClear,true);assert.equal(f.renderer.getClearAlpha(),.7);
 }finally{f.dispose();}
});
test('disabled expensive passes are skipped unless deliberately selected and failures restore the target',async()=>{
 const f=fixture();f.ao.enabled=false;
 try{const jobs=collectPostprocessPrograms(f.renderer,f.composer,{optionalPasses:[f.immersion]});assert.ok(!jobs.some(j=>j.material===f.focus.material||j.material===f.ao.gtaoMaterial));assert.ok(jobs.some(j=>j.material===f.immersion.material));
  f.renderer.compileAsync=()=>Promise.reject(Error('shader not ready'));
  await assert.rejects(warmPostprocessing(f.renderer,f.composer,{yieldFrame:async()=>{}}),/shader not ready/);
  assert.equal(f.renderer.getRenderTarget(),f.originalTarget);
 }finally{f.dispose();}
});
test('one material reused offscreen and on screen finishes each compile before currentProgram can change',async()=>{
 const f=fixture(),material=f.film.material;f.composer.passes=[new ShaderPass(material),new ShaderPass(material)];let active=false,count=0;
 f.renderer.compileAsync=()=>{assert.equal(active,false,'the preceding variant must finish before replacing currentProgram');active=true;count++;return new Promise(resolve=>setTimeout(()=>{active=false;resolve();},1));};
 try{const result=await warmPostprocessing(f.renderer,f.composer,{yieldFrame:async()=>{}});assert.equal(result.programs,2);assert.equal(count,2);assert.equal(f.renderer.getRenderTarget(),f.originalTarget);}finally{f.dispose();}
});
