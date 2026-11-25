const {chromium}=require('playwright'),fs=require('node:fs');
const out='docs/v7/antialiasing';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report={at:new Date().toISOString(),viewport:[1440,900],method:'Sequential same-device 0/2/4-sample composer experiment; real scene, equal camera positions. Shader/driver caches may warm between runs. Each region settles 1.5 s then measures 5 s of rAF. Experimental response injection only, no production source change.',runs:[]};try{
 for(const samples of [0,2,4]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage(),run={samples,errors:[],zones:[]};report.runs.push(run);page.on('pageerror',e=>run.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')run.errors.push(m.text());});
  await page.route('**/@vite/client',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text()).replace('case "update":','case "disabled-update":').replace('case "full-reload":','case "disabled-full-reload":')});});
  await page.route('**/src/v2/main.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text()).replace('composer=new EffectComposer(renderer);',`composer=new EffectComposer(renderer);composer.renderTarget1.samples=${samples};composer.renderTarget2.samples=${samples};`)});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.locator('#start-btn').click();
  for(const [name,fraction]of [['grove',.04],['water',.225]]){
   await page.evaluate(f=>window.__JINSHA_V2__.go(window.__JINSHA_V2__.snapshot().length*f),fraction);await page.waitForTimeout(1500);
   const stats=await page.evaluate(()=>new Promise(resolve=>{let start=0,prior=0,values=[];function frame(now){if(!start)start=now;if(prior)values.push(now-prior);prior=now;if(now-start<5000)return requestAnimationFrame(frame);values.sort((a,b)=>a-b);const gl=document.querySelector('#scene canvas').getContext('webgl2'),q=p=>values[Math.floor((values.length-1)*p)];resolve({fps:values.length*1000/(now-start),median:q(.5),p95:q(.95),max:values.at(-1),gl:gl.getError(),maxSamples:gl.getParameter(gl.MAX_SAMPLES),render:window.__JINSHA_V2__.snapshot().render});}requestAnimationFrame(frame);}));run.zones.push({name,...stats});await page.screenshot({path:`${out}/${samples}-${name}.png`});console.log(JSON.stringify({samples,name,...stats}));
  }
  await context.close();fs.writeFileSync(out+'/study.json',JSON.stringify(report,null,2));
 }
 }finally{await browser.close();fs.writeFileSync(out+'/study.json',JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
