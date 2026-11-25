const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

// Run only when the team's single GPU slot is free. This script intentionally
// creates a fresh isolated browser context; it never installs a save fixture.
const OUT=process.env.JINSHA_OUTPUT||'docs/v9/legacy-review';
const URL=legacyEntry();
const WITH_LIVING=process.env.JINSHA_LEGACY_LIVING!=='0';
fs.mkdirSync(OUT,{recursive:true});

// These probes only read runtime objects. Clay edits, voices, animation, rewards
// and saves below are produced by the game's real buttons and pointer/key input.
const readOnlyProbe=`
window.__V9_LEGACY__={
 read(){return {preview:!!preview,previewCanvas:document.querySelectorAll('#preview canvas').length,canvases:document.querySelectorAll('canvas').length,spreading:!!preview?.spreading,previewElapsed:preview?.elapsed||0,spreadWeight:preview?.spread?.getEffectiveWeight()||0,spreadTracks:preview?.spread?.getClip().tracks.map(t=>t.name)||[],voice:audio.active?{id:audio.active.id,state:audio.active.state,source:!!audio.active.source,duration:audio.active.source?.buffer?.duration||0}:null,audioContext:audio.context?.state,audioPaused:audio.paused,gl:renderer.getContext().getError(),contextLost:renderer.getContext().isContextLost()};},
 clayPoint(){
  const bounds=pottery.screenBounds(camera,innerWidth,innerHeight),surface=document.querySelector('.pottery-surface');
  for(const height of [.55,.65,.42,.75])for(const offset of [.20,.08,-.08,-.20]){
   const x=bounds.x+bounds.width*offset,y=bounds.bottom-bounds.height*height,element=document.elementFromPoint(x,y),hit=pottery.pick(camera,x,y,innerWidth,innerHeight);
   if(hit&&(element===surface||surface?.contains(element)))return {x,y,bounds,height:hit.height,dx:offset<0?-30:30};
  }
  return {unavailable:true,bounds};
 }
};`;

