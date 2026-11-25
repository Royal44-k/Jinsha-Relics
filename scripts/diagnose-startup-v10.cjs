// Read-only startup diagnosis. Native Edge, no screenshots and no progress injection.
// node scripts/diagnose-startup-v10.cjs --condition baseline --label baseline --trace
// Conditions: baseline | no-scans | no-hdr | no-opening-bird | no-hud |
//             no-focus | no-hud-shadows | no-overlay-gradient
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const argv=process.argv.slice(2),get=(name,fallback)=>{const i=argv.indexOf('--'+name);return i<0?fallback:argv[i+1];};
const condition=get('condition','baseline'),label=get('label',condition),url=get('url','http://127.0.0.1:5188'),seconds=Number(get('seconds','5'));
const traceEnabled=argv.includes('--trace'),hookGL=!argv.includes('--no-gl-hooks');
if(!['baseline','no-scans','no-hdr','no-opening-bird','no-hud','no-focus','no-hud-shadows','no-overlay-gradient'].includes(condition)||!/^[a-z0-9-]+$/.test(label))throw Error('Invalid diagnostic condition or output label');
const out=path.resolve('docs/v10/campaign/startup-diagnosis');fs.mkdirSync(out,{recursive:true});
function summarize(frames){const s=frames.map(f=>f.duration).sort((a,b)=>a-b);return {samples:s.length,medianMs:s[Math.floor(s.length*.5)]??null,p95Ms:s[Math.floor(s.length*.95)]??null,maxMs:s.at(-1)??null,above40ms:frames.filter(f=>f.duration>40)};}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(condition==='no-scans')await page.route(/(fern_02\.gltf|tree-root-lod\.gltf)/,r=>{blocked.push(r.request().url());return r.abort();});
 if(condition==='no-hdr')await page.route('**/forest-light-512.hdr',r=>{blocked.push(r.request().url());return r.abort();});
 if(condition==='no-opening-bird')await page.route('**/intro-s.ogg',r=>{blocked.push(r.request().url());return r.abort();});
 await page.addInitScript(({condition,hookGL})=>{
  const d=window.__diag={frames:[],events:[],longtasks:[],loaf:[],gl:[],resources:[]};performance.setResourceTimingBufferSize(2000);
  for(const [type,key]of [['longtask','longtasks'],['long-animation-frame','loaf'],['resource','resources']])try{new PerformanceObserver(list=>{for(const e of list.getEntries())d[key].push(e.toJSON());}).observe({type,buffered:true});}catch{}
  if(hookGL)for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){const p=window[name]?.prototype;if(!p)continue;for(const method of ['getProgramParameter','getShaderParameter','getUniformLocation','getAttribLocation','getActiveUniform','getActiveAttrib','getShaderInfoLog','bufferData','useProgram','compileShader','linkProgram','texImage2D','texStorage2D','texSubImage2D','generateMipmap','drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','finish','flush','readPixels']){const orig=p[method];if(!orig)continue;p[method]=function(...args){const t=performance.now(),v=orig.apply(this,args),dur=performance.now()-t;if(dur>2)d.gl.push({method,start:t,duration:dur,mode:document.body?.dataset.mode});return v;};}}
  if(condition==='no-opening-bird'&&globalThis.speechSynthesis){const original=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=function(u){if(u.text==='那道浅色的线，昨天还藏在水底。我们去近处看看。'){d.events.push({type:'blocked-opening-bird-fallback',time:performance.now()});queueMicrotask(()=>u.onend?.());return;}return original(u);};}
  const nativeAnimate=Element.prototype.animate;
  if(nativeAnimate)Element.prototype.animate=function(...a){const anim=nativeAnimate.apply(this,a);if(this.id==='embark'){d.events.push({type:'reveal-start',time:performance.now(),options:a[1]});anim.finished.then(()=>d.events.push({type:'reveal-finished',time:performance.now()}),()=>{});}return anim;};
  document.addEventListener('DOMContentLoaded',()=>{
   const styles={
    'no-hud':'#overlay{visibility:hidden!important}#world-view canvas:focus,#world-view canvas:focus-visible{outline:none!important;box-shadow:none!important}',
    'no-focus':'#world-view canvas:focus,#world-view canvas:focus-visible{outline:none!important;box-shadow:none!important}',
    'no-hud-shadows':'#overlay,#overlay *{text-shadow:none!important;box-shadow:none!important}',
    'no-overlay-gradient':'#overlay:before{display:none!important}'
   };
   if(styles[condition]){const css=document.createElement('style');css.textContent=styles[condition];document.head.append(css);d.events.push({type:'diagnostic-style',condition,css:styles[condition],time:performance.now()});}
   new MutationObserver(()=>{const mode=document.body.dataset.mode;if(mode!==d.lastMode){d.lastMode=mode;d.events.push({type:'mode',mode,time:performance.now()});}}).observe(document.body,{attributes:true,attributeFilter:['data-mode']});
  });
  let last=0;function frame(t){const sheet=document.getElementById('embark');if(last)d.frames.push({start:last,end:t,duration:t-last,mode:document.body?.dataset.mode,coverHidden:document.getElementById('cover')?.hidden,embarkHidden:sheet?.hidden,embarkOpacity:sheet&&!sheet.hidden?getComputedStyle(sheet).opacity:null});last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  addEventListener('click',e=>d.events.push({type:'click',label:e.target?.textContent?.slice(0,50),time:performance.now()}),true);
 },{condition,hookGL});
 const cd=traceEnabled?await page.context().newCDPSession(page):null;
 if(cd)await cd.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack',transferMode:'ReturnAsStream'});
 await page.goto(url);await page.locator('#enter').click();await page.getByRole('button',{name:'落到探方边'}).click();await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:120000});const started=await page.evaluate(()=>performance.now());await page.waitForTimeout(seconds*1000);
 const report=await page.evaluate(()=>{const c=document.querySelector('#world-view canvas'),gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {...window.__diag,gpu:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),framebuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],snapshot:window.__JINSHA_SURVEY__.snapshot()};});
 const reveal=report.events.find(e=>e.type==='reveal-start'),finish=report.events.find(e=>e.type==='reveal-finished'),handoff=report.events.find(e=>e.type==='mode'&&e.mode==='travel');
 Object.assign(report,{condition,label,url,traceEnabled,hookGL,started,seconds,errors,blocked,summary:{reveal:reveal&&finish?summarize(report.frames.filter(f=>f.end>=reveal.time&&f.end<finish.time)):null,afterHandoff:summarize(report.frames.filter(f=>f.start>=(handoff?.time??started))),handoff,revealStart:reveal,revealFinish:finish}});
 fs.writeFileSync(path.join(out,label+(traceEnabled?'':'-notrace')+'.json'),JSON.stringify(report,null,2));
 if(cd){const done=new Promise(r=>cd.once('Tracing.tracingComplete',r));await cd.send('Tracing.end');const {stream}=await done;let trace='';while(true){const c=await cd.send('IO.read',{handle:stream});trace+=c.data;if(c.eof)break;}await cd.send('IO.close',{handle:stream});fs.writeFileSync(path.join(out,label+'-trace.json'),trace);}
 console.log(JSON.stringify({condition,label,gpu:report.gpu,summary:report.summary,glAfterHandoff:report.gl.filter(x=>x.start>=(handoff?.time??started)),blocked,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
