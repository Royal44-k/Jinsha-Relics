const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5221';
const out=path.resolve('docs/v10/fieldwork/eddy');fs.mkdirSync(out,{recursive:true});
const shell=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}html,body,main{width:100%;height:100%;margin:0;overflow:hidden}body{background:#17241e}</style><main></main>
<script type="module">import {mountFieldwork} from '/src/v10/fieldwork.js';const signal=new AbortController();
window.cues=[];window.archives=0;mountFieldwork('paleochannel',document.querySelector('main'),{signal:signal.signal,sound:n=>window.cues.push(n),complete:()=>window.archives++});window.leaveStage=()=>signal.abort();</script></html>`;
const results=[];
async function run(browser,mobile){
  const device=mobile?'touch':'keyboard';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1120,height:700},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
  page.setDefaultTimeout(75000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const button=name=>page.getByRole('button',{name,exact:true}),click=el=>mobile?el.tap():el.click();
  const phase=name=>page.locator('[data-eddy-phase="'+name+'"]').waitFor();
  const until=text=>page.waitForFunction(t=>document.querySelector('.js-field-reading').textContent.includes(t),text,{timeout:90000});
  const ok=(name,condition)=>{assert.ok(condition,device+' '+name);checks.push(name);};
  const capture=name=>page.screenshot({path:path.join(out,device+'-'+name+'.jpg'),quality:82,type:'jpeg'});
  const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1,radiusX:5,radiusY:5,force:.7}]:[]});
  const holdTouch=async el=>{const r=await el.boundingBox();await touch('touchStart',{x:r.x+r.width*.5,y:r.y+r.height*.5});};
  let stage='open';
  try{
    await page.route('**/eddy-check',r=>r.fulfill({contentType:'text/html',body:shell}));
    await page.goto(origin+'/eddy-check');await page.locator('canvas[data-painted]').waitFor();
    await click(button('河心试胆 · 选做'));await phase('ready');
    if(mobile)await click(button('继续测河'));else await page.keyboard.press('Escape');
    ok('exit before launch preserves mooring',await button('解缆出发').isVisible());
    await click(button('解缆出发'));const canvas=page.locator('.js-field canvas');
    async function steerRoute(right){
      if(mobile){const box=await canvas.boundingBox();await touch('touchStart',{x:box.x+box.width*(right?.945:.055),y:box.y+box.height*.63});}
      else {await page.keyboard.down(right?'ArrowRight':'ArrowLeft');await page.keyboard.down('ArrowUp');}
    }
    async function releaseRoute(right){if(mobile)await touch('touchEnd');else{await page.keyboard.up(right?'ArrowRight':'ArrowLeft');await page.keyboard.up('ArrowUp');}}
    stage='first landing';await steerRoute(false);await until('第二站');await releaseRoute(false);
    await click(button('河心试胆 · 选做'));await click(button('迎向回涡'));await phase('warning');
    if(mobile)await click(button('继续测河'));else await page.keyboard.press('Escape');
    ok('withdraw during an incoming wave preserves the first measurement',(await page.locator('.js-field-reading').innerText()).includes('第二站'));
    await click(button('河心试胆 · 选做'));await click(button('迎向回涡'));await phase('warning');
    stage='loss';if(!mobile)await page.keyboard.press('f');else await click(button('拍水还击 F'));
    ok('early splash teaches the opening',/涡心的白环/.test(await page.locator('.js-field-hint').innerText()));
    await phase('wash');await phase('warning');
    const dodgeRight=(await page.locator('.js-field-reading strong').innerText()).includes('左侧');
    if(mobile)await holdTouch(button(dodgeRight?'右拨':'左拨'));else await page.keyboard.down(dodgeRight?'ArrowRight':'ArrowLeft');
    await phase('opening');if(mobile)await touch('touchEnd');else await page.keyboard.up(dodgeRight?'ArrowRight':'ArrowLeft');
    await phase('lost');ok('one impact and one unanswered opening loosen both bindings',(await page.evaluate(()=>window.cues.filter(s=>s==='eddy-hit').length))===2);
    await click(button('再试一次'));await phase('warning');
    for(let i=0;i<3;i++){
      stage='round '+(i+1);await phase('warning');const note=await page.locator('.js-field-reading strong').textContent();
      const steerRight=note.includes('左侧'),code=steerRight?'ArrowRight':'ArrowLeft';
      if(mobile){
        if(i===1){const box=await canvas.boundingBox();await touch('touchStart',{x:box.x+box.width*(steerRight?.91:.09),y:box.y+box.height*.64});}
        else await holdTouch(button(steerRight?'右拨':'左拨'));
      }else await page.keyboard.down(code);
      if(i===0&&!mobile)await capture('warning');
      await phase('opening');if(mobile)await touch('touchEnd');else await page.keyboard.up(code);
      if(i===0&&mobile)await capture('opening');
      if(i===1)await click(button('拍水还击 F'));
      else if(mobile)await click(button('拍向眼前的涡心'));else await page.keyboard.press('f');
      await phase('riposte');ok('crossed the warned side and struck round '+(i+1),true);
    }
    stage='won';await phase('won');if(!mobile)await capture('won');
    ok('challenge win leaves the field entry unarchived',await page.evaluate(()=>window.archives===0));
    await click(button('继续测河'));ok('previous measurement still present',(await page.locator('.js-field-reading').innerText()).includes('第二站'));
    stage='continue';await steerRoute(true);await until('合拢');await releaseRoute(true);
    await click(button('收好岸线图'));ok('survey still docks and archives exactly once',await page.evaluate(()=>window.archives===1));
    const cues=await page.evaluate(()=>Object.fromEntries([...new Set(window.cues)].map(k=>[k,window.cues.filter(n=>n===k).length])));
    ok('both directional warnings, open and counter sounds',cues['eddy-warn-left']&&cues['eddy-warn-right']&&cues['eddy-open']===4&&cues['eddy-strike']===3);
    await page.evaluate(()=>window.leaveStage());ok('exiting releases challenge controls and canvas',await page.locator('.eddy-eye,canvas').count()===0);
    assert.deepEqual(errors,[]);results.push({device,checks,cues,errors});console.log(device,checks.length,'passed');
  }catch(e){await capture('failure').catch(()=>{});console.error(device,stage,await page.locator('.js-field-reading').innerText().catch(()=>''),await page.evaluate(()=>window.cues).catch(()=>[]));throw e;}
  finally{await context.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{for(const mobile of [false,true])await run(browser,mobile);}
  finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Fresh fieldwork mount. Genuine keyboard, mouse and emulated touch inputs. Only the surrounding archival and sound callbacks are fixtures.',results},null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
