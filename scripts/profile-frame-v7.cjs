const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='docs/v7/frame-profile';fs.mkdirSync(OUT,{recursive:true});
function replaceOnce(source,anchor,replacement,label){const count=source.split(anchor).length-1;if(count!==1)throw Error(`${label}: expected one injection anchor, found ${count}`);return source.replace(anchor,replacement);}
function instrumentMain(source){
 source=replaceOnce(source,"const $ = id => document.getElementById(id);",`const __v7FrameProfile={active:false,frames:[],cameraMs:0,cameraCalls:0,clearanceMs:0,clearanceCalls:0};
window.__V7_FRAME_PROFILE__={start(){__v7FrameProfile.frames=[];__v7FrameProfile.active=true;},stop(){__v7FrameProfile.active=false;return __v7FrameProfile.frames;}};
const $ = id => document.getElementById(id);`,'main profiler state');
 source=replaceOnce(source,'function cameraPosition(dt=1/60,snap=false){',`function cameraPosition(dt=1/60,snap=false){const started=performance.now();try{return __v7OriginalCameraPosition(dt,snap);}finally{__v7FrameProfile.cameraMs+=performance.now()-started;__v7FrameProfile.cameraCalls++;}}
function __v7OriginalCameraPosition(dt=1/60,snap=false){`,'camera timer');
 source=replaceOnce(source,'const cameraResponse=createCameraResponse(),cameraClearance=createCameraClearance(),cameraObstacles=[];',`const cameraResponse=createCameraResponse(),cameraClearance=createCameraClearance(),cameraObstacles=[];
const __v7OriginalConstrain=cameraClearance.constrain;
cameraClearance.constrain=function(camera,target,colliders,position){const started=performance.now();try{return __v7OriginalConstrain(camera,target,colliders,position);}finally{__v7FrameProfile.clearanceMs+=performance.now()-started;__v7FrameProfile.clearanceCalls++;}};`,'final camera clearance timer');
 source=replaceOnce(source,'function tick(now){\n',`function tick(now){
 const __v7FrameStart=performance.now();__v7FrameProfile.cameraMs=0;__v7FrameProfile.cameraCalls=0;__v7FrameProfile.clearanceMs=0;__v7FrameProfile.clearanceCalls=0;
`,'tick timer');
 source=replaceOnce(source,'renderer.info.reset();composer.render();',`const __v7RenderStart=performance.now();renderer.info.reset();composer.render();const __v7RenderEnd=performance.now();
 if(__v7FrameProfile.active){const reflection=chapterWorld.__v7ReflectionProfile();__v7FrameProfile.frames.push({rafTimestamp:now,startedAt:__v7FrameStart,frameDeltaMs:raw*1000,logicMs:__v7RenderStart-__v7FrameStart,cameraMs:__v7FrameProfile.cameraMs,cameraCalls:__v7FrameProfile.cameraCalls,clearanceMs:__v7FrameProfile.clearanceMs,clearanceCalls:__v7FrameProfile.clearanceCalls,otherLogicMs:__v7RenderStart-__v7FrameStart-__v7FrameProfile.cameraMs-__v7FrameProfile.clearanceMs,composerMs:__v7RenderEnd-__v7RenderStart,tickMs:__v7RenderEnd-__v7FrameStart,reflectionCpuSubmitMs:reflection.cpuSubmitMs,reflectionCalls:reflection.reflectionCalls,reflectionEnabled:reflection.enabled,reflectionInView:reflection.inView,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,mode:motion.state.mode});}`,'render/frame record');
 return source;
}
function instrumentChapter(source){return replaceOnce(source,'return {group,ready,update,lighting,dispose,stats,','return {group,ready,update,lighting,dispose,stats,__v7ReflectionProfile:()=>reflection.stats(),','cheap reflection stats');}
function summaries(frames){const out={};for(const key of ['frameDeltaMs','logicMs','cameraMs','clearanceMs','otherLogicMs','composerMs','tickMs','reflectionCpuSubmitMs']){const a=frames.map(v=>v[key]).sort((a,b)=>a-b),q=p=>a[Math.floor((a.length-1)*p)];out[key]={median:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)};}return out;}
(async()=>{
 // Validate against disk before launching: never silently benchmark an uninstrumented build.
 instrumentMain(fs.readFileSync('src/v2/main.js','utf8').replaceAll('\r\n','\n'));
 instrumentChapter(fs.readFileSync('src/v5/chapter-world.js','utf8').replaceAll('\r\n','\n'));
 const report={at:new Date().toISOString(),viewport:[1440,900],method:'One Edge page, no parallel 3D contexts. Developer positioning only; each matched zone settles 3 seconds and records 10 seconds. Response-only timing instrumentation leaves production files unchanged. cameraMs times the original desired cameraPosition function; clearanceMs separately times all final cameraClearance.constrain calls. Both are included in logicMs, and otherLogicMs subtracts both. Reflection CPU submit time is included in composerMs. No gl.finish/readPixels/GPU query is added. frameDeltaMs precedes the current row, so compare long gaps to the prior row too. Reflection stats use a test-only direct accessor to avoid chapter.stats full-scene traversal. Timings are CPU wall durations, not GPU execution time.',errors:[],injectionErrors:[],zones:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await cdp.send('Performance.enable');let rejectInjection;const injectionFailure=new Promise((_,reject)=>{rejectInjection=reject;});
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('case "update":','case "profile-disabled-update":').replace('case "full-reload":','case "profile-disabled-reload":')});});
  for(const [pattern,transform]of [['**/src/v2/main.js*',instrumentMain],['**/src/v5/chapter-world.js*',instrumentChapter]])await page.route(pattern,async route=>{try{const response=await route.fetch(),body=transform((await response.text()).replaceAll('\r\n','\n'));await route.fulfill({response,body});}catch(error){report.injectionErrors.push(error.message);rejectInjection(error);await route.abort('failed');}});
  await Promise.race([(async()=>{await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__&&window.__V7_FRAME_PROFILE__,null,{timeout:120000});})(),injectionFailure]);assert.deepEqual(report.injectionErrors,[]);await page.locator('#start-btn').click();
  report.device=await page.evaluate(()=>{const gl=document.querySelector('#scene canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  for(const [name,fraction]of [['root-grove',.04],['silver-marsh',.225]]){
   await page.evaluate(f=>__JINSHA_V2__.go(__JINSHA_V2__.snapshot().length*f),fraction);await page.waitForTimeout(3000);const before=await metrics();await page.evaluate(()=>__V7_FRAME_PROFILE__.start());await page.waitForTimeout(10000);const frames=await page.evaluate(()=>__V7_FRAME_PROFILE__.stop()),after=await metrics();assert.ok(frames.length>40,'profiler captured actual frames');
   const snapshot=await page.evaluate(()=>({state:__JINSHA_V2__.snapshot(),gl:document.querySelector('#scene canvas').getContext('webgl2').getError()}));assert.equal(snapshot.gl,0);
   const delta={};for(const key of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','LayoutCount','RecalcStyleCount'])if(key in after)delta[key]=after[key]-(before[key]||0);
   const zone={name,fraction,summary:summaries(frames),metrics:{before,after,delta},snapshot,frames};report.zones.push(zone);await page.screenshot({path:`${OUT}/${name}.png`});fs.writeFileSync(`${OUT}/profile.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({name,frames:frames.length,summary:zone.summary,metricsDelta:delta}));
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.injectionErrors,[]);
 }finally{await browser.close();fs.writeFileSync(`${OUT}/profile.json`,JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
