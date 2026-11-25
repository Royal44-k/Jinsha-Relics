const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const base=process.env.JINSHA_URL||'http://127.0.0.1:5186';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 try {
 await page.goto(base);await page.waitForFunction(()=>window.__JINSHA__);await page.locator('#loading').waitFor({state:'hidden'});
 await page.screenshot({path:'docs/title-screen.png'});
 await page.locator('#about-btn').click();assert.match(await page.locator('#modal').innerText(),/艺术演绎/);await page.keyboard.press('Escape');checks.push('来源与艺术演绎说明');
 await page.locator('#start-btn').click();await page.waitForFunction(()=>window.__JINSHA__.snapshot().mode==='playing');
 const p0=await page.evaluate(()=>window.__JINSHA__.snapshot().position);await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW');const p1=await page.evaluate(()=>window.__JINSHA__.snapshot().position);assert.ok(p1[2]<p0[2]-1,'W moves forward');checks.push('键盘飞行');
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>window.__JINSHA__.snapshot().position);await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>window.__JINSHA__.snapshot().position),frozen);await page.locator('#resume').click();checks.push('暂停冻结与恢复');
 await page.screenshot({path:'docs/gameplay.png'});
 for(const id of ['figure','jade','mask','tiger']){
  await page.keyboard.press('KeyJ');await page.locator(`[data-relic="${id}"]`).click();
  await page.waitForFunction(id=>{const s=window.__JINSHA__.snapshot();return s.nearby===id&&s.guiding===null;},id,{timeout:30000});
  await page.keyboard.press('KeyE');await page.locator('#relic-preview canvas').waitFor();
  if(id==='mask')await page.screenshot({path:'docs/relic-inspection.png'});
  await page.locator('#record-btn').click();assert.ok((await page.evaluate(()=>window.__JINSHA__.snapshot().collected)).includes(id));console.log('Collected',id);
 }
 checks.push('四件记忆引路、检视、收录');
 await page.keyboard.press('KeyG');await page.waitForFunction(()=>{const s=window.__JINSHA__.snapshot();return s.nearby==='sun'&&!s.guiding;},null,{timeout:30000});await page.keyboard.press('KeyE');await page.locator('#record-btn').click();assert.equal(await page.locator('#awaken').isEnabled(),false);
 for(let i=0;i<3;i++)await page.locator('#rotate-outer').click();for(let i=0;i<2;i++)await page.locator('#rotate-inner').click();assert.equal(await page.locator('#awaken').isEnabled(),true);await page.screenshot({path:'docs/puzzle.png'});await page.locator('#awaken').click();await page.locator('#ending').waitFor({state:'visible'});await page.waitForTimeout(3200);await page.screenshot({path:'docs/ending.png'});checks.push('日轮谜题与结局');
 await page.locator('#return-world').click();assert.equal((await page.evaluate(()=>window.__JINSHA__.snapshot())).mode,'playing');checks.push('终章后继续漫游');
 await page.reload();await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#continue-btn').click();const restored=await page.evaluate(()=>window.__JINSHA__.snapshot());assert.equal(restored.collected.length,5);assert.ok(restored.completed);checks.push('刷新恢复存档');
 await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.locator('#motion-toggle').click();await page.locator('#settings-close').click();checks.push('画质与动态设置');
 const soundBefore=await page.locator('#sound-btn').getAttribute('aria-pressed');await page.locator('#sound-btn').click();assert.notEqual(await page.locator('#sound-btn').getAttribute('aria-pressed'),soundBefore);checks.push('静音开关');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:'docs/mobile.png'});assert.ok(await page.locator('#joystick').isVisible());await page.locator('#journal-btn').click();assert.ok(await page.locator('.journal-card').count()===5);await page.keyboard.press('Escape');checks.push('移动布局与图鉴');
 assert.deepEqual(errors,[]);
 const report={date:new Date().toISOString(),checks,pageErrors:errors,finalState:await page.evaluate(()=>window.__JINSHA__.snapshot())};fs.writeFileSync('docs/test-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){await page.screenshot({path:'docs/test-failure.png'});console.error('STATE',await page.evaluate(()=>window.__JINSHA__?.snapshot()));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
