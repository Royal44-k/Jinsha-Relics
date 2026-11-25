const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='docs/v6/world-captures';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report={date:new Date().toISOString(),viewport:[1440,900],samples:[],errors};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":')});});
  await page.goto('http://127.0.0.1:5186/chapter-preview-v5.html');await page.waitForFunction(()=>window.ready,null,{timeout:120000});
  report.warmup=await page.evaluate(async()=>{const {renderer,camera,chapters}=preview,gl=renderer.getContext();const before=gl.getError();await chapters.warmup(renderer,camera);return {before,after:gl.getError()};});assert.equal(report.warmup.after,0);
  for(const [name,f] of [['roots',.035],['marsh',.225],['rocks',.39],['hamlet',.57],['bay',.90]]){
   await page.evaluate(f=>shot(f),f);
   for(const q of ['high','low']){
    const sample=await page.evaluate(({q,f})=>new Promise((resolve,reject)=>{const {forest}=preview,p=forest.sample(forest.length*f),frames=[],costs=[];let start=0,last=0;const timer=setTimeout(()=>reject(new Error('sampling timeout')),30000);function tick(t){try{if(!start)start=t;preview.frame(p,f,q);if(last&&t-start>1500){frames.push(t-last);costs.push(preview.chapters.stats().reflection.cpuSubmitMs);}last=t;if(t-start<4500)requestAnimationFrame(tick);else{clearTimeout(timer);frames.sort((a,b)=>a-b);costs.sort((a,b)=>a-b);resolve({quality:q,median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1),reflectionSubmitMedian:costs[Math.floor(costs.length*.5)],render:{...preview.renderer.info.render},chapter:preview.chapters.stats()});}}catch(e){clearTimeout(timer);reject(e);}}requestAnimationFrame(tick);}),{q,f});
    report.samples.push({name,f,...sample});console.log(name,q,sample.median,sample.p95,sample.render.calls);
    if(q==='high')await page.screenshot({path:`${OUT}/after-${name}.png`});
   }
  }
  report.rootCollision=await page.evaluate(()=>{const {forest,world,THREE:T}=preview;const f=.09,p=forest.sample(f*forest.length),t=forest.path.getTangentAt(f),from=p.clone().addScaledVector(t,-5),to=p.clone().addScaledVector(t,5);from.y=to.y=.1;const clear=world.resolveMotion(from,to,.26);const proxy=forest.colliders.find(c=>c.rootVault&&c.minY<.2&&c.height>1);const a=new T.Vector3(proxy.x+proxy.r+1,.3,proxy.z),b=new T.Vector3(proxy.x,.3,proxy.z),blocked=world.resolveMotion(a,b,.26);return {centralPassageClear:!clear.hit,end:clear.position.toArray(),rootSolid:blocked.hit,rootSamples:forest.colliders.filter(c=>c.rootVault).length};});
  report.waterFallback=await page.evaluate(()=>{const {forest,camera,chapters}=preview,p=forest.sample(forest.length*.225);camera.position.y=-.8;chapters.update(.016,12,{position:p,camera,quality:'high'});return {underwaterReflection:chapters.stats().reflection.enabled,originalRiverVisible:forest.group.getObjectByName('Reflective winding river').visible};});assert.equal(report.waterFallback.underwaterReflection,false);assert.equal(report.waterFallback.originalRiverVisible,true);
  assert.equal(report.rootCollision.centralPassageClear,true);assert.equal(report.rootCollision.rootSolid,true);assert.deepEqual(errors,[]);
 }finally{await browser.close();fs.writeFileSync(`${OUT}/world-verification.json`,JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
