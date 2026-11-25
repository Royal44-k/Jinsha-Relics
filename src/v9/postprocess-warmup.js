import {Color,Mesh} from 'three';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';

const nextFrame=()=>new Promise(resolve=>{
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(resolve);
 else setTimeout(resolve,0);
});

/** Record the real fullscreen paths without submitting a draw. This runs each
 * pass's own setup: OutputPass defines, depth-derived GTAO and private focus
 * depth packing all need to match the first actual composer render. */
export function collectPostprocessPrograms(renderer,composer,{optionalPasses=[]}={}){
 const selected=composer.passes.filter(pass=>pass.enabled||optionalPasses.includes(pass));
 const facade=Object.create(renderer),programs=[],seen=new Map();
 const clearColor=renderer.getClearColor(new Color());let clearAlpha=renderer.getClearAlpha();
 let target=renderer.getRenderTarget(),owner=null;
 facade.getRenderTarget=()=>target;
 facade.setRenderTarget=value=>{target=value;};
 facade.getClearColor=out=>out.copy(clearColor);
 facade.getClearAlpha=()=>clearAlpha;
 facade.setClearColor=(value,alpha)=>{clearColor.set(value);if(alpha!==undefined)clearAlpha=alpha;};
 facade.setClearAlpha=alpha=>{clearAlpha=alpha;};
 facade.clear=()=>{};
 facade.render=(object,camera)=>{
  if(!object.isMesh||!object.geometry||Array.isArray(object.material))throw new Error('Postprocess warmup requires a fullscreen mesh.');
  // WebGLPrograms selects output transfer/tone mapping from screen vs target,
  // not target dimensions/type. Two blur directions use the same program.
  const variant=target===null?'screen':target.isXRRenderTarget?'xr:'+target.texture.colorSpace:'offscreen';
  const material=object.material,variants=seen.get(material)||new Set();
  if(variants.has(variant))return;
  variants.add(variant);seen.set(material,variants);
  programs.push({material,camera,target,geometry:object.geometry,pass:owner,variant});
 };
 let read=composer.readBuffer,write=composer.writeBuffer;
 for(let i=0;i<selected.length;i++){
  const pass=selected[i];
  // The scene is compiled separately with its actual lights and geometry.
  if(pass instanceof RenderPass)continue;
  const previousScreen=pass.renderToScreen,previousQuad=pass._fsQuad?.material;
  try{
   owner=pass;pass.renderToScreen=!!composer.renderToScreen&&i===selected.length-1;
   pass.render(facade,write,read,0,false);
  }finally{
   pass.renderToScreen=previousScreen;
   if(pass._fsQuad)pass._fsQuad.material=previousQuad;
  }
  if(pass.needsSwap){const previous=read;read=write;write=previous;}
 }
 return programs;
}

/** Call during boot, before the animation loop draws with this renderer.
 * Compilation is submitted against the same target class as the real pass,
 * while a frame between submissions keeps the loading artwork responsive.
 * GPU linking remains asynchronous when KHR_parallel_shader_compile exists.
 * This does not draw, upload every texture or promise zero first-frame cost. */
export async function warmPostprocessing(renderer,composer,{optionalPasses=[],onProgress=()=>{},yieldFrame=nextFrame}={}){
 const started=performance.now(),programs=collectPostprocessPrograms(renderer,composer,{optionalPasses});
 const originalTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0;
 const pending=[],materialTasks=new Map();let complete=0,failure=null;
 const restore=()=>renderer.setRenderTarget(originalTarget,face,mip);
 try{
  for(const program of programs){
   // compileAsync polls material.currentProgram. If a caller reuses one
   // material on screen and offscreen, finish the first variant before the
   // second can replace that pointer.
   if(materialTasks.has(program.material))await materialTasks.get(program.material);
   const mesh=new Mesh(program.geometry,program.material);let task;
   try{renderer.setRenderTarget(program.target);task=renderer.compileAsync(mesh,program.camera);}finally{restore();}
   // Attach failure handlers immediately, before yielding a frame. An early
   // shader error must not become an unhandled rejection during submission.
   const completion=Promise.resolve(task).then(()=>{complete++;try{onProgress({complete,total:programs.length,material:program.material.name||program.material.type});}catch(error){failure??=error;}},error=>{failure??=error;});
   pending.push(completion);materialTasks.set(program.material,completion);
   await yieldFrame();
  }
 }catch(error){failure??=error;}finally{restore();}
 await Promise.all(pending);
 if(failure)throw failure;
 return {programs:programs.length,elapsedMs:performance.now()-started,parallelCompile:!!renderer.extensions?.has('KHR_parallel_shader_compile')};
}
