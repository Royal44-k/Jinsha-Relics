const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('case "update":','case "disabled-update":').replace('case "full-reload":','case "disabled-full-reload":')});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});if(process.env.QUALITY==='low'){await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');}await page.locator('#start-btn').click();
  const world=await page.evaluate(()=>window.__JINSHA_V2__.snapshot()),water=world.places.find(p=>p.type==='water').position,samples=[];
  const locations=[{name:'root-grove',distance:0},{name:'flight',point:[0,5,12]},{name:'river-swimming',point:[water[0],-.62,water[2]]},{name:'river-diving',point:[water[0],-2.6,water[2]]},{name:'branch',point:world.perches[0].position},{name:'ravine',distance:world.length*.31},{name:'rice-hamlet',distance:world.length*.55},{name:'sun',distance:world.length*.94}];
  for(const location of locations.filter(v=>!process.env.SAMPLE_ONLY||v.name===process.env.SAMPLE_ONLY)){
   await page.evaluate(v=>v.point?window.__JINSHA_V2__.goPoint(v.point):window.__JINSHA_V2__.go(v.distance),location);
   if(location.name==='flight')await page.keyboard.down('Space');
   await page.waitForTimeout(900);
   samples.push(await page.evaluate(name=>new Promise(resolve=>{let previous=0,start=0;const times=[];function frame(now){if(!start)start=now;if(previous)times.push(now-previous);previous=now;if(now-start<2100){requestAnimationFrame(frame);return;}const s=window.__JINSHA_V2__.snapshot(),f=times.sort((a,b)=>a-b);resolve({name,mode:s.motion.mode,count:f.length,medianMs:f[Math.floor(f.length*.5)],p95Ms:f[Math.floor(f.length*.95)],maxMs:Math.max(...f),render:s.render});}requestAnimationFrame(frame);}),location.name));
   if(location.name==='flight')await page.keyboard.up('Space');
  }
  const graphics=await page.evaluate(()=>{const gl=document.querySelector('#scene canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  const report={date:new Date().toISOString(),viewport:'1440x900 DPR1',quality:process.env.QUALITY||'high',graphics,note:'Headless Edge on this computer; isolated local 2.1-second windows at sampled locations. Flight uses held Space. Not a continuous playthrough or a guarantee for other devices.',samples,errors};fs.writeFileSync(process.env.JINSHA_OUTPUT|| (process.env.SAMPLE_ONLY?'docs/v3/runtime/performance-flight.json':'docs/v3/runtime/performance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)throw Error('Browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
