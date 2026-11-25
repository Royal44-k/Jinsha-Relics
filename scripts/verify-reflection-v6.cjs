const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const out='docs/v6/performance';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),report={at:new Date().toISOString(),errors:[],directions:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.route('**/@vite/client',async r=>{const q=await r.fetch();await r.fulfill({response:q,body:(await q.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":')});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});
  report.boot=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().startup);report.glAtTitle=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(report.glAtTitle,0);
  await page.locator('#start-btn').click();await page.evaluate(()=>window.__JINSHA_V2__.go(window.__JINSHA_V2__.snapshot().length*.413));
  const base=await page.evaluate(()=>{const s=window.__JINSHA_V2__.snapshot();return Math.atan2(s.camera[0]-s.position[0],s.camera[2]-s.position[2]);});
  for(let i=0;i<8;i++){
   await page.evaluate(a=>window.__JINSHA_V2__.look(a),base+i*Math.PI/4);await page.waitForTimeout(250);
   const before=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection);await page.waitForTimeout(500);
   const after=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection);const entry={angle:i*45,before,after,newReflections:after.frames-before.frames,newSkipped:after.skippedFrames-before.skippedFrames};report.directions.push(entry);
   if(i===0||!after.inView&&report.directions.filter(v=>!v.after.inView).length===1)await page.screenshot({path:out+'/reflection-angle-'+i+'.png'});
   if(!after.inView){assert.equal(entry.newReflections,0);assert.ok(entry.newSkipped>0);}
  }
  assert.ok(report.directions.some(d=>!d.after.inView));assert.ok(report.directions.some(d=>d.after.inView&&d.newReflections>10));
  const before=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection.frames);await page.evaluate(a=>window.__JINSHA_V2__.look(a),base);await page.waitForTimeout(200);
  report.reentry=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection);assert.ok(report.reentry.inView);assert.ok(report.reentry.frames>before);
  await page.keyboard.press('KeyP');await page.waitForTimeout(200);report.photo=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection);await page.keyboard.press('Escape');
  await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');await page.waitForTimeout(250);report.low=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().chapters.reflection);assert.equal(report.low.enabled,false);
  report.glFinal=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(report.glFinal,0);assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({directions:report.directions.map(d=>({angle:d.angle,inView:d.after.inView,rendered:d.newReflections,skipped:d.newSkipped})),gl:[report.glAtTitle,report.glFinal],errors:report.errors},null,2));
 }catch(e){report.failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(out+'/reflection-runtime.json',JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
