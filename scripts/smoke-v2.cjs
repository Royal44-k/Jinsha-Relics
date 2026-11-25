const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=legacyEntry();
const out=process.env.JINSHA_OUTPUT||'docs/v3/runtime/old-flow';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage();
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/@vite/client',async route=>{const response=await route.fetch();const body=(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":');await route.fulfill({response,body});});
  await page.route('**/src/v2/main.js*',async route=>{await new Promise(r=>setTimeout(r,2500));await route.continue();});
  await page.goto(base,{waitUntil:'commit'});await page.waitForTimeout(900);
  const shell=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,loader:!document.getElementById('loading').hidden,hud:document.getElementById('hud').hidden,title:document.getElementById('title-screen').hidden}));
  assert.equal(shell.background,'rgb(16, 37, 34)');assert.ok(shell.loader&&shell.hud&&shell.title);await page.screenshot({path:`${out}/cold-loading.png`});checks.push('延迟程序时首HTML完整深色加载壳，无裸页/HUD泄露');
  await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.unroute('**/src/v2/main.js*');
  await page.waitForTimeout(1200);await page.screenshot({path:`${out}/title.png`});
  await page.locator('#profile-btn').click();await page.locator('#preview canvas').waitFor();await page.waitForTimeout(500);await page.screenshot({path:`${out}/profile.png`});await page.keyboard.press('Escape');checks.push('角色资料与可旋转真实模型');
  await page.locator('#start-btn').click();await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().mode==='playing');
  const p0=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().position);await page.keyboard.down('KeyW');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');const p1=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().position);assert.ok(Math.hypot(p1[0]-p0[0],p1[2]-p0[2])>1);checks.push('第三人称移动');
  await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().position);await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>window.__JINSHA_V2__.snapshot().position),frozen);await page.locator('#resume').click();checks.push('暂停冻结/恢复');
  await page.keyboard.press('KeyQ');assert.ok(await page.locator('#listening-veil').isVisible());await page.keyboard.press('KeyQ');await page.keyboard.press('Space');await page.waitForTimeout(500);await page.screenshot({path:`${out}/exploration.png`});checks.push('倾听与短跃响应');
  const landmarks=await page.evaluate(()=>window.__JINSHA_V2__.snapshot().landmarks);
  for(const [index,answer] of [1,0,2,1,0].entries()){
   const landmark=landmarks[index];await page.evaluate(p=>window.__JINSHA_V2__.goPoint(p),landmark.position);await page.waitForFunction(id=>window.__JINSHA_V2__.snapshot().nearby===id,landmark.id);await page.keyboard.press('KeyE');await page.locator('#preview canvas').waitFor();await page.waitForTimeout(250);await page.screenshot({path:out+'/relic-'+landmark.id+'.png'});
   if(index===0){await page.locator('[data-choice="0"]').click();assert.match(await page.locator('#answer-feedback').innerText(),/再看看/);await page.locator('#side-angle').fill('90');await page.waitForTimeout(300);await page.screenshot({path:`${out}/relic.png`});}
   await page.locator(`[data-choice="${answer}"]`).click();await page.locator('#record-close').click();assert.ok((await page.evaluate(()=>window.__JINSHA_V2__.snapshot().collected)).includes(landmark.id));
  }checks.push('五段文物观察/错误反馈/侧光/记录');
  const sun=landmarks.find(l=>l.id==='sun');
  for(let i=0;i<4;i++){const a=i*Math.PI/2,p=[sun.position[0]+Math.cos(a)*2.8,0,sun.position[2]+Math.sin(a)*2.8];await page.evaluate(p=>window.__JINSHA_V2__.goPoint(p),p);await page.waitForTimeout(100);await page.keyboard.press('KeyF');}
  await page.locator('#ending').waitFor({state:'visible',timeout:7000});await page.waitForTimeout(1000);await page.screenshot({path:`${out}/ending.png`});checks.push('终章四处空间光点与完整结局');
  await page.locator('#return-world').click();await page.reload();await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});const checkpointBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-forest-v2')));await page.locator('#settings-btn').click();await page.locator('[data-volume="music"]').fill('0.35');await page.locator('#settings-close').click();const checkpointAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-forest-v2')));assert.equal(checkpointAfter.distance,checkpointBefore.distance);assert.deepEqual(checkpointAfter.lights,checkpointBefore.lights);checks.push('首页设置不覆盖检查点与终章光点');await page.locator('#continue-btn').click();const restore=await page.evaluate(()=>window.__JINSHA_V2__.snapshot());assert.equal(restore.collected.length,5);assert.ok(restore.completed);checks.push('独立存档恢复');if(restore.mode==='ending')await page.locator('#return-world').click();
  await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.locator('#reduced').check();await page.locator('#settings-close').click();checks.push('轻量画质与减少动态');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await page.screenshot({path:`${out}/mobile.png`});assert.ok(await page.locator('#joystick').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#journal-btn').click();assert.equal(await page.locator('.journal-card').count(),5);await page.keyboard.press('Escape');checks.push('390px触屏布局与图鉴');
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(3500);const final=await page.evaluate(()=>window.__JINSHA_V2__.snapshot());const sorted=final.frames.filter(n=>n<1000).sort((a,b)=>a-b);const graphics=await page.evaluate(()=>{const c=document.querySelector('#scene canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  assert.deepEqual(errors,[]);const report={date:new Date().toISOString(),checks,pageErrors:errors,viewport:'1440x900 DPR1 / 390x844',graphics,frames:{sampleCount:sorted.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)]},final:{...final,frames:undefined}};fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){await page.screenshot({path:`${out}/failure.png`});console.error('STATE',await page.evaluate(()=>window.__JINSHA_V2__?.snapshot()));console.error('ERRORS',errors);throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
