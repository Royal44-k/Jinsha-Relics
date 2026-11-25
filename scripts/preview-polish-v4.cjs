const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const out='docs/v4/runtime';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('case "update":','case "disabled-update":').replace('case "full-reload":','case "disabled-full-reload":')});});
  // Read-only instrumentation exists only in this intercepted test response.
  await page.route('**/src/v2/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__V4_AUDIT__=()=>({audio:{paused:audio.paused,time:audio.context?.currentTime,active:audio.active?.id},pipeline:{rendererRatio:renderer?.getPixelRatio(),composerRatio:composer?._pixelRatio,focusEnabled:bokeh?.enabled},preview:preview?{elapsed:preview.elapsed,wing:preview.model.getObjectByName("WingL")?.quaternion.toArray(),spreading:preview.spreading}:null});'});});
  const snap=()=>page.evaluate(()=>window.__JINSHA_V2__.snapshot());const audit=()=>page.evaluate(()=>window.__V4_AUDIT__());
  const capture=name=>page.screenshot({path:out+'/'+name+'.png'});
  await page.goto(legacyEntry());await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.waitForTimeout(1200);await capture('title');const boot=await snap();
  assert.equal(boot.cinematic.lightingReady,true);assert.ok(boot.cinematic.details.activeDraws>0);checks.push('Forest HDR and locally bounded environment details render');
  await page.locator('#profile-btn').click();await page.waitForTimeout(500);await capture('profile');const resting=(await audit()).preview.wing;
  await page.locator('#pose-preview').click();await page.waitForTimeout(900);const spread=(await audit()).preview;
  assert.ok(spread.spreading&&spread.wing.some((n,i)=>Math.abs(n-resting[i])>.1));await capture('profile-wings');await page.waitForTimeout(3100);assert.equal((await audit()).preview.spreading,false);checks.push('Profile animations and actual wing spread run while world is paused');
  await page.keyboard.press('Escape');await page.locator('#start-btn').click();await page.waitForTimeout(500);await page.keyboard.press('KeyP');
  assert.ok(await page.locator('#photo-panel').isVisible());await page.waitForTimeout(150);const pausedAudio=(await audit()).audio,frozen=(await snap()).position;
  await page.waitForTimeout(350);const stillAudio=(await audit()).audio;assert.ok(stillAudio.paused);assert.ok(Math.abs(stillAudio.time-pausedAudio.time)<.06);assert.deepEqual((await snap()).position,frozen);checks.push('Photo mode freezes position and audio clock together');
  await page.locator('#photo-fov').fill('34');await page.locator('[data-photo-tone=".48"]').click();await page.locator('#photo-dof').check();await page.locator('#photo-focus').fill('3.8');await page.waitForTimeout(500);assert.equal((await audit()).pipeline.focusEnabled,true);await capture('photo-mode');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#photo-save').click()]);await download.saveAs(out+'/photo-export.png');const header=fs.readFileSync(out+'/photo-export.png');assert.equal(header.subarray(1,4).toString(),'PNG');assert.ok(header.length>100000);checks.push('Lens, tone, alpha-tested depth of field and interface-free PNG export');
  await page.locator('#photo-focus').focus();await page.keyboard.press('Escape');assert.equal((await snap()).mode,'playing');assert.equal((await audit()).audio.paused,false);checks.push('Escape from focused range exits photo and resumes sound');
  await page.waitForTimeout(3200);await capture('walking');
  await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');await page.keyboard.press('KeyP');assert.equal(await page.locator('#photo-dof').isDisabled(),true);assert.equal(await page.locator('#photo-focus').isDisabled(),true);await page.locator('#photo-fov').focus();await page.keyboard.press('KeyP');assert.equal((await snap()).mode,'playing');checks.push('Low quality explains unavailable depth controls; P also exits from a range');
  await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('high');await page.keyboard.press('Escape');
  const w=await snap();await page.evaluate(p=>window.__JINSHA_V2__.goPoint(p),w.perches[0].position);await page.waitForTimeout(600);await capture('perch');
  const pool=w.places.find(p=>p.type==='water').position;await page.evaluate(p=>window.__JINSHA_V2__.goPoint([p[0],-2.7,p[2]]),pool);await page.waitForTimeout(900);await capture('underwater');checks.push('Perch and underwater remain visible with full postprocess');
  await page.setViewportSize({width:390,height:844});await page.keyboard.press('KeyP');await page.waitForTimeout(350);await capture('photo-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#photo-close').click();checks.push('390px photo panel has no horizontal overflow');
  const glError=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(glError,0);assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),checks,boot:{...boot,frames:undefined},exportBytes:header.length,glError,errors};fs.writeFileSync(out+'/polish-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks,cinematic:boot.cinematic,exportBytes:header.length,glError,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
