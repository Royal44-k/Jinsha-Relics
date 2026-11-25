const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const OUT='docs/v8/render/pixel-budget',DURATION=8000;
fs.mkdirSync(OUT,{recursive:true});
function replace(source,find,value){assert.equal(source.split(find).length-1,1,'instrument anchor '+find.slice(0,65));return source.replace(find,value);}
function instrument(source){
 source=replace(source,'function tick(now){','function tick(now){const __pixelStart=performance.now();window.__V8_PIXELS__?.begin();');
 source=replace(source,'renderer.info.reset();composer.render();',`const __pixelRender=performance.now();window.__V8_PIXELS__?.beginGPU();renderer.info.reset();composer.render();window.__V8_PIXELS__?.end({now,rawMs:raw*1000,logicMs:__pixelRender-__pixelStart,renderMs:performance.now()-__pixelRender,totalMs:performance.now()-__pixelStart,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,position:position.toArray()});`);
 return source+`\nconst __pixels={active:false,rows:[],pending:[],gl:null,ext:null,current:null};
 window.__V8_PIXELS__={
  begin(){const p=__pixels,gl=p.gl,ext=p.ext;if(!ext)return;const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);for(let i=p.pending.length-1;i>=0;i--){const x=p.pending[i];if(disjoint||gl.getQueryParameter(x.query,gl.QUERY_RESULT_AVAILABLE)){if(!disjoint)x.row.gpuMs=gl.getQueryParameter(x.query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(x.query);p.pending.splice(i,1);}}},
  beginGPU(){const p=__pixels;if(p.active&&p.ext&&p.pending.length<8){p.current=p.gl.createQuery();p.gl.beginQuery(p.ext.TIME_ELAPSED_EXT,p.current);}},
  end(row){const p=__pixels;if(p.active){p.rows.push(row);if(p.current){p.gl.endQuery(p.ext.TIME_ELAPSED_EXT);p.pending.push({query:p.current,row});p.current=null;}}},
  start(){const p=__pixels;if(!p.gl){p.gl=renderer.getContext();p.ext=p.gl.getExtension('EXT_disjoint_timer_query_webgl2');}p.rows=[];p.active=true;},
  stop(){__pixels.active=false;},rows(){return __pixels.rows;},
  configure(){settings.quality='high';settings.resolution='detail';applySettings();return {quality:settings.quality,resolution:settings.resolution,ratio:renderer.getPixelRatio(),devicePixelRatio,css:[innerWidth,innerHeight],canvas:[renderer.domElement.width,renderer.domElement.height],contactShadows:contactPass.enabled,shadowMap:renderer.shadowMap.enabled};},
  steer(){const d=forest.project(position).distance,p=forest.sample(Math.min(forest.length,d+3));yaw=Math.atan2(-(p.x-position.x),-(p.z-position.z));},
  state(){return {mode:state.mode,position:position.toArray(),camera:camera.position.toArray(),shot:activeShot?.id||null,motion:motion.state.mode,quality:settings.quality};}
 };`;
}
function summarize(rows){const result={};for(const key of ['rawMs','logicMs','renderMs','totalMs','gpuMs','calls','triangles']){const a=rows.map(r=>r[key]).filter(Number.isFinite).sort((a,b)=>a-b),q=p=>a[Math.floor((a.length-1)*p)];result[key]={samples:a.length,median:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)};}return result;}
(async()=>{
 const report={at:new Date().toISOString(),method:'Current runtime, one Edge page; 1920x1080 CSS viewport, high quality. CDP deviceScaleFactor drives normal applySettings. DPR sequence 1,1.5,1.5,1 (ABBA); each visits two fixed route points, stationary and 8s real W plus yaw-only steering. CPU submit and nonblocking EXT GPU elapsed separately measured. No quality, model, texture, light or reflection setting changes. Runtime module loaded once, HMR disabled.',errors:[],segments:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);});
 try{
  await page.route('**/@vite/client',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('case "update":','case "disabled-update":').replace('case "full-reload":','case "disabled-reload":')});});
  await page.route('**/src/v2/main.js*',async r=>{const response=await r.fetch(),source=await response.text();report.mainHash=crypto.createHash('sha256').update(source).digest('hex');await r.fulfill({response,body:instrument(source)});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__&&window.__V8_PIXELS__,null,{timeout:120000});await page.locator('#start-btn').click();
  report.device=await page.evaluate(()=>{const gl=document.querySelector('#scene canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gpuTimer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),userAgent:navigator.userAgent};});
  assert.ok(report.device.gpuTimer,'GPU timer required for this paired experiment');
  for(const [pass,dpr]of [1,1.5,1.5,1].entries()){
   await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:dpr,mobile:false});await page.waitForFunction(value=>devicePixelRatio===value,dpr);const configuration=await page.evaluate(()=>__V8_PIXELS__.configure());assert.equal(configuration.ratio,dpr);assert.deepEqual(configuration.canvas,[1920*dpr,1080*dpr]);
   for(const [zone,fraction]of [['root-grove',.02],['scarp',.39]])for(const moving of [false,true]){
    await page.evaluate(f=>__JINSHA_V2__.go(__JINSHA_V2__.snapshot().length*f),fraction);await page.waitForTimeout(3000);const before=await page.evaluate(()=>__V8_PIXELS__.state());await page.evaluate(()=>__V8_PIXELS__.start());if(moving)await page.keyboard.down('KeyW');const start=Date.now();
    while(Date.now()-start<DURATION){if(moving)await page.evaluate(()=>__V8_PIXELS__.steer());await page.waitForTimeout(150);}if(moving)await page.keyboard.up('KeyW');await page.evaluate(()=>__V8_PIXELS__.stop());await page.waitForTimeout(250);const rows=await page.evaluate(()=>__V8_PIXELS__.rows()),after=await page.evaluate(()=>__V8_PIXELS__.state()),gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(gl,0);
    const summary=summarize(rows);report.segments.push({pass,dpr,zone,moving,configuration,before,after,summary,rows});fs.writeFileSync(OUT+'/profile.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass,dpr,zone,moving,frames:rows.length,summary}));
    // Screenshots can restore Playwright's context metrics. Keep them outside
    // the paired sampling so every pass retains its verified CDP pixel ratio.
   }
  }
  assert.deepEqual(report.errors,[]);
 }finally{await browser.close();fs.writeFileSync(OUT+'/profile.json',JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
