const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='docs/v8/perches';fs.mkdirSync(OUT,{recursive:true});
const method='Five full-scene branch approaches. One recorded checkpoint per branch, 6m toward the main path and below its height; subsequent movement and landing use actual W/V/Space/C/E/R keys. The helper steers yaw but never moves the body after that checkpoint. Not blind human play or a fresh-start completion. Branch-0 full fresh-start approach is separately recorded by play-movement-v8.cjs. Ground corridor checks are read-only collision queries against traversal + adventure + pottery.';
(async()=>{
 const report={at:new Date().toISOString(),method,branches:[],errors:[]},browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page;
 try{
  page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/@vite/client',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text()).replace('case "update":','case "test-update-disabled":').replace('case "full-reload":','case "test-reload-disabled":')});});
  await page.route('**/src/v2/main.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+`
const __V8_PERCH_EVENTS__=[];const __V8_PERCH_EVENT__=onMotionEvent;onMotionEvent=e=>{__V8_PERCH_EVENTS__.push({event:e,time:performance.now(),position:position.toArray(),keys:[...keys]});__V8_PERCH_EVENT__(e);};
window.__V8_PERCH_TEST__={
 read(){return {state:__JINSHA_V2__.snapshot(),candidate:motion.getPerchCandidate(),action:currentIntent,events:__V8_PERCH_EVENTS__.slice(-100),ring:traversal.group.getObjectByName('Perch approach ring · '+motion.state.perchId)?.material.opacity};},
 aim(p){yaw=Math.atan2(-(p[0]-position.x),-(p[2]-position.z));return this.read();},
 checkpoint(id){const p=traversal.perches.find(p=>p.id===id),dir=new THREE.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw)),start=p.position.clone().addScaledVector(dir,6);start.y=Math.max(p.position.y-.45,traversal.sample(start).groundHeight+.6);resetInput();__JINSHA_V2__.goPoint(start.toArray());return {position:start.toArray(),kind:'airborne',distance:start.distanceTo(p.position),horizontal:6,surface:traversal.sample(start),target:p.position.toArray()};},
 corridor(id){const p=traversal.perches.find(p=>p.id===id),d=forest.sampleMain(p.position).distance,steps=[];const resolve=(a,b)=>{const first=traversal.resolveMotion(a,b,.27),second=adventure.resolveMotion(a,first.position,.27),resolved=second?.hit?second:first,third=pottery.resolveMotion(a,resolved.position,.27);return third?.hit?third:resolved;};for(let offset=-6;offset<6;offset+=.25){const from=forest.sample(d+offset),to=forest.sample(d+offset+.25);from.y=traversal.sample(from).groundHeight;to.y=traversal.sample(to).groundHeight;const result=resolve(from,to);steps.push({offset,hit:result.hit,error:result.position.distanceTo(to),reason:result.reason});}return {distance:d,steps};}
};`});});
  const boot=async()=>{await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});};
  await page.goto('http://127.0.0.1:5186');await boot();await page.locator('#start-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');
  const read=()=>page.evaluate(()=>__V8_PERCH_TEST__.read()),branches=(await read()).state.perches,held=new Set();
  const hold=async(key,on)=>{if(on!==held.has(key)){await page.keyboard[on?'down':'up'](key);on?held.add(key):held.delete(key);}};
  const release=async()=>{for(const key of [...held])await hold(key,false);};
  for(const branch of branches){
   const record={id:branch.id,label:branch.label,target:branch.position,checks:[],trace:[],detours:[]};report.branches.push(record);
   const check=(label,condition)=>{assert.ok(condition,branch.id+': '+label);record.checks.push(label);};
   try{
    record.corridor=await page.evaluate(id=>__V8_PERCH_TEST__.corridor(id),branch.id);
    record.corridorBlocked=record.corridor.steps.filter(s=>s.error>=.025);
    if(!record.corridorBlocked.length)check('authored main path remains traversable across the nearby 12m corridor',true);
    record.checkpoint=await page.evaluate(id=>__V8_PERCH_TEST__.checkpoint(id),branch.id);check('single approach checkpoint is 6m away, never on the branch',record.checkpoint.distance>=6);
    await page.keyboard.press('KeyV');let began=Date.now(),stalledSince=0,detours=0,reached=false;
    while(Date.now()-began<35000){
     const a=await page.evaluate(p=>__V8_PERCH_TEST__.aim(p),branch.position),s=a.state,p=a.candidate;record.trace.push({time:(Date.now()-began)/1000,position:s.position,mode:s.motion.mode,speed:s.motion.speed,candidate:p});
     if(p?.id===branch.id&&p.canRequest){reached=true;await page.keyboard.press(record.id==='branch-0'?'KeyE':'KeyR');break;}
     await hold('KeyW',!p||p.horizontal>2.2);
     await hold('Space',s.position[1]+s.motion.verticalSpeed*.25<branch.position[1]-.25);
     await hold('KeyC',s.position[1]+s.motion.verticalSpeed*.25>branch.position[1]+.4);
     if(held.has('KeyW')&&s.motion.speed<.15&&Date.now()-began>1200){if(!stalledSince)stalledSince=Date.now();}else stalledSince=0;
     if(stalledSince&&Date.now()-stalledSince>1000){check('no more than two physical detours needed',detours<2);record.detours.push({position:s.position,candidate:p,reason:s.motion.boundaryMessage});await hold('KeyC',false);await hold('Space',true);await hold(detours%2?'KeyA':'KeyD',true);await page.waitForTimeout(600);await hold(detours%2?'KeyA':'KeyD',false);detours++;stalledSince=0;}
     await page.waitForTimeout(100);
    }
    check('physical flight reaches the valid branch approach',reached);await release();
    await page.waitForFunction(id=>__JINSHA_V2__.snapshot().motion.mode==='perched'&&__JINSHA_V2__.snapshot().motion.perchId===id,branch.id,{timeout:8000});await page.waitForTimeout(900);record.landed=await read();
    check('branch contact succeeds using an actual E or R key',record.landed.state.motion.perchId===branch.id);
    check('landing ring fades from the occupied branch',record.landed.ring<.01);
    await page.screenshot({path:OUT+'/'+branch.id+'-landed.png'});
    await page.keyboard.press('Escape');const paused=(await read()).state.position;await page.waitForTimeout(250);check('pause preserves the exact supported position',JSON.stringify((await read()).state.position)===JSON.stringify(paused));await page.locator('#resume').click();
    await page.reload();await boot();check('continue action is offered for the saved branch',await page.locator('#continue-btn').isVisible());await page.locator('#continue-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');record.restored=await read();
    check('reload restores the correct supported branch',record.restored.state.motion.mode==='perched'&&record.restored.state.motion.perchId===branch.id&&Math.hypot(...record.restored.state.position.map((v,i)=>v-branch.position[i]))<.001);
    check('reload restores physical branch orientation and slope',Math.abs(record.restored.state.motion.perchYaw-branch.yaw)<1e-8&&Math.abs(record.restored.state.motion.perchSlopeX-branch.slope.x)<1e-8&&Math.abs(record.restored.state.motion.perchSlopeZ-branch.slope.z)<1e-8);
    await page.keyboard.press('KeyR');await page.waitForTimeout(140);check('R leaves the saved branch with real vertical velocity',(await read()).state.motion.mode!=='perched');
    await page.keyboard.press('KeyR');await page.waitForFunction(id=>__JINSHA_V2__.snapshot().motion.mode==='perched'&&__JINSHA_V2__.snapshot().motion.perchId===id,branch.id,{timeout:8000});check('R reapproach returns to the same physical support',true);
    record.final=await read();
   }catch(e){record.failure=e.stack;record.last=await read().catch(()=>null);await page.screenshot({path:OUT+'/'+branch.id+'-failure.png'}).catch(()=>{});await release();await page.reload();await boot();await page.locator('#continue-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');}
  }
  report.gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(report.gl,0);assert.deepEqual(report.errors,[]);assert.equal(report.branches.filter(b=>b.failure).length,0,'all five branch journeys should pass');assert.equal(report.branches.filter(b=>b.corridorBlocked.length).length,0,'all five nearby main-path corridors should remain open');console.log(JSON.stringify({branches:report.branches.map(b=>({id:b.id,checks:b.checks.length})),errors:report.errors,gl:report.gl}));
 }catch(e){report.failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(OUT+'/results.json',JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
