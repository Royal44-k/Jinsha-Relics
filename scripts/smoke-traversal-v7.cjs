const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=legacyEntry();
const out=process.env.JINSHA_OUTPUT||'docs/v7/traversal';fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],checks=[],states={};
  page.on('pageerror',error=>errors.push(error.message));
  const snapshot=()=>page.evaluate(()=>window.__JINSHA_V2__.snapshot());
  const ready=()=>page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});
  const mode=value=>page.waitForFunction(value=>window.__JINSHA_V2__.snapshot().motion.mode===value,value,{timeout:15000});
  const go=point=>page.evaluate(point=>window.__JINSHA_V2__.goPoint(point),point);
  const capture=async(name)=>{states[name]=await snapshot();await page.screenshot({path:`${out}/${name}.png`});};
  try {
    await page.route('**/@vite/client',async route=>{const response=await route.fetch();const body=(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":');await route.fulfill({response,body});});
    await page.goto(base,{waitUntil:'commit'});await ready();
    await page.locator('#start-btn').click();await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().mode==='playing');
    await page.keyboard.down('Space');await mode('flying');
    await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().position[1]>2,null,{timeout:12000});await capture('powered-flight');
    await page.keyboard.up('Space');await mode('gliding');checks.push('真实长按空格展翼、松开滑翔');
    await page.keyboard.press('Escape');const paused=(await snapshot()).position;
    await page.waitForTimeout(450);assert.deepEqual((await snapshot()).position,paused);assert.deepEqual((await snapshot()).motion.velocity,[0,0,0]);
    await page.locator('#resume').click();await page.keyboard.down('KeyC');await mode('grounded');await page.keyboard.up('KeyC');checks.push('飞行暂停冻结并清空输入，恢复可缓降落地');
    const walkStart=(await snapshot()).position;await page.keyboard.down('KeyW');
    await page.waitForFunction(start=>{const p=window.__JINSHA_V2__.snapshot().position;return Math.hypot(p[0]-start[0],p[2]-start[2])>.8;},walkStart,{timeout:12000});
    await page.keyboard.up('KeyW');checks.push('落地后实际键盘行走');

    const world=await snapshot(),pool=world.places.find(p=>p.type==='water').position,perch=world.perches[0];
    await go([pool[0],pool[1]-.42,pool[2]]);await mode('swimming');await capture('river-swimming');
    await page.keyboard.down('KeyC');await mode('diving');
    await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().position[1]<-1.8,null,{timeout:12000});await page.keyboard.up('KeyC');
    await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().immersion>.5,null,{timeout:12000});
    assert.ok(await page.locator('#oxygen-meter').isVisible());await capture('river-diving');
    await page.keyboard.down('Space');await mode('swimming');await page.keyboard.up('Space');checks.push('真实下降键入潜、水下镜头与气息、空格上浮');

    await go([perch.position[0]+.3,perch.position[1]+.15,perch.position[2]]);
    await page.waitForTimeout(120);
    // V5+ contextual action offers the optional branch feather before perching.
    if((await snapshot()).adventure?.interaction?.id?.startsWith('feather-')){await page.keyboard.press('KeyE');await page.waitForTimeout(80);}
    await page.waitForFunction(()=>document.getElementById('interact-name').textContent.includes('停栖')); 
    await page.keyboard.press('KeyE');await mode('perched');assert.equal((await snapshot()).motion.perchId,perch.id);await capture('branch-perched');
    await page.keyboard.press('Space');await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().motion.mode!=='perched');
    await page.keyboard.press('Escape');const branchSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-forest-v2')));
    assert.equal(branchSave.travel.safePerchId,perch.id,'taking off must preserve the branch checkpoint id');
    await page.reload();await ready();await page.locator('#continue-btn').click();await mode('perched');checks.push('真实E停栖、空格离枝、空中存档保留树枝并刷新恢复');

    await go([-29.281,2.52,-185.663]);await page.waitForFunction(()=>!document.getElementById('boundary-cue').hidden);await capture('boundary-guidance');
    await page.evaluate(()=>{const s=window.__JINSHA_V2__.snapshot();window.__JINSHA_V2__.go(s.length*.70);});
    await page.waitForFunction(()=>document.getElementById('boundary-cue').hidden);checks.push('林缘方向提示可见、返回回廊后清除');

    await page.locator('#settings-btn').click();await page.locator('#quality').selectOption('low');await page.locator('#reduced').check();await page.locator('#settings-close').click();
    await page.setViewportSize({width:390,height:844});await page.locator('#touch-jump').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const up=await page.locator('#touch-jump').boundingBox();await page.mouse.move(up.x+up.width/2,up.y+up.height/2);await page.mouse.down();await mode('flying');
    await page.waitForFunction(()=>window.__JINSHA_V2__.snapshot().position[1]>1.5,null,{timeout:12000});await page.mouse.up();await mode('gliding');await capture('mobile-flight');
    const down=await page.locator('#touch-down').boundingBox();await page.mouse.move(down.x+down.width/2,down.y+down.height/2);await page.mouse.down();await mode('grounded');await page.mouse.up();
    await go([pool[0],pool[1]-.42,pool[2]]);await mode('swimming');
    await page.mouse.move(down.x+down.width/2,down.y+down.height/2);await page.mouse.down();await mode('diving');await page.mouse.up();
    await page.mouse.move(up.x+up.width/2,up.y+up.height/2);await page.mouse.down();await mode('swimming');await page.mouse.up();checks.push('390px↑长按飞行、释放滑翔、↓降落与潜水、↑上浮，无横向溢出');
    await page.keyboard.press('Escape');const mobilePaused=(await snapshot()).position;await page.waitForTimeout(250);assert.deepEqual((await snapshot()).position,mobilePaused);await page.locator('#resume').click();
    await page.locator('#help-btn').click();assert.match(await page.locator('#dialog-content').innerText(),/Ctrl \/ C/);await page.keyboard.press('Escape');checks.push('移动暂停恢复与新操作帮助');

    assert.deepEqual(errors,[]);const final=await snapshot();
    const report={date:new Date().toISOString(),checks,pageErrors:errors,states:Object.fromEntries(Object.entries(states).map(([key,value])=>[key,{mode:value.mode,position:value.position,motion:value.motion,immersion:value.immersion,camera:value.camera}])),final:{...final,frames:undefined}};
    fs.writeFileSync(`${out}/v3-input-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks,pageErrors:errors},null,2));
  }catch(error){await page.screenshot({path:`${out}/v3-input-failure.png`});const current=await snapshot().catch(()=>null);fs.writeFileSync(`${out}/v3-input-failure.json`,JSON.stringify({error:error.stack,checks,pageErrors:errors,state:current},null,2));console.error(error,JSON.stringify({checks,pageErrors:errors,motion:current?.motion},null,2));throw error;}
  finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
