const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const out='docs/v6/performance';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),report={at:new Date().toISOString(),method:'One Edge page, 1440×900 DPR1 high. Real W movement for 12 seconds across each chapter boundary. DEV positioning only before a segment; heading follows the path through a test hook, with no position injection during the segment. Measures cold region entry as well as steady movement. Not a human blind playtest or minimum-FPS guarantee.',errors:[],segments:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.route('**/@vite/client',async r=>{const q=await r.fetch();await r.fulfill({response:q,body:(await q.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":')});});
  await page.route('**/src/v2/main.js*',async r=>{const q=await r.fetch();await r.fulfill({response:q,body:(await q.text())+'\nwindow.__STEER__=()=>{const d=forest.project(position).distance,p=forest.sample(Math.min(forest.length,d+3));yaw=Math.atan2(-(p.x-position.x),-(p.z-position.z));};'});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.locator('#start-btn').click();
  for(const [name,fraction] of [['grove-to-marsh',.135],['marsh-to-scarp',.315],['scarp-to-hamlet',.485],['hamlet-to-bay',.705]]){
   await page.evaluate(f=>window.__JINSHA_V2__.go(window.__JINSHA_V2__.snapshot().length*f),fraction);await page.waitForTimeout(150);
   await page.keyboard.down('KeyW');
   const sample=await page.evaluate(()=>new Promise(resolve=>{
    const before=window.__JINSHA_V2__.snapshot();let start=0,prior=0,maxGap=0;const intervals=[],draws=[],states={};
    function step(now){window.__STEER__();if(!start)start=now;if(prior){intervals.push(now-prior);maxGap=Math.max(maxGap,now-prior);}prior=now;
     if(intervals.length%15===0){const s=window.__JINSHA_V2__.snapshot();draws.push(s.render.calls);states[s.motion.mode]=(states[s.motion.mode]||0)+1;}
     if(now-start<12000){requestAnimationFrame(step);return;}
     const after=window.__JINSHA_V2__.snapshot();intervals.sort((a,b)=>a-b);draws.sort((a,b)=>a-b);const q=(a,p)=>a[Math.floor((a.length-1)*p)];
     resolve({elapsedMs:now-start,frames:intervals.length,medianMs:q(intervals,.5),p95Ms:q(intervals,.95),p99Ms:q(intervals,.99),maxMs:maxGap,effectiveFps:intervals.length*1000/(now-start),drawMedian:q(draws,.5),drawMax:draws.at(-1),movementModes:states,distanceTravelled:after.distance-before.distance,start:before.position,end:after.position,chapterBefore:before.chapters.region,chapterAfter:after.chapters.region,gl:document.querySelector('#scene canvas').getContext('webgl2').getError()});
    }requestAnimationFrame(step);
   }));
   await page.keyboard.up('KeyW');report.segments.push({name,...sample});assert.ok(sample.distanceTravelled>3);assert.equal(sample.gl,0);await page.screenshot({path:out+'/motion-'+name+'.png'});console.log(JSON.stringify({name,...sample}));fs.writeFileSync(out+'/motion-v6.json',JSON.stringify(report,null,2));
  }
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(out+'/motion-v6.json',JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
