const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',url=base+'/__field-crown-verify';
const fixture='<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body,main{margin:0;width:100%;height:100%;overflow:hidden}</style><main></main><script type=module>import{mountFieldwork}from"/src/v10/fieldwork.js";mountFieldwork("root-survey",document.querySelector("main"),{complete:()=>document.body.dataset.finished="yes"});</script>';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
 const report=[],out='docs/v10/fieldwork/crown-media-v11.json';
 try{for(const scenario of ['recorded','missing','reduced']){
   const context=await b.newContext({viewport:{width:1280,height:720},reducedMotion:scenario==='reduced'?'reduce':'no-preference'});
   const page=await context.newPage();page.setDefaultTimeout(40000);const errors=[];let movies=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&/THREE|shader/i.test(e.text()))errors.push(e.text());});
   page.on('request',r=>{if(r.url().includes('fieldwork-autumnwood-growth.webm'))movies++;});
   if(scenario==='missing')await page.route('**/fieldwork-autumnwood-growth.webm',r=>r.fulfill({status:404,body:''}));
   await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto(url);const btn=name=>page.getByRole('button',{name,exact:true});
   const click=async name=>{const x=btn(name);await x.waitFor();const r=await x.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
   await click('采集根部样本');await click('散孔参照');for(let i=0;i<3;i++)await click('顺转 15°');await click('复核切片');
   let seconds=0,frames=null;
   if(scenario==='recorded'){
     const v=page.locator('.fw-crown-film video');await v.waitFor();
     await page.waitForFunction(()=>{const v=document.querySelector('.fw-crown-film video');return v&&v.currentTime>.2;});
     seconds=await v.evaluate(v=>v.duration);
     frames=await page.evaluate(()=>new Promise(resolve=>{let last=performance.now(),start=last,samples=[];const f=()=>{let t=performance.now();samples.push(t-last);last=t;if(t-start<2800)requestAnimationFrame(f);else {samples.sort((a,b)=>a-b);resolve({n:samples.length,p50:samples[Math.ceil(samples.length*.5)-1],p95:samples[Math.ceil(samples.length*.95)-1],max:samples.at(-1)});}};requestAnimationFrame(f);}));
   }
   await btn('看古林复原').waitFor({timeout:16000});const mode=await page.locator('.js-field').getAttribute('data-crown-mode');
   assert.equal(mode,scenario==='recorded'?'recorded':'still');if(scenario==='reduced')assert.equal(movies,0);if(scenario==='recorded')assert.ok(seconds>4&&seconds<5);
   await click('看古林复原');await click('收存秋枫鉴定标本');assert.equal(await page.locator('body').getAttribute('data-finished'),'yes');assert.deepEqual(errors,[]);
   report.push({scenario,mode,seconds,movies,frames,viewport:'1280 × 720',browser:b.version(),renderer:'ANGLE SwiftShader',errors});await context.close();
 }}finally{await b.close();fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