(async()=>{
 let browser,page;
 const report={at:new Date().toISOString(),url:URL,method:'Fresh isolated desktop Edge context. Actual profile/voice/pose buttons, pointer clay strokes, undo/fire/close/continue buttons, R/Q/map keys. Explicit developer goPoint only navigates to existing debug landmarks; no save, puzzle, reward, health or clay state is injected. Read-only probes inspect current animation/audio and choose a visible clay surface hit. Not blind play or a performance benchmark.',checks:[],errors:[],consoleErrors:[],httpErrors:[],captures:[],navigation:[],voiceSamples:[],profiles:[],drags:[],optionalLiving:WITH_LIVING};
 const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS '+name);};
 try{
  browser=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('case "update":','case "legacy-update-disabled":').replace('case "full-reload":','case "legacy-reload-disabled":')});});
  await page.route('**/src/v2/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\n'+readOnlyProbe});});
  const snap=()=>page.evaluate(()=>__JINSHA_V2__.snapshot());
  const audit=()=>page.evaluate(()=>__V9_LEGACY__.read());
  const ready=()=>page.waitForFunction(()=>window.__JINSHA_V2__?.snapshot().mode==='title'&&window.__V9_LEGACY__,null,{timeout:120000});
  const press=async key=>{await page.keyboard.press(key);await page.waitForTimeout(140);};
  const shot=async name=>{await page.screenshot({path:path.join(OUT,name+'.png')});const s=await snap();report.captures.push({name,mode:s.mode,position:s.position,pottery:s.pottery,living:s.living,render:s.render});};
  const go=async(position,purpose)=>{report.navigation.push({purpose,position});await page.evaluate(p=>__JINSHA_V2__.goPoint(p),position);await page.waitForTimeout(280);};
  await page.goto(URL,{waitUntil:'commit'});await ready();await page.waitForTimeout(1000);
  check('development navigation exists for declared landmark checkpoints',await page.evaluate(()=>typeof __JINSHA_V2__.goPoint==='function'));
  const initialCanvases=(await audit()).canvases;

  for(let round=1;round<=2;round++){
   await page.locator('#profile-btn').click();
   await page.waitForFunction(()=>window.__V9_LEGACY__.read().preview&&document.querySelector('#preview canvas'));
   const opened=await audit();check('profile '+round+': exactly one preview canvas is added',opened.previewCanvas===1&&opened.canvases===initialCanvases+1);
   const poseStart=(await audit()).previewElapsed;await page.locator('#pose-preview').click();
   await page.waitForFunction(start=>{const p=__V9_LEGACY__.read();return p.spreading&&p.previewElapsed>=start+.45&&p.spreadWeight>.98;},poseStart);
   const spread=await audit();check('profile '+round+': actual wing button plays feather and tail tracks',spread.spreadTracks.some(n=>n.includes('Primary'))&&spread.spreadTracks.some(n=>n.includes('TailFan')));
   await shot('0'+round+'-profile-spread');
   for(const [selector,id]of [['#voice-preview','spirit_preview'],['#narrator-voice-preview','narrator_preview']]){
    await page.locator(selector).click();
    await page.waitForFunction(id=>{const a=__V9_LEGACY__.read();return a.voice?.id===id&&a.voice.state==='playing'&&a.voice.source&&a.audioContext==='running';},id,{timeout:20000});
    await page.waitForTimeout(320);const sample=await audit();report.voiceSamples.push({round,...sample.voice,context:sample.audioContext});
    check('profile '+round+': '+id+' plays a decoded audio source',sample.voice?.duration>0&&!sample.audioPaused);
   }
   if(round===1)await press('Escape');else await page.locator('#dialog-close').click();
   await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='title');
   const closed=await audit();report.profiles.push({round,opened,spread,closed});
   check('profile '+round+': closing disposes preview and preserves main context',!closed.preview&&closed.previewCanvas===0&&closed.canvases===initialCanvases&&!closed.contextLost&&closed.gl===0);
  }
  if(process.env.JINSHA_LEGACY_PROFILE_ONLY==='1'){report.profileOnly=true;return;}
  await page.locator('#start-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');

  if(WITH_LIVING){
   const debug=await page.evaluate(()=>({adventure:__JINSHA_V2__.adventureDebug(),living:__JINSHA_V2__.livingDebug()}));
   const bud=debug.adventure.targets.find(t=>t.id==='root-bud-0');assert.ok(bud,'existing root bud debug landmark');
   await go(bud.position,'existing first light-bud approach');await press('KeyE');check('ecology prerequisite is obtained with real E',(await snap()).adventure.inventory.carried);
   const branch=(await snap()).perches.find(p=>p.id===debug.living.branchId);assert.ok(branch,'existing ecological branch');
   await go([branch.position[0]+.35,branch.position[1]+.2,branch.position[2]+.1],'existing ecological branch approach, before real R landing');
   await press('KeyR');await page.waitForFunction(id=>__JINSHA_V2__.snapshot().motion.perchId===id,branch.id,{timeout:12000});
   if(!await page.locator('#listening-veil').isVisible())await press('KeyQ');
   await page.waitForFunction(()=>__JINSHA_V2__.snapshot().living.moments.find(m=>m.id==='lantern-bough').progress>.08,null,{timeout:6000});
   await press('KeyM');const before=(await snap()).living.moments.find(m=>m.id==='lantern-bough').progress;await page.waitForTimeout(550);
   check('ecological branch observation freezes inside the actual map',(await snap()).living.moments.find(m=>m.id==='lantern-bough').progress===before);
   await press('Escape');await page.waitForFunction(()=>__JINSHA_V2__.snapshot().living.moments.find(m=>m.id==='lantern-bough').done,null,{timeout:12000});
   check('real R landing and Q listening complete the old branch encounter',(await snap()).living.moments.find(m=>m.id==='lantern-bough').done);await shot('03-branch-response');
   if(await page.locator('#listening-veil').isVisible())await press('KeyQ');await press('KeyR');
  }

  const centre=(await snap()).pottery.position;
  await go([centre[0]+2.5,centre[1],centre[2]],'existing pottery workbench approach');
  await page.waitForFunction(()=>__JINSHA_V2__.snapshot().pottery.interaction);
  await page.locator('#v5-action').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='pottery');await page.waitForTimeout(1100);
  const initial=(await snap()).pottery;check('real contextual action opens the existing pottery workshop',initial.active&&!initial.fired&&initial.totalMade===0);await shot('04-pottery-entry');
  async function stroke(label){
   const point=await page.evaluate(()=>__V9_LEGACY__.clayPoint());assert.ok(!point.unavailable,'a visible clay wall hit must exist');
   const before=(await snap()).pottery;await page.mouse.move(point.x,point.y);await page.mouse.down();
   try{await page.mouse.move(point.x+point.dx,point.y,{steps:12});}finally{await page.mouse.up();}
   await page.waitForTimeout(200);const after=(await snap()).pottery;report.drags.push({label,point,before:{profile:before.profile,edits:before.edits},after:{profile:after.profile,edits:after.edits}});
   check(label+': a real pointer stroke changes the clay profile',after.edits>before.edits&&JSON.stringify(after.profile)!==JSON.stringify(before.profile));return after;
  }
  await stroke('first clay stroke');await page.locator('[data-undo]').click();await page.waitForTimeout(140);
  check('one undo restores the entire pointer stroke',JSON.stringify((await snap()).pottery.profile)===JSON.stringify(initial.profile));
  await stroke('authored clay stroke');await page.locator('[data-pattern="ripple"]').click();await page.waitForTimeout(180);const draft=(await snap()).pottery;
  check('ripple is selected by the real pattern button',draft.pattern==='ripple');await shot('05-pottery-authored');
  await page.locator('.pottery-fire').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().pottery.firing);await page.waitForTimeout(1000);await press('Escape');
  const paused=(await snap()).pottery.heat;await page.waitForTimeout(550);check('leaving the workshop pauses the running kiln',(await snap()).mode==='playing'&&(await snap()).pottery.heat===paused);
  await page.locator('#v5-action').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='pottery');
  await page.waitForFunction(()=>__JINSHA_V2__.snapshot().pottery.fired,null,{timeout:25000});await page.waitForTimeout(300);
  const fired=(await snap()).pottery;check('kiln stores the actual authored profile exactly once',fired.totalMade===1&&fired.works.length===1&&JSON.stringify(fired.works[0].profile)===JSON.stringify(draft.profile)&&fired.works[0].pattern===draft.pattern);await shot('06-pottery-fired');
  await page.locator('.pottery-close').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');await page.waitForTimeout(250);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-forest-v2')));report.persisted={pottery:saved.pottery,living:saved.living};
  check('the ordinary journey save contains the own vessel',saved.pottery.totalMade===1&&JSON.stringify(saved.pottery.works[0])===JSON.stringify(fired.works[0]));
  await page.reload({waitUntil:'commit'});await ready();await page.locator('#continue-btn').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='playing');
  const restored=await snap();check('refresh and actual Continue retain the exact fired vessel',restored.pottery.fired&&restored.pottery.totalMade===1&&JSON.stringify(restored.pottery.works[0])===JSON.stringify(fired.works[0]));
  if(WITH_LIVING)check('refresh also retains the branch observation',restored.living.moments.find(m=>m.id==='lantern-bough').done);
  await go([centre[0]+2.5,centre[1],centre[2]],'restored pottery workbench approach');await page.waitForFunction(()=>__JINSHA_V2__.snapshot().pottery.interaction);
  await page.locator('#v5-action').click();await page.waitForFunction(()=>__JINSHA_V2__.snapshot().mode==='pottery');await page.waitForTimeout(800);await shot('07-pottery-restored');
  check('restored work remains visible and offers its real capture control',await page.locator('.pottery-capture').isVisible()&&(await snap()).pottery.displayFired);
  await page.locator('.pottery-close').click();const finalAudit=await audit();report.final=await snap();report.finalAudit=finalAudit;
  check('no leaked preview canvas or failed main context after both reload paths',!finalAudit.preview&&finalAudit.canvases===initialCanvases&&!finalAudit.contextLost&&finalAudit.gl===0);
  check('no page, console or HTTP failure',!report.errors.length&&!report.consoleErrors.length&&!report.httpErrors.length);
 }catch(error){
  report.failure=error.stack;if(page){report.last=await page.evaluate(()=>window.__JINSHA_V2__?.snapshot()).catch(()=>null);await page.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});}throw error;
 }finally{
  if(browser)await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,consoleErrors:report.consoleErrors,httpErrors:report.httpErrors,failure:report.failure}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
