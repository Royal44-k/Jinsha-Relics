const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const out='docs/v8/final-polish';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const report={at:new Date().toISOString(),checks:[],layouts:[],errors:[]};let page;
try{
 const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
 let ctx=await b.newContext({viewport:{width:1440,height:900}});page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:5188');await page.locator('#start-btn').waitFor({state:'visible',timeout:120000});await page.locator('#start-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');
 await page.keyboard.press('KeyQ');await page.keyboard.down('KeyW');await page.waitForTimeout(700);let slow=await page.evaluate(()=>__JINSHA_V2__.snapshot().motion.speed);check('production listening slows ordinary steps',slow>1.1&&slow<1.3);
 await page.keyboard.down('Shift');await page.waitForTimeout(700);let quick=await page.evaluate(()=>__JINSHA_V2__.snapshot().motion.speed);check('production Shift overrides listening slowdown',quick>3.7);
 await page.keyboard.up('Shift');await page.waitForTimeout(700);let released=await page.evaluate(()=>__JINSHA_V2__.snapshot().motion.speed);check('releasing Shift restores quiet listening',released>1.1&&released<1.3);
 await page.keyboard.up('KeyW');check('listening is visibly explained',/倾听/.test(await page.locator('#motion-label').innerText())&&/Q 结束/.test(await page.locator('#travel-instruction').innerText()));await page.screenshot({path:out+'/01-production-listening.png'});report.speeds={slow,quick,released};await ctx.close();
 for(const coarse of [false,true]){
  ctx=await b.newContext({viewport:{width:1440,height:900},hasTouch:coarse,isMobile:coarse});page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:5186');await page.locator('#start-btn').waitFor({state:'visible',timeout:120000});await page.locator('#start-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');
  await page.keyboard.down('KeyW');await page.waitForTimeout(180);await page.keyboard.up('KeyW');await page.evaluate(()=>{const b=__JINSHA_V2__.adventureDebug().buds[0];__JINSHA_V2__.goPoint(b);});await page.waitForTimeout(150);await page.keyboard.press('KeyE');
  const pool=await page.evaluate(()=>__JINSHA_V2__.livingDebug().moments.find(m=>m.id==='river-mirror').position);await page.evaluate(p=>__JINSHA_V2__.goPoint([p[0]+8,0,p[2]]),pool);
  for(const size of coarse?[{width:390,height:844},{width:844,height:390}]:[{width:1440,height:900},{width:1024,height:768}]){
   await page.setViewportSize(size);await page.waitForTimeout(600);await page.locator('#v6-living-clue').waitFor({state:'visible',timeout:5000});
   const layout=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};const clue=rect(document.querySelector('#v6-living-clue'));const selector=matchMedia('(pointer:coarse)').matches||innerWidth<=700?'.touch-actions button':'.v8-action-strip button';const actions=[...document.querySelectorAll(selector)].map(rect);return{clue,actions,travel:rect(document.querySelector('#travel-status')),overflow:document.documentElement.scrollWidth>innerWidth};});report.layouts.push({coarse,size,...layout});
   check('ecology does not overlap actions '+size.width+'x'+size.height,layout.actions.every(r=>r.x>=layout.clue.right||r.right<=layout.clue.x||r.y>=layout.clue.bottom||r.bottom<=layout.clue.y));check('no viewport overflow '+size.width+'x'+size.height,!layout.overflow);
   if(coarse&&size.height<500){const r=layout.travel,c=layout.clue;check('landscape movement status is outside ecology card',r.right<=c.x||r.x>=c.right||r.bottom<=c.y||r.y>=c.bottom);}
   await page.screenshot({path:out+'/clue-'+size.width+'x'+size.height+'.png'});
  }await ctx.close();
 }
 check('final polish pages have no runtime errors',!report.errors.length);
}catch(e){report.failure=e.stack;if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await b.close();fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
