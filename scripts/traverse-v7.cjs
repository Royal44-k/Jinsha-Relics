const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const out='docs/v7/continuous-travel';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),report={at:new Date().toISOString(),method:'Continuous travel from a fresh start through all five zones with real W/Shift/Space/C input. A test-only helper aims the camera toward a nearby route point, never changes player position or puzzle state. This is a controller-assisted traversal regression, not human blind play.',errors:[],trace:[],captures:[],obstacleRecoveries:0};let up=false,down=false;page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.route('**/@vite/client',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text()).replace('case "update":','case "disabled-update":').replace('case "full-reload":','case "disabled-full-reload":')});});
  await page.route('**/src/v2/main.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text())+`\nwindow.__NAV_TARGET__=()=>{const d=forest.project(position).distance,p=forest.sample(Math.min(forest.length,d+2.8));yaw=Math.atan2(-(p.x-position.x),-(p.z-position.z));return {fraction:d/forest.length,targetGround:traversal.sample(p).groundHeight,state:window.__JINSHA_V2__.snapshot()};};`});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.locator('#start-btn').click();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  const start=Date.now();let lastDistance=0,lastProgress=Date.now(),recoveryUntil=0,lastZone='',max=0;
  while(Date.now()-start<240000){
   const v=await page.evaluate(()=>window.__NAV_TARGET__()),s=v.state,f=v.fraction;max=Math.max(max,s.distance);
   if(s.distance>lastDistance+.4){lastDistance=s.distance;lastProgress=Date.now();}
   if(Date.now()-lastProgress>4500&&Date.now()>recoveryUntil){recoveryUntil=Date.now()+4000;report.obstacleRecoveries++;}
   const fly=f>.282&&f<.345||Date.now()<recoveryUntil||['swimming','diving'].includes(s.motion.mode),target=Math.max(v.targetGround+2.1,3);
   const needUp=fly&&s.position[1]+s.motion.verticalSpeed*.3<target,needDown=!fly&&!s.motion.grounded;
   if(up!==needUp){await page.keyboard[needUp?'down':'up']('Space');up=needUp;}if(down!==needDown){await page.keyboard[needDown?'down':'up']('KeyC');down=needDown;}
   if(report.trace.length===0||Date.now()-report.trace.at(-1).at>1000)report.trace.push({at:Date.now(),elapsed:(Date.now()-start)/1000,fraction:f,distance:s.distance,mode:s.motion.mode,position:s.position,speed:s.motion.speed,render:s.render,feedback:s.cinematic.travel});
   if(s.chapters.region!==lastZone){lastZone=s.chapters.region;const file=`${report.captures.length}-${lastZone}.png`;await page.screenshot({path:out+'/'+file});report.captures.push({file,fraction:f});console.log('Entered '+lastZone+' at '+s.distance.toFixed(1)+'m');}
   if(f>.975)break;if(Date.now()-lastProgress>14000)throw Error('Route stalled at '+JSON.stringify(report.trace.at(-1)));
   await page.waitForTimeout(130);
  }
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.up('Space');await page.keyboard.up('KeyC');
  report.final=await page.evaluate(()=>({snapshot:window.__JINSHA_V2__.snapshot(),gl:document.querySelector('#scene canvas').getContext('webgl2').getError()}));report.totalSeconds=(Date.now()-start)/1000;assert.ok(report.final.snapshot.distance/report.final.snapshot.length>.975);assert.equal(report.final.gl,0);assert.deepEqual(report.errors,[]);console.log(JSON.stringify({seconds:report.totalSeconds,distance:report.final.snapshot.distance,zones:report.captures.length,obstacleRecoveries:report.obstacleRecoveries,footfalls:report.final.snapshot.cinematic.travel.footfalls,errors:report.errors}));
 }catch(e){report.failure=e.stack;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
