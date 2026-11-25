const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='docs/v7/performance';fs.mkdirSync(OUT,{recursive:true});
const quantile=(a,p)=>a[Math.min(a.length-1,Math.floor((a.length-1)*p))];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const report={date:new Date().toISOString(),viewport:{width:1440,height:900,deviceScaleFactor:1},method:'One headless Edge browser, one 3D page at a time. Each zone: 2 seconds settling followed by 6 seconds requestAnimationFrame timing. No locomotion during samples. Development build for teleporting to matched zones; production cold-start is measured separately. These are this device’s short steady-view measurements, not minimum FPS guarantees.',qualities:[],errors:[]};
 try{
  for(const quality of ['high','low']){
   const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>report.errors.push({quality,message:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({quality,message:m.text()});});
   await page.route('**/@vite/client',async route=>{const response=await route.fetch();const body=(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":');await route.fulfill({response,body});});
   await page.goto('http://127.0.0.1:5186/',{waitUntil:'commit'});await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:180000});
   if(quality==='low'){await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');await page.waitForTimeout(1000);}
   await page.locator('#start-btn').click();await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().mode==='playing');
   const device=await page.evaluate(()=>{const canvas=document.querySelector('#scene canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGB:navigator.deviceMemory||null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),canvas:[canvas.width,canvas.height],dpr:devicePixelRatio};});
   const entry={quality,device,samples:[]};report.qualities.push(entry);
   for(const [name,fraction] of [['root-grove',.04],['silver-marsh',.225],['wind-scarp',.413],['rice-hamlet',.57],['dusk-bay',.88]]){
    await page.evaluate(f=>{const api=window.__JINSHA_V2__;api.go(api.snapshot().length*f);},fraction);await page.waitForTimeout(2000);
    const sample=await page.evaluate(({name,fraction})=>new Promise(resolve=>{let first=0,previous=0;const intervals=[],draws=[],triangles=[];function frame(now){if(!first)first=now;if(previous)intervals.push(now-previous);previous=now;if(intervals.length%12===0){const s=window.__JINSHA_V2__.snapshot();draws.push(s.render.calls);triangles.push(s.render.triangles);}if(now-first<6000){requestAnimationFrame(frame);return;}const s=window.__JINSHA_V2__.snapshot();resolve({name,fraction,elapsedMs:now-first,intervals,draws,triangles,mode:s.motion.mode,quality:s.quality,chapter:s.chapters,position:s.position,camera:s.camera});}requestAnimationFrame(frame);}),{name,fraction});
    sample.intervals.sort((a,b)=>a-b);sample.draws.sort((a,b)=>a-b);sample.triangles.sort((a,b)=>a-b);
    const summary={name,fraction,elapsedMs:sample.elapsedMs,frameCount:sample.intervals.length,medianMs:quantile(sample.intervals,.5),p95Ms:quantile(sample.intervals,.95),p99Ms:quantile(sample.intervals,.99),maxMs:sample.intervals.at(-1),effectiveFps:sample.intervals.length*1000/sample.elapsedMs,drawCalls:{median:quantile(sample.draws,.5),p95:quantile(sample.draws,.95),max:sample.draws.at(-1)},triangles:{median:quantile(sample.triangles,.5),max:sample.triangles.at(-1)},mode:sample.mode,actualQuality:sample.quality,chapter:sample.chapter,position:sample.position,camera:sample.camera};summary.gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(summary.gl,0);entry.samples.push(summary);
    if(name==='root-grove'&&quality==='high')await page.screenshot({path:`${OUT}/latest-composite.png`});
    console.log(JSON.stringify({quality,name,medianMs:summary.medianMs,p95Ms:summary.p95Ms,effectiveFps:summary.effectiveFps,drawCalls:summary.drawCalls}));
    fs.writeFileSync(`${OUT}/performance-v7.json`,JSON.stringify(report,null,2));assert.equal(sample.quality,quality);
   }
   await context.close();
  }
  assert.deepEqual(report.errors,[]);console.log('Five-zone high/low sampling complete with zero browser errors.');
 }finally{await browser.close();fs.writeFileSync(`${OUT}/performance-v7.json`,JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
